import { NextRequest } from 'next/server'
import { experimental_generateVideo as generateVideo } from 'ai'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { getGatewayVideoModel } from '@/lib/ai-gateway'
import { VIDEO_MODELS } from '@/lib/models'
import { calculateVideoCost } from '@/lib/model-pricing'

export const maxDuration = 300

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
}

function sseChunk(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { prompt, modelId, aspectRatio, duration, chatId, agentId }: {
    prompt: string
    modelId?: string
    aspectRatio?: string
    duration?: number
    chatId?: string
    agentId?: string
  } = await request.json()

  if (!prompt?.trim()) {
    return new Response('Prompt is required', { status: 400 })
  }

  const userId = session.user.id

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (s: string) => new TextEncoder().encode(s)

      try {
        // ── Subscription enforcement ────────────────────────────────────────
        const entitlements = await convex.query<Entitlements>('usage:getEntitlements', {
          accessToken: session.accessToken,
          userId,
        })

        if (entitlements) {
          const { tier, creditsUsed, creditsTotal } = entitlements
          if (tier === 'free') {
            controller.enqueue(encode(sseChunk({ type: 'error', error: 'generation_not_allowed', message: 'Video generation requires a Pro subscription.' })))
            controller.close()
            return
          }
          const remainingCents = creditsTotal * 100 - creditsUsed
          if (remainingCents <= 0) {
            controller.enqueue(encode(sseChunk({ type: 'error', error: 'insufficient_credits', message: 'No credits remaining. Please top up your account.' })))
            controller.close()
            return
          }
        }

        // ── Create pending output record ────────────────────────────────────
        let outputId: string | null = null
        try {
          outputId = await convex.mutation('outputs:create', {
            userId,
            type: 'video',
            status: 'pending',
            prompt: prompt.trim(),
            modelId: modelId ?? VIDEO_MODELS[0].id,
            chatId,
            agentId,
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
              status: 'failed',
              errorMessage: lastError?.message ?? 'All models failed',
            }).catch(() => {})
          }
          controller.enqueue(encode(sseChunk({ type: 'failed', outputId, error: 'All video models failed. Please try again.' })))
          controller.close()
          return
        }

        const dataUrl = `data:video/mp4;base64,${videoBase64}`

        // ── Update Convex record to completed ────────────────────────────────
        try {
          await convex.mutation('outputs:update', {
            outputId,
            status: 'completed',
            url: dataUrl,
            modelId: usedModelId,
          })
        } catch (err) {
          console.error('[GenerateVideo] Failed to update output:', err)
        }

        // ── Usage tracking ────────────────────────────────────────────────────
        const costDollars = calculateVideoCost(usedModelId, effectiveDuration)
        const costCents = Math.round(costDollars * 100)
        if (costCents > 0) {
          convex.mutation('usage:recordBatch', {
            accessToken: session.accessToken,
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
          }).catch((err) => console.error('[GenerateVideo] Failed to record usage:', err))
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
