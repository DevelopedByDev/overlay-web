import { NextRequest, NextResponse } from 'next/server'
import { convertToModelMessages, stepCountIs, ToolLoopAgent, type UIMessage } from 'ai'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { addAgentMessage, listMemories } from '@/lib/app-store'
import { getGatewayLanguageModel } from '@/lib/ai-gateway'
import { createBrowserUnifiedTools } from '@/lib/composio-tools'

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

    // Save user message to Convex
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
        console.log(`[Agent] User message saved: ${saved ? 'ok' : 'null (convex error)'}`)
        if (!saved) {
          addAgentMessage({ agentId, userId, role: 'user', content: latestUserText })
        }
        // Update agent title from first user message
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
    const effectiveModelId = modelId || 'claude-sonnet-4-6'
    const languageModel = await getGatewayLanguageModel(effectiveModelId, session.accessToken)
    const tools = await createBrowserUnifiedTools({
      userId,
      accessToken: session.accessToken,
    })

    const agent = new ToolLoopAgent({
      model: languageModel,
      tools,
      stopWhen: stepCountIs(12),
      instructions:
        (systemPrompt ||
          'You are Overlay\u2019s browser agent. Use the available Composio tools to complete the user\u2019s task. You do not have OS-level control, local desktop automation, terminal access, or filesystem access in this environment. If an integration is required but not connected, use the Composio connection tools to guide or initiate that connection. Keep the user informed about what you are doing, and end with a concise summary of what was completed and what still needs attention.') +
        memoryContext,
    })

    const result = await agent.stream({
      messages: modelMessages,
      onFinish: agentId
        ? async ({ text }) => {
            if (text) {
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
          }
        : undefined,
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
