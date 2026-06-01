import { logger } from '@/server/observability/logger'
import { after, NextRequest, NextResponse } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { readValidatedJson } from '@/server/app-api/validated-input'
import { convertToModelMessages, stepCountIs, ToolLoopAgent, type UIMessage } from '@/server/ai/sdk'
import type { LanguageModelV3 } from '@/server/ai/provider-types'
import { getInternalApiSecret } from '@/server/shared/internal-api-secret'
import {
  getLanguageModel,
  getOpenRouterLanguageModelCapturingRoutedModel,
} from '@/server/ai/model-runtime'
import { modelSupportsZeroDataRetention } from '@/shared/ai/gateway/model-data'
import { getChatModelFallbackCandidates } from '@/shared/ai/gateway/model-fallbacks'
import { userFacingOpenRouterError } from '@/server/ai/model-runtime'
import {
  FREE_TIER_AUTO_MODEL_ID,
  isNvidiaNimChatModelId,
} from '@/shared/ai/gateway/model-types'
import { normalizeChatToolRequestIds } from '@/shared/chat/tool-requests'
import { MAX_TOOL_STEPS_ACT } from '@/server/tools/tools/policy'
import { fireAndForgetRecordToolInvocation } from '@/server/tools/tools/record-tool-invocation'
import { getInternalApiBaseUrl } from '@/server/web/app-url'
import { buildSecondarySystemPromptExtension } from '@/server/agent/operator-system-prompt'
import {
  summarizeErrorForLog,
  summarizeToolInputForLog,
} from '@/shared/security/safe-log'
import {
  createNvidiaNimChatLanguageModel,
  resolveNvidiaApiKey,
} from '@/server/ai/model-runtime'
import { isVerifiedChatStreamRelayRequest } from '@/server/chat/chat-stream-relay-auth'
import { ActConversationRequest } from '@/shared/schemas/chat'
import {
  actContextService,
  actConversationErrorResponse,
  actEntitlementService,
  actGeneratingMessageService,
  actMessagePersistenceService,
  actUsageBudgetService,
} from '@/server/conversations/http'
import {
  classifyMediaToolIntentForTurn,
  normalizeStructuredMediaToolIntent,
} from '@/server/tools/media-tool-intent'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import {
  MAX_ACT_MODEL_ATTEMPTS,
  drainReadableStream,
  messagesRequireVision,
  prefixFallbackNoticeAfterStart,
  resolveActAbortTimeoutMs,
  resolveActMultiModelState,
  resolveActStreamPersistence,
  resolveActTurnId,
  resolveEffectiveActModelId,
  runActModelAttempts,
  summarizeToolOutputForLog,
} from './route-helpers'
import { buildActAgentInstructions } from './instructions'
import {
  logActTooling,
  prepareActTooling,
  preloadActExternalToolTasks,
} from './tooling'

export const maxDuration = 800

