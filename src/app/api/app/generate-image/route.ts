import { NextRequest, NextResponse } from 'next/server'
import { generateImage } from 'ai'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { getGatewayImageModel } from '@/lib/ai-gateway'
import { IMAGE_MODELS } from '@/lib/models'
import { calculateImageCost } from '@/lib/model-pricing'

export const maxDuration = 120

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { prompt, modelId, aspectRatio, chatId, agentId }: {
      prompt: string
      modelId?: string
      aspectRatio?: string
      chatId?: string
      agentId?: string
    } = await request.json()

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const userId = session.user.id

    // ── Subscription enforcement ──────────────────────────────────────────────
    const entitlements = await convex.query<Entitlements>('usage:getEntitlements', {
      accessToken: session.accessToken,
      userId,
    })

    if (entitlements) {
      const { tier, creditsUsed, creditsTotal } = entitlements
      if (tier === 'free') {
        return NextResponse.json(
          { error: 'generation_not_allowed', message: 'Image generation requires a Pro subscription.' },
          { status: 403 }
        )
      }
      const remainingCents = creditsTotal * 100 - creditsUsed
      if (remainingCents <= 0) {
        return NextResponse.json(
          { error: 'insufficient_credits', message: 'No credits remaining. Please top up your account.' },
          { status: 402 }
        )
      }
    }

    // ── Model fallback chain ──────────────────────────────────────────────────
    const priorityList = modelId
      ? [modelId, ...IMAGE_MODELS.map((m) => m.id).filter((id) => id !== modelId)]
      : IMAGE_MODELS.map((m) => m.id)

    let lastError: Error | null = null
    let usedModelId: string | null = null
    let imageBase64: string | null = null

    for (const tryModelId of priorityList) {
      try {
        const imageModel = await getGatewayImageModel(tryModelId, session.accessToken)
        const result = await generateImage({
          model: imageModel,
          prompt: prompt.trim(),
          aspectRatio: (aspectRatio as `${number}:${number}` | undefined) ?? '1:1',
        })
        imageBase64 = result.image.base64
        usedModelId = tryModelId
        break
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.error(`[GenerateImage] Model ${tryModelId} failed:`, lastError.message)
        continue
      }
    }

    if (!imageBase64 || !usedModelId) {
      console.error('[GenerateImage] All models failed. Last error:', lastError?.message)
      return NextResponse.json(
        { error: 'generation_failed', message: 'Image generation failed. Please try again.' },
        { status: 500 }
      )
    }

    const dataUrl = `data:image/png;base64,${imageBase64}`

    // ── Save to Convex outputs ────────────────────────────────────────────────
    let outputId: string | null = null
    try {
      outputId = await convex.mutation('outputs:create', {
        userId,
        type: 'image',
        status: 'completed',
        prompt: prompt.trim(),
        modelId: usedModelId,
        url: dataUrl,
        chatId,
        agentId,
      })
    } catch (err) {
      console.error('[GenerateImage] Failed to save output:', err)
    }

    // ── Usage tracking ────────────────────────────────────────────────────────
    const costDollars = calculateImageCost(usedModelId)
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
      }).catch((err) => console.error('[GenerateImage] Failed to record usage:', err))
    }

    return NextResponse.json({ outputId, url: dataUrl, modelUsed: usedModelId })
  } catch (error) {
    console.error('[GenerateImage API] Error:', error)
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
  }
}
