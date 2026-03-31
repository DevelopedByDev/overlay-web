import { NextRequest, NextResponse } from 'next/server'
import { generateImage } from 'ai'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { getGatewayImageModel } from '@/lib/ai-gateway'
import { IMAGE_MODELS } from '@/lib/models'
import { calculateImageCost } from '@/lib/model-pricing'
import { uploadBuffer, keyForOutput } from '@/lib/r2'
import { checkGlobalR2Budget, R2GlobalBudgetError } from '@/lib/r2-budget'
import { deleteObject } from '@/lib/r2'

export const maxDuration = 120

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
  overlayStorageBytesUsed: number
  overlayStorageBytesLimit: number
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { prompt, modelId, aspectRatio, conversationId, turnId, imageUrl }: {
      prompt: string
      modelId?: string
      aspectRatio?: string
      conversationId?: string
      turnId?: string
      imageUrl?: string
    } = await request.json()

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const userId = session.user.id
    const serverSecret = getInternalApiSecret()

    // ── Subscription enforcement ──────────────────────────────────────────────
    const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
      serverSecret,
      userId,
    })

    if (!entitlements) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Could not verify subscription. Try signing out and back in.' },
        { status: 401 },
      )
    }

    const { tier, creditsUsed, creditsTotal } = entitlements
    const creditsTotalCents = creditsTotal * 100
    const remainingCents = creditsTotalCents - creditsUsed
    const usedPct = creditsTotalCents > 0 ? ((creditsUsed / creditsTotalCents) * 100).toFixed(2) : '0.00'
    console.log(`[GenerateImage] 📊 Entitlements: tier=${tier} | used=${creditsUsed}¢ / ${creditsTotalCents}¢ (${usedPct}% used, $${(remainingCents / 100).toFixed(4)} remaining) | userId=${userId}`)
    if (tier === 'free') {
      return NextResponse.json(
        { error: 'generation_not_allowed', message: 'Image generation requires a Pro subscription.' },
        { status: 403 }
      )
    }
    if (remainingCents <= 0) {
      return NextResponse.json(
        { error: 'insufficient_credits', message: 'No credits remaining. Please top up your account.' },
        { status: 402 }
      )
    }
    if (entitlements.overlayStorageBytesUsed >= entitlements.overlayStorageBytesLimit) {
      return NextResponse.json(
        { error: 'storage_limit_exceeded', message: 'Overlay storage limit reached. Delete files or outputs, or upgrade your plan.' },
        { status: 403 },
      )
    }

    // ── Build provider-specific options (image editing support) ─────────────
    // Extract base64 from data URL if provided
    const referenceBase64 = imageUrl?.startsWith('data:')
      ? imageUrl.split(',')[1]
      : undefined
    const referenceUrl = imageUrl && !imageUrl.startsWith('data:') ? imageUrl : undefined

    // ── Model selection: when user picks a model, use only that model ─────────
    // Fall back through all models only when no model is specified
    const priorityList = modelId
      ? [modelId]
      : IMAGE_MODELS.map((m) => m.id)

    let lastError: Error | null = null
    let usedModelId: string | null = null
    let imageBase64: string | null = null

    for (const tryModelId of priorityList) {
      try {
        const imageModel = await getGatewayImageModel(tryModelId, session.accessToken)

        // Build providerOptions for image editing when a reference image is supplied
        // Each provider has a different key — we try the most common patterns
        const providerKey = tryModelId.split('/')[0] // e.g. 'openai', 'google', 'bfl'
        const providerOptions = (referenceBase64 || referenceUrl)
          ? {
              [providerKey]: {
                // OpenAI gpt-image: pass as input image for editing
                ...(referenceBase64 ? { image: referenceBase64 } : {}),
                ...(referenceUrl ? { imageUrl: referenceUrl } : {}),
              },
            }
          : undefined

        // Build a contextual prompt for follow-up requests
        const finalPrompt = imageUrl
          ? `Based on the previous image, ${prompt.trim()}`
          : prompt.trim()

        const result = await generateImage({
          model: imageModel,
          prompt: finalPrompt,
          aspectRatio: (aspectRatio as `${number}:${number}` | undefined) ?? '1:1',
          providerOptions,
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
      const errMsg = lastError?.message ?? 'Unknown error'
      console.error('[GenerateImage] Generation failed. Last error:', errMsg)
      return NextResponse.json(
        { error: 'generation_failed', message: `Image generation failed: ${errMsg}` },
        { status: 500 }
      )
    }

    const dataUrl = `data:image/png;base64,${imageBase64}`

    // ── Upload to R2 & save output record ────────────────────────────────────
    let outputId: string | null = null
    let uploadedR2Key: string | null = null
    try {
      const imageBuffer = Buffer.from(imageBase64!, 'base64')
      if (entitlements.overlayStorageBytesUsed + imageBuffer.length > entitlements.overlayStorageBytesLimit) {
        return NextResponse.json(
          { error: 'storage_limit_exceeded', message: 'Not enough Overlay storage remaining for this image.' },
          { status: 403 },
        )
      }
      const fileName = `overlay-image-${Date.now()}.png`
      outputId = await convex.mutation<string>(
        'outputs:create',
        {
          userId,
          serverSecret,
          type: 'image',
          source: 'image_generation',
          status: 'pending',
          prompt: prompt.trim(),
          modelId: usedModelId,
          fileName,
          mimeType: 'image/png',
          ...(conversationId ? { conversationId } : {}),
          ...(turnId ? { turnId } : {}),
        },
        { throwOnError: true },
      )

      if (!outputId) {
        throw new Error('Output record was not created.')
      }
      const persistedOutputId = outputId
      const r2Key = keyForOutput(userId, persistedOutputId, fileName)
      await checkGlobalR2Budget(imageBuffer.length)
      await uploadBuffer(r2Key, imageBuffer, 'image/png')
      uploadedR2Key = r2Key
      console.log(`[GenerateImage] ✅ Uploaded ${imageBuffer.length}B to R2 key=${r2Key}`)

      await convex.mutation(
        'outputs:update',
        {
          outputId: persistedOutputId,
          userId,
          serverSecret,
          status: 'completed',
          modelId: usedModelId,
          r2Key,
          fileName,
          mimeType: 'image/png',
          sizeBytes: imageBuffer.length,
        },
        { throwOnError: true },
      )
    } catch (err) {
      console.error('[GenerateImage] Failed to save output:', err)
      if (uploadedR2Key) {
        await deleteObject(uploadedR2Key).catch(() => {})
      }
      if (outputId) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save generated image'
        await convex.mutation(
          'outputs:update',
          {
            outputId,
            userId,
            serverSecret,
            status: 'failed',
            errorMessage,
          },
          { throwOnError: true },
        ).catch(() => {})
      }
      if (err instanceof R2GlobalBudgetError) {
        return NextResponse.json(
          { error: 'storage_limit_exceeded', message: 'Global R2 storage cap reached. Contact support.' },
          { status: 403 },
        )
      }
      if (err instanceof Error && err.message.includes('storage_limit_exceeded')) {
        return NextResponse.json(
          { error: 'storage_limit_exceeded', message: 'Not enough Overlay storage remaining for this image.' },
          { status: 403 },
        )
      }
      return NextResponse.json(
        { error: 'save_failed', message: err instanceof Error ? err.message : 'Failed to save generated image.' },
        { status: 500 },
      )
    }

    // ── Usage tracking ────────────────────────────────────────────────────────
    const costDollars = calculateImageCost(usedModelId)
    const costCents = Math.round(costDollars * 100)
    console.log(`[GenerateImage] 💰 Cost: model=${usedModelId} | $${costDollars.toFixed(4)} = ${costCents}¢`)
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
          console.log(`[GenerateImage] ✅ Usage recorded | new state: ${updated.creditsUsed}¢ / ${totalCents}¢ (${usedPct}% used, $${((totalCents - updated.creditsUsed) / 100).toFixed(4)} remaining)`)
        }
      } else {
        console.error(`[GenerateImage] ❌ recordBatch returned null — check server logs for Convex error`)
      }
    } else {
      console.log(`[GenerateImage] ⚠️  Cost is 0¢ for model=${usedModelId} — usage not recorded`)
    }

    return NextResponse.json({ outputId, url: dataUrl, modelUsed: usedModelId })
  } catch (error) {
    console.error('[GenerateImage API] Error:', error)
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
  }
}
