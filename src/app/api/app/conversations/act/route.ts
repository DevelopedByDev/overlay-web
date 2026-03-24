import { NextRequest, NextResponse } from 'next/server'
import { convertToModelMessages, stepCountIs, ToolLoopAgent, type UIMessage } from 'ai'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { listMemories } from '@/lib/app-store'
import { getGatewayLanguageModel, getGatewayPerplexitySearchTool } from '@/lib/ai-gateway'
import { userFacingOpenRouterError } from '@/lib/openrouter-service'
import { createBrowserUnifiedTools } from '@/lib/composio-tools'
import { createWebTools } from '@/lib/web-tools'
import { MAX_TOOL_STEPS_ACT } from '@/lib/tools/policy'
import { calculateTokenCost, isPremiumModel } from '@/lib/model-pricing'
import { buildAutoRetrievalBundle } from '@/lib/ask-knowledge-context'
import {
  ACT_KNOWLEDGE_WEB_TOOLS_NOTE,
  MEMORY_SAVE_PROTOCOL,
  cloneMessagesWithIndexedFileHint,
  indexedFilesSystemNote,
} from '@/lib/knowledge-agent-instructions'
import { filterComposioToolSet } from '@/lib/tools/composio-filter'
import { fireAndForgetRecordToolInvocation } from '@/lib/tools/record-tool-invocation'
import { mergeReplyContextIntoMessagesForModel } from '@/lib/reply-context-for-model'
import { buildAssistantPersistenceFromSteps } from '@/lib/persist-assistant-turn'
import { getInternalApiBaseUrl } from '@/lib/url'
import { sanitizeUiMessagesForModelApi } from '@/lib/sanitize-ui-messages-for-model'
import type { Id } from '../../../../../../convex/_generated/dataModel'

function summarizeToolOutputForLog(output: unknown): string {
  if (output == null) return 'null/undefined'
  if (typeof output === 'string') return `string length=${output.length}`
  if (typeof output === 'object') {
    const keys = Object.keys(output as object)
    return `object keys=[${keys.slice(0, 12).join(', ')}${keys.length > 12 ? ', …' : ''}]`
  }
  return typeof output
}

