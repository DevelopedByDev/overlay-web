import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { convex } from '@/lib/convex'
import { addMessage, listMemories } from '@/lib/app-store'
import { getGatewayLanguageModel } from '@/lib/ai-gateway'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messages, modelId, chatId, systemPrompt }: {
      messages: UIMessage[]
      modelId?: string
      chatId?: string
      systemPrompt?: string
    } = await request.json()
    const userId = session.user.id

    // Get memories for context
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

    const effectiveModelId = modelId || 'claude-sonnet-4-6'
    const languageModel = await getGatewayLanguageModel(effectiveModelId, session.accessToken)

    const systemMessage = (systemPrompt || 'You are a helpful AI assistant.') + memoryContext

    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    const latestUserText = latestUserMessage?.parts
      ?.filter((part) => part.type === 'text')
      .map((part) => part.text || '')
      .join('')
      .trim()

    if (chatId && latestUserText) {
      const savedUserMessage = await convex.mutation('chats:addMessage', {
        chatId,
        userId,
        role: 'user',
        content: latestUserText,
        model: effectiveModelId,
      })

      if (!savedUserMessage) {
        addMessage({
          chatId,
          userId,
          role: 'user',
          content: latestUserText,
          model: effectiveModelId,
        })
      }
    }

    const modelMessages = await convertToModelMessages(messages)

    const result = streamText({
      model: languageModel,
      system: systemMessage,
      messages: modelMessages,
      onFinish: async ({ text, usage }) => {
        // Save assistant message to Convex if chatId provided
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
