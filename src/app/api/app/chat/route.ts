import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120
import { getSession } from '@/lib/workos-auth'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { convex } from '@/lib/convex'
import { addMessage, listMemories } from '@/lib/app-store'
import { getGatewayLanguageModel } from '@/lib/ai-gateway'
import { calculateTokenCost, isPremiumModel } from '@/lib/model-pricing'

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

    const { messages, modelId, chatId, systemPrompt, skipUserMessage }: {
      messages: UIMessage[]
      modelId?: string
      chatId?: string
      systemPrompt?: string
      skipUserMessage?: boolean
    } = await request.json()
    const userId = session.user.id
    const effectiveModelId = modelId || 'claude-sonnet-4-6'

    // ── Subscription enforcement ──────────────────────────────────────────────
    const entitlements = await convex.query<Entitlements>('usage:getEntitlements', {
      accessToken: session.accessToken,
      userId,
    })

    if (entitlements) {
      const { tier, dailyUsage, creditsUsed, creditsTotal } = entitlements

      if (tier === 'free') {
        if (isPremiumModel(effectiveModelId)) {
          return NextResponse.json(
            { error: 'premium_model_not_allowed', message: 'Upgrade to Pro to use premium models' },
            { status: 403 }
          )
        }
        const totalWeekly = dailyUsage.ask + dailyUsage.write + dailyUsage.agent
        if (totalWeekly >= 15) {
          return NextResponse.json(
            { error: 'weekly_limit_exceeded', message: 'Weekly message limit reached. Upgrade to Pro for unlimited messages.' },
            { status: 429 }
          )
        }
      } else {
        // Pro / Max — check credits for premium models
        const remainingCents = creditsTotal * 100 - creditsUsed
        if (remainingCents <= 0 && isPremiumModel(effectiveModelId)) {
          return NextResponse.json(
            { error: 'insufficient_credits', message: 'No credits remaining. Please top up your account.' },
            { status: 402 }
          )
        }
      }
    }

    // ── Memory context ────────────────────────────────────────────────────────
    let memoryContext = ''
    try {
      const memories = await convex.query<Array<{ content: string }>>('memories:list', { userId })
      const effectiveMemories = memories || listMemories(userId)
      if (effectiveMemories.length > 0) {
        memoryContext = '\n\nRelevant user memories:\n' + effectiveMemories.slice(0, 10).map((m) => `- ${m.content}`).join('\n')
      }
    } catch {
      // Memory context is optional
    }

    const systemMessage = (systemPrompt || 'You are a helpful AI assistant.') + memoryContext

    // ── Save user message ─────────────────────────────────────────────────────
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    const latestUserText = latestUserMessage?.parts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ?.filter((part: any) => part.type === 'text')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((part: any) => part.text || '')
      .join('')
      .trim()

    if (chatId && latestUserText && !skipUserMessage) {
      const savedUserMessage = await convex.mutation('chats:addMessage', {
        chatId,
        userId,
        role: 'user',
        content: latestUserText,
        model: effectiveModelId,
      })
      if (!savedUserMessage) {
        addMessage({ chatId, userId, role: 'user', content: latestUserText, model: effectiveModelId })
      }
    }

    const languageModel = await getGatewayLanguageModel(effectiveModelId, session.accessToken)
    const modelMessages = await convertToModelMessages(messages)

    const result = streamText({
      model: languageModel,
      system: systemMessage,
      messages: modelMessages,
      onFinish: async ({ text, usage }) => {
        // ── Usage tracking ────────────────────────────────────────────────────
        if (usage) {
          const costDollars = calculateTokenCost(
            effectiveModelId,
            usage.inputTokens ?? 0,
            0,
            usage.outputTokens ?? 0
          )
          const costCents = costDollars * 100

          convex.mutation('usage:recordBatch', {
            accessToken: session.accessToken,
            userId,
            events: [{
              type: 'ask',
              modelId: effectiveModelId,
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
              cachedTokens: 0,
              cost: costCents,
              timestamp: Date.now(),
            }],
          }).catch((err) => console.error('[Chat] Failed to record usage:', err))
        }

        // ── Save assistant message ────────────────────────────────────────────
        if (chatId) {
          try {
            const savedAssistantMessage = await convex.mutation('chats:addMessage', {
              chatId,
              userId,
              role: 'assistant',
              content: text,
              model: effectiveModelId,
              tokens: usage ? { input: usage.inputTokens ?? 0, output: usage.outputTokens ?? 0 } : undefined,
            })
            if (!savedAssistantMessage) {
              addMessage({
                chatId,
                userId,
                role: 'assistant',
                content: text,
                model: effectiveModelId,
                tokens: usage ? { input: usage.inputTokens ?? 0, output: usage.outputTokens ?? 0 } : undefined,
              })
            }
          } catch (err) {
            console.error('[Chat] Failed to save message:', err)
          }
        }
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('[Chat API] Error:', error)
    return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 })
  }
}