export const maxDuration = 120

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

    const {
      messages,
      systemPrompt,
      conversationId,
      turnId,
      modelId,
      indexedFileNames,
      replyContextForModel,
    }: {
      messages: UIMessage[]
      systemPrompt?: string
      conversationId?: string
      turnId?: string
      modelId?: string
      indexedFileNames?: string[]
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

    const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    const latestUserText = latestUserMessage?.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => (p as { type: string; text?: string }).text || '')
      .join('')
      .trim()
    const latestUserParts = latestUserMessage?.parts
      ?.filter((p) => p.type === 'text' || p.type === 'file')
      .map((part) => {
        if (part.type === 'text') {
          return { type: 'text' as const, text: 'text' in part ? part.text || '' : '' }
        }
        return {
          type: 'file' as const,
          url: 'url' in part ? part.url : undefined,
          mediaType: 'mediaType' in part ? part.mediaType : undefined,
        }
      })
    const latestUserContent = latestUserText || (latestUserParts?.some((p) => p.type === 'file') ? '[Image attachment]' : '')

    const cid = conversationId as Id<'conversations'> | undefined
    const tid = (turnId?.trim() || `act-${Date.now()}`)

    if (cid && latestUserContent) {
      try {
        await convex.mutation('conversations:addMessage', {
          conversationId: cid,
          userId,
          turnId: tid,
          role: 'user',
          mode: 'act',
          content: latestUserContent,
          contentType: 'text',
          parts: latestUserParts,
          modelId: effectiveModelId,
        })
        if (messages.filter((m) => m.role === 'user').length === 1) {
          await convex.mutation('conversations:update', {
            conversationId: cid,
            title: (latestUserText || latestUserContent).slice(0, 48) || 'New Chat',
          })
        }
      } catch (err) {
        console.error('[conversations/act] Failed to save user message:', err)
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
    let messagesForModel = cloneMessagesWithIndexedFileHint(messages, indexedNames)
    messagesForModel = mergeReplyContextIntoMessagesForModel(messagesForModel, replyContextForModel)
    messagesForModel = sanitizeUiMessagesForModelApi(messagesForModel)

    const modelMessages = await convertToModelMessages(messagesForModel)
    const languageModel = await getGatewayLanguageModel(effectiveModelId, session.accessToken)
    const [composioRaw, webToolSet, perplexityTool] = await Promise.all([
      createBrowserUnifiedTools({ userId, accessToken: session.accessToken }),
      Promise.resolve(
        createWebTools({
          userId,
          accessToken: session.accessToken,
          conversationId: conversationId ?? undefined,
          projectId: conversationProjectId,
          baseUrl: getInternalApiBaseUrl(request),
          forwardCookie: request.headers.get('cookie') ?? undefined,
        }),
      ),
      getGatewayPerplexitySearchTool(session.accessToken, effectiveModelId),
    ])
    const composioTools = filterComposioToolSet(composioRaw, 'act')
    const tools = {
      ...composioTools,
      ...webToolSet,
      ...(perplexityTool ? { perplexity_search: perplexityTool } : {}),
    }

    console.log(
      '[conversations/act] tool ids:',
      Object.keys(tools).sort().join(', '),
      '| perplexity_search:',
      perplexityTool ? 'yes' : 'NO (missing gateway key or init failed — see [AI Gateway] logs)',
    )

    const generationNote =
      '\nYou also have generate_image and generate_video tools. Use them whenever the user asks to create visual content. For videos, inform the user that generation is async and may take a few minutes — results will appear in the Outputs tab.'
    const knowledgeNote =
      '\n' +
      ACT_KNOWLEDGE_WEB_TOOLS_NOTE +
      '\n\nYou also have save_memory, update_memory, and delete_memory.\n\n' +
      MEMORY_SAVE_PROTOCOL

    const agent = new ToolLoopAgent({
      model: languageModel,
      tools,
      stopWhen: stepCountIs(MAX_TOOL_STEPS_ACT),
      instructions:
        (systemPrompt ||
          'You are Overlay\u2019s browser agent. Use the available Composio tools to complete the user\u2019s task. You do not have OS-level control, local desktop automation, terminal access, or filesystem access in this environment. If an integration is required but not connected, use the Composio connection tools to guide or initiate that connection. Keep the user informed about what you are doing, and end with a concise summary of what was completed and what still needs attention.') +
        generationNote +
        knowledgeNote +
        memoryContext +
        autoRetrieval +
        indexedNote,
    })

    const result = await agent.stream({
      messages: modelMessages,
      experimental_onToolCallStart: ({ toolCall }) => {
        if (!toolCall || toolCall.toolName !== 'perplexity_search') return
        const input = toolCall.input as Record<string, unknown> | undefined
        const q =
          input && typeof input.query === 'string'
            ? `${input.query.slice(0, 160)}${input.query.length > 160 ? '…' : ''}`
            : JSON.stringify(input)?.slice(0, 200)
        console.log('[conversations/act] perplexity_search START', {
          toolCallId: toolCall.toolCallId,
          queryPreview: q,
        })
      },
      experimental_onToolCallFinish: ({ toolCall, success, durationMs, output, error }) => {
        if (!toolCall?.toolName) return
        if (toolCall.toolName === 'perplexity_search') {
          if (success) {
            console.log('[conversations/act] perplexity_search OK', {
              toolCallId: toolCall.toolCallId,
              durationMs,
              output: summarizeToolOutputForLog(output),
            })
          } else {
            console.error('[conversations/act] perplexity_search FAILED', {
              toolCallId: toolCall.toolCallId,
              durationMs,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
        fireAndForgetRecordToolInvocation({
          accessToken: session.accessToken,
          userId,
          toolName: toolCall.toolName,
          mode: 'act',
          modelId: effectiveModelId,
          conversationId: conversationId ?? undefined,
          success,
          durationMs,
          error,
        })
      },
      onFinish: async (event) => {
        const totalUsage = event.totalUsage
        const totalInputTokens = totalUsage?.inputTokens ?? 0
        const totalOutputTokens = totalUsage?.outputTokens ?? 0

        const costDollars = calculateTokenCost(effectiveModelId, totalInputTokens, 0, totalOutputTokens)
        const costCents = Math.round(costDollars * 100)

        if (costCents > 0 || totalInputTokens > 0 || totalOutputTokens > 0) {
          try {
            await convex.mutation('usage:recordBatch', {
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
            })
          } catch (err) {
            console.error('[conversations/act] Failed to record usage:', err)
          }
        }

        const { content: persistContent, parts: persistParts } = buildAssistantPersistenceFromSteps(
          event.steps,
          event.text,
        )

        if (cid && persistContent) {
          try {
            await convex.mutation('conversations:addMessage', {
              conversationId: cid,
              userId,
              turnId: tid,
              role: 'assistant',
              mode: 'act',
              content: persistContent,
              contentType: 'text',
              parts: persistParts as never,
              modelId: effectiveModelId,
              tokens: { input: totalInputTokens, output: totalOutputTokens },
            })
          } catch (err) {
            console.error('[conversations/act] Failed to save assistant message:', err)
          }
        }
      },
    })

    const hasCitations = Object.keys(sourceCitationMap).length > 0

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onError: (error: unknown) => userFacingOpenRouterError(error),
      messageMetadata: ({ part }) => {
        if (!hasCitations) return undefined
        // Send early so the client can linkify **Sources:** while the reply streams.
        if (part.type === 'start' || part.type === 'finish') {
          return { sourceCitations: sourceCitationMap }
        }
        return undefined
      },
    })
  } catch (error) {
    console.error('[conversations/act] Error:', error)
    return NextResponse.json(
      { error: userFacingOpenRouterError(error) },
      { status: 500 },
    )
  }
}
