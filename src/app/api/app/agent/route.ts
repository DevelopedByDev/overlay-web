import { NextRequest, NextResponse } from 'next/server'
import { convertToModelMessages, stepCountIs, ToolLoopAgent, type UIMessage } from 'ai'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { addAgentMessage, listMemories } from '@/lib/app-store'
import { getGatewayLanguageModel } from '@/lib/ai-gateway'
import { createBrowserUnifiedTools } from '@/lib/composio-tools'
import { createWebTools } from '@/lib/web-tools'
import { calculateTokenCost, isPremiumModel } from '@/lib/model-pricing'

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
  dailyUsage: { ask: number; write: number; agent: number }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messages, systemPrompt, agentId, modelId }: {
      messages: UIMessage[]
      systemPrompt?: string
      agentId?: string
      modelId?: string
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
        const remainingCents = creditsTotal * 100 - creditsUsed
        if (remainingCents <= 0 && isPremiumModel(effectiveModelId)) {
          return NextResponse.json(
            { error: 'insufficient_credits', message: 'No credits remaining. Please top up your account.' },
            { status: 402 }
          )
        }
      }
    }

    // ── Save user message ─────────────────────────────────────────────────────
    const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    const latestUserText = latestUserMessage?.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => (p as { type: string; text?: string }).text || '')
      .join('')
      .trim()

    if (agentId && latestUserText) {
      try {
        const saved = await convex.mutation('agents:addMessage', {
          agentId,
          userId,
          role: 'user',
          content: latestUserText,
        })
        if (!saved) {
          addAgentMessage({ agentId, userId, role: 'user', content: latestUserText })
        }
        if (messages.filter((m) => m.role === 'user').length === 1) {
          await convex.mutation('agents:update', {
            agentId,
            title: latestUserText.slice(0, 48),
          })
        }
      } catch (err) {
        console.error('[Agent] Failed to save user message:', err)
      }
    }

    // ── Memory context ────────────────────────────────────────────────────────
    let memoryContext = ''
    try {
      const memories = await convex.query<Array<{ content: string }>>('memories:list', { userId })
      const effectiveMemories = memories || listMemories(userId)
      if (effectiveMemories.length > 0) {
        memoryContext =
          '\n\nUser context:\n' +
          effectiveMemories
            .slice(0, 10)
            .map((m) => `- ${m.content}`)
            .join('\n')
      }
    } catch {
      // optional
    }

    const modelMessages = await convertToModelMessages(messages)
    const languageModel = await getGatewayLanguageModel(effectiveModelId, session.accessToken)
    const [composioTools, webToolSet] = await Promise.all([
      createBrowserUnifiedTools({ userId, accessToken: session.accessToken }),
      Promise.resolve(createWebTools({ userId, accessToken: session.accessToken, agentId: agentId ?? undefined })),
    ])
    const tools = { ...composioTools, ...webToolSet }

    const generationNote =
      '\nYou also have generate_image and generate_video tools. Use them whenever the user asks to create visual content. For videos, inform the user that generation is async and may take a few minutes — results will appear in the Outputs tab.'

    const agent = new ToolLoopAgent({
      model: languageModel,
      tools,
      stopWhen: stepCountIs(12),
      instructions:
        (systemPrompt ||
          'You are Overlay\u2019s browser agent. Use the available Composio tools to complete the user\u2019s task. You do not have OS-level control, local desktop automation, terminal access, or filesystem access in this environment. If an integration is required but not connected, use the Composio connection tools to guide or initiate that connection. Keep the user informed about what you are doing, and end with a concise summary of what was completed and what still needs attention.') +
        generationNote +
        memoryContext,
    })

    // Track total usage across all agent steps
    let totalInputTokens = 0
    let totalOutputTokens = 0

    const result = await agent.stream({
      messages: modelMessages,
      onFinish: async ({ text, usage }) => {
        // ── Usage tracking ────────────────────────────────────────────────────
        if (usage) {
          totalInputTokens += usage.inputTokens ?? 0
          totalOutputTokens += usage.outputTokens ?? 0
        }

        const costDollars = calculateTokenCost(effectiveModelId, totalInputTokens, 0, totalOutputTokens)
        const costCents = costDollars * 100

        if (costCents > 0 || totalInputTokens > 0 || totalOutputTokens > 0) {
          convex.mutation('usage:recordBatch', {
            accessToken: session.accessToken,
            userId,
            events: [{
              type: 'agent',
              modelId: effectiveModelId,
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
              cachedTokens: 0,
              cost: costCents,
              timestamp: Date.now(),
            }],
          }).catch((err) => console.error('[Agent] Failed to record usage:', err))
        }

        // ── Save assistant message ────────────────────────────────────────────
        if (agentId && text) {
          try {
            const saved = await convex.mutation('agents:addMessage', {
              agentId,
              userId,
              role: 'assistant',
              content: text,
            })
            if (!saved) {
              addAgentMessage({ agentId, userId, role: 'assistant', content: text })
            }
          } catch (err) {
            console.error('[Agent] Failed to save assistant message:', err)
          }
        }
      },
    })

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onError: (error: unknown) => (error instanceof Error ? error.message : 'Agent request failed'),
    })
  } catch (error) {
    console.error('[Agent API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent request failed' },
      { status: 500 }
    )
  }
}
