import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120
import { getSession } from '@/lib/workos-auth'
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai'
import { convex } from '@/lib/convex'
import { listMemories } from '@/lib/app-store'
import { createWebTools } from '@/lib/web-tools'
import { getGatewayLanguageModel } from '@/lib/ai-gateway'
import { getModel } from '@/lib/models'
import {
  buildOpenRouterMessagesFromUi,
  encodeAssistantTextAsUiDataStream,
  streamOpenRouterChat,
  streamOpenRouterChatWithToolLoop,
  shouldFallbackOpenRouterWithoutTools,
  userFacingOpenRouterError,
} from '@/lib/openrouter-service'
import { buildAutoRetrievalBundle } from '@/lib/ask-knowledge-context'
import {
  OPENROUTER_KNOWLEDGE_TOOLS,
  createKnowledgeToolExecutor,
} from '@/lib/knowledge-openrouter'
import { calculateTokenCost, isPremiumModel } from '@/lib/model-pricing'
import {
  MEMORY_SAVE_PROTOCOL,
  cloneMessagesWithIndexedFileHint,
  indexedFilesSystemNote,
} from '@/lib/knowledge-agent-instructions'
import { mergeReplyContextIntoMessagesForModel } from '@/lib/reply-context-for-model'
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
      indexedFileNames,
      replyContextForModel,
    }: {
      messages: UIMessage[]
      modelId?: string
      conversationId?: string
      turnId?: string
      variantIndex?: number
      systemPrompt?: string
      skipUserMessage?: boolean
      /** Notebook files just indexed from chat attachments (this turn). */
      indexedFileNames?: string[]
      /** Thread reply context appended to last user turn for the model only. */
      replyContextForModel?: string
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

    let conversationProjectId: string | undefined
    if (cid) {
      try {
        const conv = await convex.query<{ projectId?: string } | null>('conversations:get', {
          conversationId: cid,
        })
        conversationProjectId = conv?.projectId
      } catch {
        // optional
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

    let autoRetrieval = ''
    let sourceCitationMap: Record<string, { kind: 'file' | 'memory'; sourceId: string }> = {}
    try {
      const bundle = await buildAutoRetrievalBundle({
        userMessage: latestUserText ?? '',
        userId,
        accessToken: session.accessToken,
        projectId: conversationProjectId,
      })
      autoRetrieval = bundle.extension
      sourceCitationMap = bundle.citations
    } catch {
      // optional
    }

    const indexedNames = Array.isArray(indexedFileNames)
      ? indexedFileNames.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      : []

    const indexedNote = indexedFilesSystemNote(indexedNames)

    /** Model sees indexed + optional reply context in the user turn; request `messages` stay unchanged for persistence. */
    let messagesForModel = cloneMessagesWithIndexedFileHint(messages, indexedNames)
    messagesForModel = mergeReplyContextIntoMessagesForModel(messagesForModel, replyContextForModel)

    const baseSystemMessage = [
      systemPrompt || 'You are a helpful AI assistant.',
      MATH_FORMAT_INSTRUCTION,
      memoryContext,
      autoRetrieval,
      indexedNote,
    ].filter(Boolean).join('\n\n')

    const knowledgeToolNote =
      '\n\nYou can call tools: search_knowledge (search notebook files and memories), save_memory, update_memory, delete_memory. ' +
      'Use search_knowledge for extra retrieval beyond AUTO_RETRIEVED_KNOWLEDGE. ' +
      'When your answer uses AUTO_RETRIEVED_KNOWLEDGE or tool search results, end with **Sources:** as instructed there.\n\n' +
      MEMORY_SAVE_PROTOCOL

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
      const systemWithTools = baseSystemMessage + knowledgeToolNote
      const executeTool = createKnowledgeToolExecutor({
        userId,
        accessToken: session.accessToken,
        projectId: conversationProjectId,
      })
      try {
        const orMessages = buildOpenRouterMessagesFromUi(messagesForModel, systemWithTools)
        return await streamOpenRouterChatWithToolLoop({
          modelId: effectiveModelId,
          messages: orMessages,
          tools: [...OPENROUTER_KNOWLEDGE_TOOLS],
          executeTool,
          accessToken: session.accessToken,
          maxToolRounds: 10,
          onFinish: finishAsk,
        })
      } catch (err) {
        console.error('[conversations/ask] OpenRouter tool loop failed:', err)
        if (shouldFallbackOpenRouterWithoutTools(err)) {
          const fallbackSystem =
            systemWithTools +
            '\n\n(Provider blocked tool calling this turn — answer from AUTO_RETRIEVED_KNOWLEDGE and listed memories only; you cannot run tools.)'
          const fallbackMsgs = buildOpenRouterMessagesFromUi(messagesForModel, fallbackSystem)
          return streamOpenRouterChat({
            modelId: effectiveModelId,
            messages: fallbackMsgs,
            accessToken: session.accessToken,
            onFinish: finishAsk,
          })
        }
        return encodeAssistantTextAsUiDataStream(
          userFacingOpenRouterError(err),
          { inputTokens: 0, outputTokens: 0 },
          finishAsk,
        )
      }
    }

    const languageModel = await getGatewayLanguageModel(effectiveModelId, session.accessToken)
    const modelMessages = await convertToModelMessages(messagesForModel)
    const knowledgeTools = createWebTools({
      userId,
      accessToken: session.accessToken,
      conversationId: conversationId ?? undefined,
      projectId: conversationProjectId,
    })

    const result = streamText({
      model: languageModel,
      system: baseSystemMessage + knowledgeToolNote,
      messages: modelMessages,
      tools: knowledgeTools,
      stopWhen: stepCountIs(10),
      onFinish: async ({ text, usage }) => {
        await finishAsk(text, {
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
        })
      },
    })

    const hasCitations = Object.keys(sourceCitationMap).length > 0

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      messageMetadata: ({ part }) => {
        if (!hasCitations) return undefined
        if (part.type === 'start' || part.type === 'finish') {
          return { sourceCitations: sourceCitationMap }
        }
        return undefined
      },
    })
  } catch (error) {
    console.error('[conversations/ask] Error:', error)
    return NextResponse.json({ error: 'Failed to process ask request' }, { status: 500 })
  }
}
