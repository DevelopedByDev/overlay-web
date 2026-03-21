import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120
import { getSession } from '@/lib/workos-auth'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { convex } from '@/lib/convex'
import { addMessage, listMemories } from '@/lib/app-store'
import { getGatewayLanguageModel } from '@/lib/ai-gateway'
import { calculateTokenCost, isPremiumModel } from '@/lib/model-pricing'

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
      const creditsTotalCents = creditsTotal * 100
      const remainingCents = creditsTotalCents - creditsUsed
      const usedPct = creditsTotalCents > 0 ? ((creditsUsed / creditsTotalCents) * 100).toFixed(2) : '0.00'
      console.log(`[Chat] 📊 Entitlements: tier=${tier} | used=${creditsUsed}¢ / ${creditsTotalCents}¢ (${usedPct}% used, $${(remainingCents / 100).toFixed(4)} remaining) | model=${effectiveModelId} | userId=${userId}`)

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
        if (remainingCents <= 0 && isPremiumModel(effectiveModelId)) {
          console.log(`[Chat] ⛔ Blocked: no credits remaining (${creditsUsed}¢ / ${creditsTotalCents}¢) | model=${effectiveModelId}`)
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

    const systemMessage = [
      systemPrompt || 'You are a helpful AI assistant.',
      MATH_FORMAT_INSTRUCTION,
      memoryContext,
    ].filter(Boolean).join('\n\n')

    // ── Save user message ─────────────────────────────────────────────────────
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

    if (chatId && latestUserContent && !skipUserMessage) {
      const savedUserMessage = await convex.mutation('chats:addMessage', {
        chatId,
        userId,
        role: 'user',
        content: latestUserContent,
        parts: latestUserParts,
        model: effectiveModelId,
      })
      if (!savedUserMessage) {
        addMessage({ chatId, userId, role: 'user', content: latestUserContent, parts: latestUserParts, model: effectiveModelId })
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
          const costCents = Math.round(costDollars * 100)
          console.log(`[Chat] 💰 Cost: model=${effectiveModelId} | in=${usage.inputTokens ?? 0} out=${usage.outputTokens ?? 0} | $${costDollars.toFixed(4)} = ${costCents}¢`)

          if (costCents > 0 || (usage.inputTokens ?? 0) > 0) {
            try {
              await convex.mutation('usage:recordBatch', {
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
              })
              console.log(`[Chat] ✅ Usage recorded: ${costCents}¢ for model=${effectiveModelId}`)
            } catch (err) {
              console.error('[Chat] Failed to record usage:', err)
            }
          } else {
            console.log(`[Chat] ⚠️  Cost is 0¢ for model=${effectiveModelId} — free model or no token data`)
          }
        }

        // ── Save assistant message ────────────────────────────────────────────
        if (chatId) {
          try {
            const savedAssistantMessage = await convex.mutation('chats:addMessage', {
              chatId,
              userId,
              role: 'assistant',
              content: text,
              parts: [{ type: 'text', text }],
              model: effectiveModelId,
              tokens: usage ? { input: usage.inputTokens ?? 0, output: usage.outputTokens ?? 0 } : undefined,
            })
            if (!savedAssistantMessage) {
              addMessage({
                chatId,
                userId,
                role: 'assistant',
                content: text,
                parts: [{ type: 'text', text }],
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