export async function POST(request: NextRequest, context: AppApiRouteContext) {
  let pendingGeneratingMessageId: Id<'conversationMessages'> | undefined
  let budgetReservationId: string | null = null
  let budgetReservationFinalized = false
  let currentUserId: string | undefined
  let actWebhookConversationId: Id<'conversations'> | undefined
  let actWebhookTurnId: string | undefined
  let actWebhookSkip = false
  try {
    const {
      ACT_KNOWLEDGE_TOOLS_NOTE_NO_WEB,
      ACT_KNOWLEDGE_WEB_TOOLS_NOTE,
      ACT_PAID_PLAN_ACT_TOOLS_REALITY,
      FREE_TIER_NO_PAID_AGENT_CAPABILITIES,
      MEMORY_SAVE_PROTOCOL,
      cloneMessagesWithIndexedFileHint,
      indexedFilesSystemNote,
      indexedFilesSystemNotePreloaded,
    } = await import('@/server/agent/knowledge-agent-instructions')
    const { MATH_FORMAT_INSTRUCTION } = await import('@/shared/markdown/math-format-instructions')
    const { TABLE_FORMAT_INSTRUCTION } = await import('@/shared/markdown/markdown-table-instructions')
    const _ttftDebug = process.env.TTFT_DEBUG === 'true'
    let _t0 = 0, _tAuth = 0, _tPrep = 0, _tTools = 0, _tStreamCall = 0
    if (_ttftDebug) _t0 = performance.now()
    const bodyResult = await readValidatedJson(request, context, ActConversationRequest)
    if (!bodyResult.ok) return bodyResult.response
    const {
      messages,
      systemPrompt,
      conversationId,
      turnId,
      modelId,
      indexedFileNames,
      indexedAttachments: rawIndexedAttachments,
      attachmentNames,
      replyContextForModel,
      historyBaseModelId,
      mode,
      automationMode,
      automationExecution,
      mediaToolIntent,
      requestedToolIds: rawRequestedToolIds,
      memoryEnabled: rawMemoryEnabled,
      actAbortTimeoutMs,
      streamPersistenceMode,
      mentions: rawMentions,
      /** Parallel multi-model: slot 0 = primary (full tools including Composio). Slots 1+ are compare-only. */
      multiModelSlotIndex: rawMultiModelSlotIndex,
      multiModelTotal: rawMultiModelTotal,
    } = bodyResult.data
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }
    const uiMessages = messages as UIMessage[]
    actWebhookSkip = automationExecution === true
    const { auth } = context
	    const userId = auth.userId
	    currentUserId = userId
    const accessToken = auth.accessToken || undefined
    const streamPersistence = resolveActStreamPersistence({
      requestedMode: streamPersistenceMode,
      verifiedCloudflareRelay: isVerifiedChatStreamRelayRequest(request),
    })
    const useCloudflareStreamRelay = streamPersistence.useCloudflareStreamRelay
    const resolvedStreamPersistenceMode = streamPersistence.mode
    if (streamPersistence.ignoredUnverifiedRelay) {
      logger.warn('[conversations/act] Ignoring unverified cloudflare-relay persistence request', {
        conversationId,
        turnId,
      })
    }
    logger.info('[conversations/act] streamPersistence', {
      mode: resolvedStreamPersistenceMode,
      conversationMode: mode,
      automationMode: automationMode === true,
      automationExecution: automationExecution === true,
      conversationId,
      turnId,
      variantIndex: rawMultiModelSlotIndex,
    })
    const effectiveModelId = resolveEffectiveActModelId(modelId)
    const serverSecret = getInternalApiSecret()
    const requestedToolIds = normalizeChatToolRequestIds(rawRequestedToolIds)
    const memoryEnabled = rawMemoryEnabled !== false

    const {
      appSettings,
      paid,
      runtimeEntitlements,
    } = await actEntitlementService.gateModelAccess({
      effectiveModelId,
      userId,
    })
    if (_ttftDebug) _tAuth = performance.now()

    const {
      latestUserContent,
      latestUserMessage,
      latestUserParts,
      latestUserText,
    } = actMessagePersistenceService.getLatestUserPersistence({
      messages: uiMessages,
      attachmentNames,
    })

    const cid = conversationId as Id<'conversations'> | undefined
    const tid = resolveActTurnId(turnId)
    actWebhookConversationId = cid
    actWebhookTurnId = tid

    const {
      isMultiModelFollowUpSlot,
      multiModelSlotIndex,
      multiModelTotal,
    } = resolveActMultiModelState({
      rawMultiModelSlotIndex,
      rawMultiModelTotal,
    })
    /** User message is persisted once (slot 0). Third-party (Composio) actions only on primary slot. */

    // P3.3: hoist Composio to Wave 1 — start before any await so it overlaps all prep work.
    // Cache in composio-tools.ts makes this ~0ms on repeat requests within 10 minutes.
    const toolPreloadTasks = preloadActExternalToolTasks({
      userId,
      accessToken,
      serverSecret,
    })

    // P3.2 Wave 1: user-message save + context fetches stay parallel.
    const saveUserMessageTask = actMessagePersistenceService.persistUserMessage({
      conversationId: cid,
      userId,
      turnId: tid,
      modelId: effectiveModelId,
      latestUserContent,
      latestUserText,
      latestUserParts,
      attachmentNames,
      skipMemoryExtraction: !memoryEnabled,
      skip: isMultiModelFollowUpSlot,
    })
    const turnContextTask = actContextService.loadTurnContext({
      accessToken,
      conversationId: cid,
      indexedAttachments: rawIndexedAttachments,
      indexedFileNames,
      latestUserText,
      memoryEnabled,
      mentions: rawMentions,
      serverSecret,
      userId,
    })
    const [, turnContext] = await Promise.all([saveUserMessageTask, turnContextTask])
    const {
      autoRetrieval,
      conversationProjectId,
      docContextBundle,
      hasPreloadedDocContext,
      indexedAttachmentList,
      memoryContext,
      mentionsContext,
      projectInstructions,
      skillsContext,
      sourceCitationMap,
    } = turnContext

    const structuredMediaToolIntent = normalizeStructuredMediaToolIntent(mediaToolIntent)
    const resolvedMediaToolIntent = isMultiModelFollowUpSlot
      ? null
      : paid
      ? (
          structuredMediaToolIntent ??
          await classifyMediaToolIntentForTurn({
            userText: latestUserText,
            userId,
            accessToken,
            entitlements: runtimeEntitlements,
          })
        )
      : null

    const indexedNote = hasPreloadedDocContext
      ? indexedFilesSystemNotePreloaded(indexedAttachmentList)
      : indexedFilesSystemNote(indexedAttachmentList)
    let messagesForModel = await actContextService.buildMessagesForModel({
      requestMessages: uiMessages,
      latestUserMessage,
      latestTurnId: tid,
      conversationId: cid,
      userId,
      targetModelId: effectiveModelId,
      historyBaseModelId,
    })
    messagesForModel = cloneMessagesWithIndexedFileHint(messagesForModel, indexedAttachmentList, hasPreloadedDocContext)
    messagesForModel = await actContextService.prepareExistingMessagesForModel({
      accessToken,
      conversationId: cid,
      historyBaseModelId,
      messages: messagesForModel,
      replyContextForModel,
      targetModelId: effectiveModelId,
      userId,
    })
    const userSystemPromptExtension = buildSecondarySystemPromptExtension(systemPrompt)

	    const modelMessages = await convertToModelMessages(messagesForModel)
	    // Declared before the primary LLM is chosen so the OpenRouter fetch callback can set it during calls.
	    let streamedRoutedModelId: string | undefined
	    const generatingMessageId = await actGeneratingMessageService.start({
      conversationId: cid,
      userId,
      turnId: tid,
      modelId: effectiveModelId,
      multiModelTotal,
      multiModelSlotIndex,
    })
    pendingGeneratingMessageId = generatingMessageId
	    if (_ttftDebug) _tPrep = performance.now()
    const actTooling = await prepareActTooling({
      accessToken,
      automationExecution: automationExecution === true,
      automationMode: automationMode === true,
      baseUrl: getInternalApiBaseUrl(request),
      conversationId,
      conversationProjectId,
      effectiveModelId,
      forwardCookie: request.headers.get('cookie'),
      isMultiModelFollowUpSlot,
      latestUserText,
      memoryEnabled,
      mediaToolIntent: resolvedMediaToolIntent,
      mode,
      paid,
      preloadTasks: toolPreloadTasks,
      requestedToolIds,
      serverSecret,
      turnId: tid,
      userId,
    })
    if (_ttftDebug) _tTools = performance.now()
    logActTooling(actTooling)
    const tools = actTooling.tools
    const actInstructions = buildActAgentInstructions({
      autoRetrieval,
      constants: {
        ACT_KNOWLEDGE_TOOLS_NOTE_NO_WEB,
        ACT_KNOWLEDGE_WEB_TOOLS_NOTE,
        ACT_PAID_PLAN_ACT_TOOLS_REALITY,
        FREE_TIER_NO_PAID_AGENT_CAPABILITIES,
        MATH_FORMAT_INSTRUCTION,
        MEMORY_SAVE_PROTOCOL,
        TABLE_FORMAT_INSTRUCTION,
      },
      docContextText: docContextBundle.contextText,
      effectiveModelId,
      exposedMediaTools: actTooling.exposedMediaTools,
      hasPreloadedDocContext,
      indexedNote,
      isMultiModelFollowUpSlot,
      memoryContext,
      memoryEnabled,
      mentionsContext,
      mode,
      paid,
      projectInstructions,
      requestedToolIds,
      skillsContext,
      userSystemPromptExtension,
      automationExecution: automationExecution === true,
      automationMode: automationMode === true,
    })

    const runActStream = async (params: {
      languageModel: LanguageModelV3
      modelId: string
      fallbackNotice?: string
    }) => {
    const attemptModelId = params.modelId
    const attemptModelSupportsZdr = modelSupportsZeroDataRetention(attemptModelId)
    const agent = new ToolLoopAgent({
      model: params.languageModel,
      tools,
      ...(attemptModelSupportsZdr
        ? { providerOptions: { gateway: { zeroDataRetention: true } } }
        : {}),
      stopWhen: stepCountIs(MAX_TOOL_STEPS_ACT),
      instructions: actInstructions,
    })

    const toolFailuresByCallId = new Map<string, { toolName: string; error: string }>()
    const finishedToolCallIds = new Set<string>()

    // Abort before Vercel's hard kill so onFinish can finalize gracefully.
    const actAbortTimeoutMsResolved = resolveActAbortTimeoutMs({
      requestedTimeoutMs: actAbortTimeoutMs,
      automationExecution: automationExecution === true,
    })
    let wasAbortedByTimeout = false
    const abortController = new AbortController()
    const hardTimeout = setTimeout(() => {
      wasAbortedByTimeout = true
      abortController.abort()
    }, actAbortTimeoutMsResolved)

    if (_ttftDebug) _tStreamCall = performance.now()
    let result: Awaited<ReturnType<typeof agent.stream>>
    try {
      result = await agent.stream({
      messages: modelMessages,
      abortSignal: abortController.signal,
      experimental_onToolCallStart: ({ toolCall }) => {
        if (!toolCall) return
        const n = toolCall.toolName
        if (n !== 'perplexity_search' && n !== 'parallel_search') return
        const input = toolCall.input as Record<string, unknown> | undefined
        logger.info(`[conversations/act] ${n} START`, {
          toolCallId: toolCall.toolCallId,
          input: summarizeToolInputForLog(input),
        })
      },
      experimental_onToolCallFinish: ({ toolCall, success, durationMs, output, error }) => {
        if (!toolCall?.toolName) return
        if (toolCall.toolCallId) finishedToolCallIds.add(toolCall.toolCallId)
        if (!success && toolCall.toolCallId) {
          toolFailuresByCallId.set(toolCall.toolCallId, {
            toolName: toolCall.toolName,
            error: summarizeErrorForLog(error),
          })
        }
        const n = toolCall.toolName
        if (n === 'perplexity_search' || n === 'parallel_search') {
          if (success) {
            logger.info(`[conversations/act] ${n} OK`, {
              toolCallId: toolCall.toolCallId,
              durationMs,
              output: summarizeToolOutputForLog(output),
            })
          } else {
            logger.error(`[conversations/act] ${n} FAILED`, {
              toolCallId: toolCall.toolCallId,
              durationMs,
              error: summarizeErrorForLog(error),
            })
          }
        }
        fireAndForgetRecordToolInvocation({
          serverSecret,
          userId,
          toolName: toolCall.toolName,
          mode: 'act',
          modelId: attemptModelId,
          conversationId: conversationId ?? undefined,
          turnId: tid,
          success,
          durationMs,
          error,
        })
      },
      onFinish: async (event) => {
        const totalUsage = event.totalUsage
        const totalInputTokens = totalUsage?.inputTokens ?? 0
        const totalOutputTokens = totalUsage?.outputTokens ?? 0
        // Fallback: if the fetch-interceptor did not capture the model yet, try the step response.
        if (attemptModelId === FREE_TIER_AUTO_MODEL_ID && !streamedRoutedModelId) {
          const rid = event.steps.at(-1)?.response.modelId
          if (typeof rid === 'string' && rid) streamedRoutedModelId = rid
        }
        const usageResult = await actUsageBudgetService.recordFinishedUsage({
          userId,
          modelId: attemptModelId,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          forceFreeTierLimits: !paid,
          reservationId: budgetReservationId,
        })
        budgetReservationId = usageResult.reservationId
        budgetReservationFinalized = usageResult.finalized

        await actMessagePersistenceService.persistAssistantFinish({
          accessToken,
          attemptModelId,
          conversationId: cid,
          emitWebhook: !actWebhookSkip,
          event,
          fallbackNotice: params.fallbackNotice,
          finishedToolCallIds,
          generatingMessageId,
          multiModelSlotIndex,
          multiModelTotal,
          routedModelId: streamedRoutedModelId,
          timedOut: wasAbortedByTimeout,
          timeoutMs: actAbortTimeoutMsResolved,
          toolFailuresByCallId,
          turnId: tid,
          userId,
        })
      },
      })
    } catch (err) {
      clearTimeout(hardTimeout)
      throw err
    }

    clearTimeout(hardTimeout)

    const hasCitations = Object.keys(sourceCitationMap).length > 0

    const _uiResp = result.toUIMessageStreamResponse({
      originalMessages: uiMessages,
      onError: (error: unknown) => userFacingOpenRouterError(error),
      messageMetadata: ({ part }) => {
        const metadata: Record<string, unknown> = {}
        if (hasCitations && (part.type === 'start' || part.type === 'finish')) {
          // Send early so the client can linkify **Sources:** while the reply streams.
          metadata.sourceCitations = sourceCitationMap
        }
        if (
          attemptModelId === FREE_TIER_AUTO_MODEL_ID &&
          part.type === 'finish' &&
          streamedRoutedModelId
        ) {
          metadata.routedModelId = streamedRoutedModelId
        }
        return Object.keys(metadata).length > 0 ? metadata : undefined
      },
    })
    let responseBody: ReadableStream<Uint8Array<ArrayBufferLike>> | null =
      prefixFallbackNoticeAfterStart(_uiResp.body, params.fallbackNotice)
    const responseHeaders = new Headers(_uiResp.headers)
    if (useCloudflareStreamRelay) {
      responseHeaders.set('x-overlay-generating-message-id', generatingMessageId ?? '')
      responseHeaders.set('x-overlay-auth-user-id', userId)
      responseHeaders.set('x-overlay-stream-persistence-mode', resolvedStreamPersistenceMode)
    }
    if (responseBody) {
      if (resolvedStreamPersistenceMode === 'convex-deltas') {
        responseBody = responseBody.pipeThrough(
          actGeneratingMessageService.createPersistenceTransform({
            messageId: generatingMessageId,
          }),
        ) as ReadableStream<Uint8Array<ArrayBufferLike>>
        const [clientBody, backgroundBody] = responseBody.tee()
        responseBody = clientBody
        after(async () => {
          try {
            await drainReadableStream(backgroundBody)
          } catch (err) {
            logger.error('[conversations/act] Background stream drain failed:', summarizeErrorForLog(err))
            if (budgetReservationId && !budgetReservationFinalized) {
              await actUsageBudgetService.releaseReservation({
                userId,
                reservationId: budgetReservationId,
                reason: summarizeErrorForLog(err),
              }).catch((releaseErr) => logger.error('[conversations/act] Failed to release budget reservation:', summarizeErrorForLog(releaseErr)))
              budgetReservationId = null
            }
            await actGeneratingMessageService.fail({
              conversationId: actWebhookConversationId,
              emitWebhook: !actWebhookSkip,
              error: err,
              messageId: generatingMessageId,
              turnId: actWebhookTurnId,
              userId,
            })
          }
        })
      }
    }
    if (_ttftDebug && responseBody) {
      const _decoder = new TextDecoder()
      let _buf = ''
      let _firstByteAt = 0
      let _firstEventAt = 0
      let _deltaLogged = false
      const _transform = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          if (!_deltaLogged) {
            if (_firstByteAt === 0) _firstByteAt = performance.now()
            _buf += _decoder.decode(chunk, { stream: true })
            // First meaningful UI-message-stream frame: tool-*, text*, or reasoning*
            // (skips the initial "start" and "start-step" scaffolding frames).
            if (_firstEventAt === 0 && /"type"\s*:\s*"(tool-|text|reasoning)/.test(_buf)) {
              _firstEventAt = performance.now()
            }
            // First actual text frame ("text" or "text-delta") — true first-token moment.
            if (/"type"\s*:\s*"text(?:-delta)?"/.test(_buf)) {
              _deltaLogged = true
              _buf = '' // release
              const _tDelta = performance.now()
              logger.info('[TTFT][act]', {
                model: attemptModelId,
                total_ms: +(_tDelta - _t0).toFixed(1),
                auth_ms: +(_tAuth - _t0).toFixed(1),
                prep_ms: +(_tPrep - _tAuth).toFixed(1),
                tools_ms: +(_tTools - _tPrep).toFixed(1),
                streamCall_ms: +(_tStreamCall - _tTools).toFixed(1),
                firstByte_ms: +(_firstByteAt - _tStreamCall).toFixed(1),
                firstEvent_ms: _firstEventAt
                  ? +(_firstEventAt - _tStreamCall).toFixed(1)
                  : null,
                firstDelta_ms: +(_tDelta - _tStreamCall).toFixed(1),
              })
            } else if (_buf.length > 8192) {
              // Keep only the tail so the regex can still match across chunks without unbounded growth.
              _buf = _buf.slice(-1024)
            }
          }
          controller.enqueue(chunk)
        },
      })
      return new Response(responseBody.pipeThrough(_transform), {
        status: _uiResp.status,
        headers: responseHeaders,
      })
    }
    return new Response(responseBody, {
      status: _uiResp.status,
      headers: responseHeaders,
    })
    }

    const estimatedInputTokens = Math.ceil(JSON.stringify(modelMessages).length / 4) + 2_000
    const maxOutputTokens = 8_192
    const reserveBudgetForAttempt = async (attemptModelId: string): Promise<NextResponse | null> => {
      streamedRoutedModelId = undefined
      const reservation = await actUsageBudgetService.reserveForAttempt({
        userId,
        entitlements: runtimeEntitlements,
        modelId: attemptModelId,
        paid,
        estimatedInputTokens,
        maxOutputTokens,
      })
      if (!reservation.ok) {
        return NextResponse.json(reservation.failure.payload, { status: reservation.failure.statusCode })
      }
      budgetReservationId = reservation.reservationId
      budgetReservationFinalized = false
      return null
    }

    const languageModelForAttempt = async (attemptModelId: string): Promise<LanguageModelV3> => {
      if (isNvidiaNimChatModelId(attemptModelId)) {
        const nvidiaKey = await resolveNvidiaApiKey(accessToken)
        if (!nvidiaKey) {
          throw new Error('NVIDIA_API_KEY is not configured.')
        }
        streamedRoutedModelId = attemptModelId
        return createNvidiaNimChatLanguageModel(attemptModelId, nvidiaKey)
      }

      if (attemptModelId === FREE_TIER_AUTO_MODEL_ID) {
        return getOpenRouterLanguageModelCapturingRoutedModel(
          FREE_TIER_AUTO_MODEL_ID,
          accessToken,
          (m) => { streamedRoutedModelId = m },
        )
      }

      return getLanguageModel(attemptModelId, accessToken)
    }

    const fallbackModelIds = getChatModelFallbackCandidates({
      modelId: effectiveModelId,
      paid,
      onlyAllowZdrModels: paid && appSettings?.onlyAllowZdrModels === true,
      requiresVision: messagesRequireVision(uiMessages),
      maxCandidates: MAX_ACT_MODEL_ATTEMPTS - 1,
    })
    const attemptModelIds = [...new Set([effectiveModelId, ...fallbackModelIds])].slice(0, MAX_ACT_MODEL_ATTEMPTS)
    return await runActModelAttempts({
      attemptModelIds,
      reserveBudgetForAttempt,
      onFallback: (from, to) => {
        logger.warn('[conversations/act] model fallback', { from, to })
      },
      onAttemptFailure: async (error, attemptModelId, hasFallback) => {
        logger.warn('[conversations/act] model attempt failed', {
          modelId: attemptModelId,
          hasFallback,
          error: summarizeErrorForLog(error),
        })
        if (budgetReservationId && !budgetReservationFinalized) {
          await actUsageBudgetService.releaseReservation({
            userId,
            reservationId: budgetReservationId,
            reason: summarizeErrorForLog(error),
          }).catch((releaseErr) => logger.error('[conversations/act] Failed to release budget reservation:', summarizeErrorForLog(releaseErr)))
          budgetReservationId = null
        }
      },
      runAttempt: async ({ attemptModelId, fallbackNotice }) => {
        streamedRoutedModelId = undefined
        const languageModel = await languageModelForAttempt(attemptModelId)
        return await runActStream({
          languageModel,
          modelId: attemptModelId,
          fallbackNotice,
        })
      },
    })
	  } catch (error) {
    const serviceResponse = actConversationErrorResponse(error)
    if (serviceResponse) return serviceResponse
	    logger.error('[conversations/act] Error:', summarizeErrorForLog(error))
	    if (budgetReservationId && !budgetReservationFinalized) {
	      await actUsageBudgetService.releaseReservation({
	        userId: currentUserId ?? 'unknown',
	        reservationId: budgetReservationId,
	        reason: summarizeErrorForLog(error),
	      }).catch((releaseErr) => logger.error('[conversations/act] Failed to release budget reservation:', summarizeErrorForLog(releaseErr)))
	      budgetReservationId = null
	    }
	    await actGeneratingMessageService.fail({
      conversationId: actWebhookConversationId,
      emitWebhook: !actWebhookSkip,
      error,
      messageId: pendingGeneratingMessageId,
      turnId: actWebhookTurnId,
      userId: currentUserId,
    })
    return NextResponse.json(
      { error: userFacingOpenRouterError(error) },
      { status: 500 },
    )
  }
}
