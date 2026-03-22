import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120
import { getSession } from '@/lib/workos-auth'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { convex } from '@/lib/convex'
import { listMemories } from '@/lib/app-store'
import { getGatewayLanguageModel } from '@/lib/ai-gateway'
import { getModel } from '@/lib/models'
import { buildOpenRouterMessagesFromUi, streamOpenRouterChat } from '@/lib/openrouter-service'
import { calculateTokenCost, isPremiumModel } from '@/lib/model-pricing'
import type { Id } from '../../../../../../convex/_generated/dataModel'

const MATH_FORMAT_INSTRUCTION = [
  'Formatting requirements for math output:',
  '- If you include any mathematical expression or equation, wrap it in double dollar delimiters: $$...$$.',
  '- Use $$...$$ for both inline and display math.',
  '- Do not use single-dollar math, \\(...\\), or \\[...\\].',
  '- Keep explanatory prose outside the $$ delimiters.',
].join('\n')

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
  dailyUsage: { ask: number; write: number; agent: number }
  dailyLimits: { ask: number; write: number; agent: number }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      messages,
      modelId,
      conversationId,
      turnId,
      variantIndex,
      systemPrompt,
      skipUserMessage,
    }: {
      messages: UIMessage[]
      modelId?: string
      conversationId?: string
      turnId?: string
      variantIndex?: number
      systemPrompt?: string
      skipUserMessage?: boolean
    } = await request.json()
    const userId = session.user.id
    const effectiveModelId = modelId || 'claude-sonnet-4-6'

    const entitlements = await convex.query<Entitlements>('usage:getEntitlements', {
      accessToken: session.accessToken,
      userId,
    })

    if (entitlements) {
      const { tier, dailyUsage, creditsUsed, creditsTotal } = entitlements
      const creditsTotalCents = creditsTotal * 100
      const remainingCents = creditsTotalCents - creditsUsed

      if (tier === 'free') {
        if (isPremiumModel(effectiveModelId)) {
          return NextResponse.json(
            { error: 'premium_model_not_allowed', message: 'Upgrade to Pro to use premium models' },
            { status: 403 },
          )
        }
        const totalWeekly = dailyUsage.ask + dailyUsage.write + dailyUsage.agent
        if (totalWeekly >= 15) {
          return NextResponse.json(
            { error: 'weekly_limit_exceeded', message: 'Weekly message limit reached. Upgrade to Pro for unlimited messages.' },
            { status: 429 },
          )
        }
      } else {
        if (remainingCents <= 0 && isPremiumModel(effectiveModelId)) {
          return NextResponse.json(
            { error: 'insufficient_credits', message: 'No credits remaining. Please top up your account.' },
            { status: 402 },
          )
        }
      }
    }

    let memoryContext = ''
    try {
      const memories = await convex.query<Array<{ content: string }>>('memories:list', { userId })
      const effectiveMemories = memories || listMemories(userId)
      if (effectiveMemories.length > 0) {
        memoryContext = '\n\nRelevant user memories:\n' + effectiveMemories.slice(0, 10).map((m) => `- ${m.content}`).join('\n')
      }
    } catch {
      // optional
    }

    const systemMessage = [
      systemPrompt || 'You are a helpful AI assistant.',
      MATH_FORMAT_INSTRUCTION,
      memoryContext,
    ].filter(Boolean).join('\n\n')

    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    const latestUserText = latestUserMessage?.parts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ?.filter((part: any) => part.type === 'text')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((part: any) => part.text || '')
      .join('')
      .trim()
    const latestUserParts = latestUserMessage?.parts
      ?.filter((part) => part.type === 'text' || part.type === 'file')
      .map((part) => {
        if (part.type === 'text') {
          return { type: 'text', text: 'text' in part ? part.text || '' : '' }
        }
        return {
          type: 'file',
          url: 'url' in part ? part.url : undefined,
          mediaType: 'mediaType' in part ? part.mediaType : undefined,
        }
      })
    const latestUserContent = latestUserText || (latestUserParts?.some((part) => part.type === 'file') ? '[Image attachment]' : '')

    const cid = conversationId as Id<'conversations'> | undefined
    const tid = turnId?.trim()

    if (cid && tid && latestUserContent && !skipUserMessage) {
      await convex.mutation('conversations:addMessage', {
        conversationId: cid,
        userId,
        turnId: tid,
        role: 'user',
        mode: 'ask',
        content: latestUserContent,
        contentType: 'text',
        parts: latestUserParts,
        modelId: effectiveModelId,
      })
    }

    const finishAsk = async (
      text: string,
      usage: { inputTokens: number; outputTokens: number },
    ) => {
      const costDollars = calculateTokenCost(
        effectiveModelId,
        usage.inputTokens,
        0,
        usage.outputTokens,
      )
      const costCents = Math.round(costDollars * 100)

      if (costCents > 0 || usage.inputTokens > 0 || usage.outputTokens > 0) {
        try {
          await convex.mutation('usage:recordBatch', {
            accessToken: session.accessToken,
            userId,
            events: [{
              type: 'ask',
              modelId: effectiveModelId,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              cachedTokens: 0,
              cost: costCents,
              timestamp: Date.now(),
            }],
          })
        } catch (err) {
          console.error('[conversations/ask] Failed to record usage:', err)
        }
      }

      if (cid && tid) {
        try {
          await convex.mutation('conversations:addMessage', {
            conversationId: cid,
            userId,
            turnId: tid,
            role: 'assistant',
            mode: 'ask',
            content: text,
            contentType: 'text',
            parts: [{ type: 'text', text }],
            modelId: effectiveModelId,
            variantIndex: variantIndex ?? 0,
            tokens: { input: usage.inputTokens, output: usage.outputTokens },
          })
        } catch (err) {
          console.error('[conversations/ask] Failed to save message:', err)
        }
      }
    }

    if (getModel(effectiveModelId)?.provider === 'openrouter') {
      const orMessages = buildOpenRouterMessagesFromUi(messages, systemMessage)
      return streamOpenRouterChat({
        modelId: effectiveModelId,
        messages: orMessages,
        accessToken: session.accessToken,
        onFinish: finishAsk,
      })
    }

    const languageModel = await getGatewayLanguageModel(effectiveModelId, session.accessToken)
    const modelMessages = await convertToModelMessages(messages)

    const result = streamText({
      model: languageModel,
      system: systemMessage,
      messages: modelMessages,
      onFinish: async ({ text, usage }) => {
        await finishAsk(text, {
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
        })
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('[conversations/ask] Error:', error)
    return NextResponse.json({ error: 'Failed to process ask request' }, { status: 500 })
  }
}
