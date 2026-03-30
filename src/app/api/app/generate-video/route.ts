import { NextRequest } from 'next/server'
import { experimental_generateVideo as generateVideo } from 'ai'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { getGatewayVideoModel } from '@/lib/ai-gateway'
import { VIDEO_MODELS } from '@/lib/models'
import { calculateVideoCost } from '@/lib/model-pricing'
import { uploadBuffer, keyForOutput, deleteObject } from '@/lib/r2'
import { checkGlobalR2Budget, R2GlobalBudgetError } from '@/lib/r2-budget'

export const maxDuration = 300

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
  overlayStorageBytesUsed: number
  overlayStorageBytesLimit: number
}

function sseChunk(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { prompt, modelId, aspectRatio, duration, conversationId, turnId }: {
    prompt: string
    modelId?: string
    aspectRatio?: string
    duration?: number
    conversationId?: string
    turnId?: string
  } = await request.json()

  if (!prompt?.trim()) {
    return new Response('Prompt is required', { status: 400 })
  }

  const userId = session.user.id
  const serverSecret = getInternalApiSecret()

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (s: string) => new TextEncoder().encode(s)

      try {
        // ── Subscription enforcement ────────────────────────────────────────
        const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
          serverSecret,
          userId,
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

        const { tier, creditsUsed, creditsTotal } = entitlements
        const creditsTotalCents = creditsTotal * 100
        const remainingCents = creditsTotalCents - creditsUsed
        const usedPct = creditsTotalCents > 0 ? ((creditsUsed / creditsTotalCents) * 100).toFixed(2) : '0.00'
        console.log(`[GenerateVideo] 📊 Entitlements: tier=${tier} | used=${creditsUsed}¢ / ${creditsTotalCents}¢ (${usedPct}% used, $${(remainingCents / 100).toFixed(4)} remaining) | userId=${userId}`)
        if (tier === 'free') {
          controller.enqueue(encode(sseChunk({ type: 'error', error: 'generation_not_allowed', message: 'Video generation requires a Pro subscription.' })))
          controller.close()
          return
        }
        if (remainingCents <= 0) {
          controller.enqueue(encode(sseChunk({ type: 'error', error: 'insufficient_credits', message: 'No credits remaining. Please top up your account.' })))
          controller.close()
          return
        }
        if (entitlements.overlayStorageBytesUsed >= entitlements.overlayStorageBytesLimit) {
          controller.enqueue(encode(sseChunk({ type: 'error', error: 'storage_limit_exceeded', message: 'Overlay storage limit reached. Delete files or outputs, or upgrade your plan.' })))
          controller.close()
          return
        }

        // ── Create pending output record ────────────────────────────────────
        let outputId: string | null = null
        try {
          outputId = await convex.mutation('outputs:create', {
            userId,
            serverSecret,
            type: 'video',
            source: 'video_generation',
            status: 'pending',
            prompt: prompt.trim(),
            modelId: modelId ?? VIDEO_MODELS[0].id,
            fileName: `overlay-video-${Date.now()}.mp4`,
            mimeType: 'video/mp4',
            ...(conversationId ? { conversationId } : {}),
            ...(turnId ? { turnId } : {}),
          })
        } catch (err) {
          console.error('[GenerateVideo] Failed to create output record:', err)
        }

        // ── Signal to client that we started ─────────────────────────────────
        controller.enqueue(encode(sseChunk({ type: 'started', outputId })))

        // ── Model fallback chain ────────────────────────────────────────────
        const priorityList = modelId
          ? [modelId, ...VIDEO_MODELS.map((m) => m.id).filter((id) => id !== modelId)]
          : VIDEO_MODELS.map((m) => m.id)

        let lastError: Error | null = null
        let usedModelId: string | null = null
        let videoBase64: string | null = null
        const effectiveDuration = duration ?? 8

        for (const tryModelId of priorityList) {
          try {
            const videoModel = await getGatewayVideoModel(tryModelId, session.accessToken)
            const result = await generateVideo({
              model: videoModel,
              prompt: prompt.trim(),
              duration: effectiveDuration,
              aspectRatio: (aspectRatio as `${number}:${number}` | undefined) ?? '16:9',
            })
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
          if (outputId) {
            await convex.mutation('outputs:update', {
              outputId,
              userId,
              serverSecret,
              status: 'failed',
              errorMessage: lastError?.message ?? 'All models failed',
            }).catch(() => {})
          }
          controller.enqueue(encode(sseChunk({ type: 'failed', outputId, error: 'All video models failed. Please try again.' })))
          controller.close()
          return
        }

        const dataUrl = `data:video/mp4;base64,${videoBase64}`
        const videoBuffer = Buffer.from(videoBase64!, 'base64')

        // ── Check per-user storage quota ────────────────────────────────────────
        if (entitlements.overlayStorageBytesUsed + videoBuffer.length > entitlements.overlayStorageBytesLimit) {
          controller.enqueue(encode(sseChunk({ type: 'error', error: 'storage_limit_exceeded', message: 'Not enough Overlay storage remaining for this video.' })))
          controller.close()
          return
        }

        // ── Upload to R2 ─────────────────────────────────────────────────────────
        let r2Key: string | null = null
        try {
          const fileName = `overlay-video-${Date.now()}.mp4`
          const key = keyForOutput(userId, outputId ?? `tmp-${Date.now()}`, fileName)
          await checkGlobalR2Budget(videoBuffer.length)
          await uploadBuffer(key, videoBuffer, 'video/mp4')
          r2Key = key
          console.log(`[GenerateVideo] ✅ Uploaded ${videoBuffer.length}B to R2 key=${key}`)
        } catch (err) {
          console.error('[GenerateVideo] Failed to upload to R2:', err)
          if (err instanceof R2GlobalBudgetError) {
            controller.enqueue(encode(sseChunk({ type: 'error', error: 'storage_limit_exceeded', message: 'Global R2 storage cap reached. Contact support.' })))
            controller.close()
            return
          }
        }

        // ── Update Convex record to completed ───────────────────────────────────────
        try {
          await convex.mutation('outputs:update', {
            outputId,
            userId,
            serverSecret,
            status: 'completed',
            modelId: usedModelId,
            sizeBytes: videoBuffer.length,
            ...(r2Key ? { r2Key } : {}),
          })
        } catch (err) {
          console.error('[GenerateVideo] Failed to update output:', err)
          if (r2Key) {
            await deleteObject(r2Key).catch(() => {})
          }
          if (err instanceof Error && err.message.includes('storage_limit_exceeded')) {
            controller.enqueue(encode(sseChunk({ type: 'error', error: 'storage_limit_exceeded', message: 'Not enough Overlay storage remaining for this video.' })))
            controller.close()
            return
          }
        }

        // ── Usage tracking ────────────────────────────────────────────────────────
        const costDollars = calculateVideoCost(usedModelId, effectiveDuration)
        const costCents = Math.round(costDollars * 100)
        console.log(`[GenerateVideo] 💰 Cost: model=${usedModelId} | duration=${effectiveDuration}s | $${costDollars.toFixed(4)} = ${costCents}¢`)
        if (costCents > 0) {
          const recordResult = await convex.mutation('usage:recordBatch', {
            serverSecret,
            userId,
            events: [{
              type: 'generation',
              modelId: usedModelId,
              inputTokens: 0,
              outputTokens: 0,
              cachedTokens: 0,
              cost: costCents,
              timestamp: Date.now(),
            }],
          })
          if (recordResult) {
            const updated = await convex.query<Entitlements>('usage:getEntitlementsByServer', { serverSecret, userId })
            if (updated) {
              const totalCents = updated.creditsTotal * 100
              const usedPct = totalCents > 0 ? ((updated.creditsUsed / totalCents) * 100).toFixed(2) : '0.00'
              console.log(`[GenerateVideo] ✅ Usage recorded | new state: ${updated.creditsUsed}¢ / ${totalCents}¢ (${usedPct}% used, $${((totalCents - updated.creditsUsed) / 100).toFixed(4)} remaining)`)
            }
          } else {
            console.error(`[GenerateVideo] ❌ recordBatch returned null — check server logs for Convex error`)
          }
        } else {
          console.log(`[GenerateVideo] ⚠️  Cost is 0¢ for model=${usedModelId} — usage not recorded`)
        }

        controller.enqueue(encode(sseChunk({ type: 'completed', outputId, url: dataUrl, modelUsed: usedModelId })))
        controller.close()
      } catch (error) {
        console.error('[GenerateVideo] Unexpected error:', error)
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
