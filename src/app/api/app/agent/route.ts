import { NextRequest, NextResponse, after } from 'next/server'
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

    const { messages, systemPrompt, agentId }: {
      messages: UIMessage[]
      systemPrompt?: string
      agentId?: string
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
      } catch {
        // optional
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
    const languageModel = await getGatewayLanguageModel('claude-sonnet-4-6', session.accessToken)
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
    })

    // Save assistant message after stream completes
    if (agentId) {
      after(async () => {
        try {
          const resultWithText = result as unknown as { text?: Promise<string> }
          if (resultWithText.text) {
            const assistantText = await resultWithText.text
            if (assistantText) {
              const saved = await convex.mutation('agents:addMessage', {
                agentId,
                userId,
                role: 'assistant',
                content: assistantText,
              })
              if (!saved) {
                addAgentMessage({ agentId, userId, role: 'assistant', content: assistantText })
              }
            }
          }
        } catch {
          // optional
        }
      })
    }

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
