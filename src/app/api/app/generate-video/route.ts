import { NextRequest } from 'next/server'
import { experimental_generateVideo as generateVideo } from 'ai'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { convex } from '@/lib/convex'
import { getGatewayVideoModel } from '@/lib/ai-gateway'
import type { VideoSubMode } from '@/lib/model-types'
import { getVideoModelsBySubMode } from '@/lib/model-data'
import { calculateVideoCostOrNull } from '@/lib/model-pricing'
import { uploadBuffer, keyForOutput, deleteObject } from '@/lib/r2'
import { checkGlobalR2Budget, R2GlobalBudgetError } from '@/lib/r2-budget'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import type { Entitlements } from '@/lib/app-contracts'
import {
  buildInsufficientCreditsPayload,
  billableBudgetCentsFromProviderUsd,
  ensureBudgetAvailable,
  getBudgetTotals,
  isPaidPlan,
} from '@/lib/billing-runtime'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 300

function sseChunk(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(request: NextRequest) {
  const { prompt, modelId, aspectRatio, duration, conversationId, turnId, videoSubMode, imageUrl, accessToken, userId }: {
    prompt: string
    modelId?: string
    aspectRatio?: string
    duration?: number
    conversationId?: string
    turnId?: string
    videoSubMode?: VideoSubMode
    imageUrl?: string | null
    accessToken?: string
    userId?: string
  } = await request.json()

  const auth = await resolveAuthenticatedAppUser(request, { accessToken, userId })
  if (!auth) {
    return new Response('Unauthorized', { status: 401 })
  }

  const rateLimitResponse = await enforceRateLimits(request, [
    { bucket: 'generation:video:ip', key: getClientIp(request), limit: 20, windowMs: 10 * 60_000 },
    { bucket: 'generation:video:user', key: auth.userId, limit: 10, windowMs: 10 * 60_000 },
  ])
  if (rateLimitResponse) return rateLimitResponse

  if (!prompt?.trim()) {
    return new Response('Prompt is required', { status: 400 })
  }
  const effectiveSubMode: VideoSubMode = videoSubMode ?? 'text-to-video'
  const allowedModels = getVideoModelsBySubMode(effectiveSubMode).map((m) => m.id)
  const selectedModelId = modelId ?? allowedModels[0]
  if (!selectedModelId || !allowedModels.includes(selectedModelId)) {
    return new Response('Unsupported video model for this mode', { status: 400 })
  }

  const serverSecret = getInternalApiSecret()

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (s: string) => new TextEncoder().encode(s)
      let outputId: string | null = null
      let uploadedR2Key: string | null = null
      let reservedBudgetCents = 0

      const markOutputFailed = async (errorMessage: string) => {
        if (!outputId) return
        await convex.mutation(
          'outputs:update',
          {
            outputId,
            userId: auth.userId,
            serverSecret,
            status: 'failed',
            errorMessage,
          },
          { throwOnError: true },
        ).catch(() => {})
      }
      const releaseReservedBudget = async () => {
        if (reservedBudgetCents <= 0) return
        const amount = reservedBudgetCents
        reservedBudgetCents = 0
        await convex.mutation('usage:adjustBudgetByServer', {
          serverSecret,
          userId: auth.userId,
          amountCents: -amount,
        }).catch(() => {})
      }

      try {
        // ── Subscription enforcement ────────────────────────────────────────
        const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
          serverSecret,
          userId: auth.userId,
        })

        if (!entitlements) {
          controller.enqueue(
            encode(
              sseChunk({
                type: 'error',
                error: 'unauthorized',
                message: 'Could not verify subscription. Try signing out and back in.',
              }),
            ),
          )
          controller.close()
          return
        }

        const rawDuration = duration ?? 8
        // Clamp duration to model-supported ranges before any cost calculation or API call.
        // Veo models only accept 4, 6, or 8 seconds for text-to-video.
        // Seedance v1.5 Pro accepts 4–12 seconds.
        // Other models: cap at 10 seconds to stay within reasonable API limits.
        function clampDurationForModel(modelId: string, d: number): number {
          if (modelId.startsWith('google/veo')) {
            const veoOptions = [4, 6, 8]
            return veoOptions.reduce((prev, curr) => Math.abs(curr - d) < Math.abs(prev - d) ? curr : prev)
          }
          if (modelId.startsWith('bytedance/seedance')) {
            return Math.min(12, Math.max(4, d))
          }
          return Math.min(10, Math.max(3, d))
        }
        const effectiveDuration = clampDurationForModel(selectedModelId, rawDuration)
        const estimatedProviderCostUsd = calculateVideoCostOrNull(selectedModelId, effectiveDuration)
        if (estimatedProviderCostUsd == null) {
          controller.enqueue(encode(sseChunk({ type: 'error', error: 'pricing_missing', message: 'This video model is not configured for billing.' })))
          controller.close()
          return
        }
        const minimumRequiredCents = billableBudgetCentsFromProviderUsd(estimatedProviderCostUsd)
        let currentEntitlements = entitlements
        let budget = getBudgetTotals(currentEntitlements)
        const usedPct = budget.totalCents > 0 ? ((budget.usedCents / budget.totalCents) * 100).toFixed(2) : '0.00'
        console.log(`[GenerateVideo] 📊 Entitlements: tier=${currentEntitlements.tier} | used=${budget.usedCents}¢ / ${budget.totalCents}¢ (${usedPct}% used, $${(budget.remainingCents / 100).toFixed(4)} remaining) | userId=${auth.userId}`)
        if (!isPaidPlan(currentEntitlements)) {
          controller.enqueue(encode(sseChunk({ type: 'error', error: 'generation_not_allowed', message: 'Video generation requires a paid plan.' })))
          controller.close()
          return
        }
        if (budget.remainingCents < minimumRequiredCents) {
          const autoTopUp = await ensureBudgetAvailable({
            userId: auth.userId,
            entitlements: currentEntitlements,
            minimumRequiredCents,
          })
          currentEntitlements = autoTopUp.entitlements
          budget = getBudgetTotals(currentEntitlements)
        }
        if (budget.remainingCents < minimumRequiredCents) {
          controller.enqueue(encode(sseChunk({
            type: 'error',
            ...buildInsufficientCreditsPayload(currentEntitlements, 'Not enough budget remaining to generate this video. Please top up your account.'),
          })))
          controller.close()
          return
        }
        if ((currentEntitlements.overlayStorageBytesUsed ?? 0) >= (currentEntitlements.overlayStorageBytesLimit ?? 0)) {
          controller.enqueue(encode(sseChunk({ type: 'error', error: 'storage_limit_exceeded', message: 'Overlay storage limit reached. Delete files or outputs, or upgrade your plan.' })))
          controller.close()
          return
        }
        await convex.mutation('usage:adjustBudgetByServer', {
          serverSecret,
          userId: auth.userId,
          amountCents: minimumRequiredCents,
        })
        reservedBudgetCents = minimumRequiredCents

        // ── Create pending output record ────────────────────────────────────
        try {
          outputId = await convex.mutation<string>(
            'outputs:create',
            {
              userId: auth.userId,
              serverSecret,
              type: 'video',
              source: 'video_generation',
              status: 'pending',
              prompt: prompt.trim(),
              modelId: selectedModelId,
              fileName: `overlay-video-${Date.now()}.mp4`,
              mimeType: 'video/mp4',
              ...(conversationId ? { conversationId } : {}),
              ...(turnId ? { turnId } : {}),
            },
            { throwOnError: true },
          )
        } catch (err) {
          console.error('[GenerateVideo] Failed to create output record:', err)
          await releaseReservedBudget()
          controller.enqueue(encode(sseChunk({ type: 'error', error: 'save_failed', message: 'Could not create the output record.' })))
          controller.close()
          return
        }
        if (!outputId) {
          await releaseReservedBudget()
          controller.enqueue(encode(sseChunk({ type: 'error', error: 'save_failed', message: 'Could not create the output record.' })))
          controller.close()
          return
        }
        const persistedOutputId = outputId

        // ── Signal to client that we started ─────────────────────────────────
        controller.enqueue(encode(sseChunk({ type: 'started', outputId: persistedOutputId })))

        // ── Model fallback chain ────────────────────────────────────────────
        const subModeModels = allowedModels
        const priorityList = [selectedModelId, ...subModeModels.filter((id) => id !== selectedModelId)]

        let lastError: Error | null = null
        let usedModelId: string | null = null
        let videoBase64: string | null = null
        for (const tryModelId of priorityList) {
          try {
            const videoModel = await getGatewayVideoModel(
              tryModelId,
              auth.accessToken || undefined,
            )

            const modelDuration = clampDurationForModel(tryModelId, rawDuration)
            let result: Awaited<ReturnType<typeof generateVideo>>
            if (effectiveSubMode === 'image-to-video') {
              result = await generateVideo({
                model: videoModel,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                prompt: { text: prompt.trim(), image: imageUrl } as any,
                duration: modelDuration,
                aspectRatio: (aspectRatio as `${number}:${number}` | undefined) ?? '16:9',
              })
            } else if (effectiveSubMode === 'reference-to-video') {
              result = await generateVideo({
                model: videoModel,
                prompt: prompt.trim(),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                providerOptions: { alibaba: { referenceUrls: imageUrl ? [imageUrl] : [] } } as any,
              })
            } else if (effectiveSubMode === 'motion-control') {
              result = await generateVideo({
                model: videoModel,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                prompt: { image: imageUrl, text: prompt.trim() } as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                providerOptions: { klingai: { videoUrl: imageUrl, characterOrientation: 'video', mode: 'std' } } as any,
              })
            } else if (effectiveSubMode === 'video-editing') {
              result = await generateVideo({
                model: videoModel,
                prompt: prompt.trim(),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                providerOptions: { xai: { videoUrl: imageUrl, pollTimeoutMs: 600000 } } as any,
              })
            } else {
              // text-to-video (default)
              result = await generateVideo({
                model: videoModel,
                prompt: prompt.trim(),
                duration: modelDuration,
                aspectRatio: (aspectRatio as `${number}:${number}` | undefined) ?? '16:9',
              })
            }

            videoBase64 = result.videos[0]?.base64 ?? null
            usedModelId = tryModelId
            break
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err))
            console.error(`[GenerateVideo] Model ${tryModelId} failed:`, lastError.message)
            continue
          }
        }

        if (!videoBase64 || !usedModelId) {
          // Update Convex record to failed
          await markOutputFailed(lastError?.message ?? 'All models failed')
          await releaseReservedBudget()
          controller.enqueue(encode(sseChunk({ type: 'failed', outputId, error: 'All video models failed. Please try again.' })))
          controller.close()
          return
        }

        const dataUrl = `data:video/mp4;base64,${videoBase64}`
        const videoBuffer = Buffer.from(videoBase64!, 'base64')

        // ── Check per-user storage quota ────────────────────────────────────────
        if ((currentEntitlements.overlayStorageBytesUsed ?? 0) + videoBuffer.length > (currentEntitlements.overlayStorageBytesLimit ?? 0)) {
          await markOutputFailed('Not enough Overlay storage remaining for this video.')
          await releaseReservedBudget()
          controller.enqueue(encode(sseChunk({ type: 'error', error: 'storage_limit_exceeded', message: 'Not enough Overlay storage remaining for this video.' })))
          controller.close()
          return
        }

        // ── Upload to R2 ─────────────────────────────────────────────────────────
        let r2Key: string | null = null
        try {
          const fileName = `overlay-video-${Date.now()}.mp4`
          const key = keyForOutput(auth.userId, persistedOutputId, fileName)
          await checkGlobalR2Budget(videoBuffer.length)
          await uploadBuffer(key, videoBuffer, 'video/mp4')
          r2Key = key
          uploadedR2Key = key
          console.log(`[GenerateVideo] ✅ Uploaded ${videoBuffer.length}B to R2 key=${key}`)
        } catch (err) {
          console.error('[GenerateVideo] Failed to upload to R2:', err)
          await markOutputFailed(err instanceof Error ? err.message : 'Failed to upload video')
          if (err instanceof R2GlobalBudgetError) {
            await releaseReservedBudget()
            controller.enqueue(encode(sseChunk({ type: 'error', error: 'storage_limit_exceeded', message: 'Global R2 storage cap reached. Contact support.' })))
            controller.close()
            return
          }
          await releaseReservedBudget()
          controller.enqueue(encode(sseChunk({ type: 'failed', outputId, error: 'Failed to save generated video.' })))
          controller.close()
          return
        }

        // ── Update Convex record to completed ───────────────────────────────────────
        try {
          await convex.mutation(
            'outputs:update',
            {
              outputId: persistedOutputId,
              userId: auth.userId,
              serverSecret,
              status: 'completed',
              modelId: usedModelId,
              sizeBytes: videoBuffer.length,
              ...(r2Key ? { r2Key } : {}),
            },
            { throwOnError: true },
          )
        } catch (err) {
          console.error('[GenerateVideo] Failed to update output:', err)
          if (uploadedR2Key) {
            await deleteObject(uploadedR2Key).catch(() => {})
          }
          await markOutputFailed(err instanceof Error ? err.message : 'Failed to finalize output record')
          if (err instanceof Error && err.message.includes('storage_limit_exceeded')) {
            await releaseReservedBudget()
            controller.enqueue(encode(sseChunk({ type: 'error', error: 'storage_limit_exceeded', message: 'Not enough Overlay storage remaining for this video.' })))
            controller.close()
            return
          }
          await releaseReservedBudget()
          controller.enqueue(encode(sseChunk({ type: 'failed', outputId, error: 'Failed to save generated video.' })))
          controller.close()
          return
        }

        // ── Usage tracking ────────────────────────────────────────────────────────
        const costDollars = calculateVideoCostOrNull(usedModelId, effectiveDuration)
        if (costDollars == null) {
          throw new Error(`Missing video pricing for ${usedModelId}`)
        }
        const costCents = billableBudgetCentsFromProviderUsd(costDollars)
        const adjustmentCents = costCents - reservedBudgetCents
        if (adjustmentCents !== 0) {
          await convex.mutation('usage:adjustBudgetByServer', {
            serverSecret,
            userId: auth.userId,
            amountCents: adjustmentCents,
          })
        }
        reservedBudgetCents = 0
        console.log(`[GenerateVideo] 💰 Cost: model=${usedModelId} | duration=${effectiveDuration}s | provider=$${costDollars.toFixed(4)} billed=${costCents}¢`)

        controller.enqueue(encode(sseChunk({ type: 'completed', outputId, url: dataUrl, modelUsed: usedModelId })))
        controller.close()
      } catch (error) {
        console.error('[GenerateVideo] Unexpected error:', error)
        await markOutputFailed(error instanceof Error ? error.message : 'Unexpected error during video generation.')
        await releaseReservedBudget()
        controller.enqueue(encode(sseChunk({ type: 'failed', error: 'Unexpected error during video generation.' })))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
