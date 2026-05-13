import { NextRequest, NextResponse } from 'next/server'
import { generateImage } from 'ai'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { convex } from '@/lib/convex'
import { getGatewayImageModel } from '@/lib/ai-gateway'
import { IMAGE_MODELS } from '@/lib/model-data'
import { calculateImageCostOrNull } from '@/lib/model-pricing'
import { uploadBuffer, keyForOutput } from '@/lib/r2'
import { checkGlobalR2Budget, R2GlobalBudgetError } from '@/lib/r2-budget'
import { deleteObject } from '@/lib/r2'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import type { Entitlements } from '@/lib/app-contracts'
import {
  billableBudgetCentsFromProviderUsd,
  finalizeProviderBudgetReservation,
  getBudgetTotals,
  isPaidPlan,
  markProviderBudgetReconcile,
  releaseProviderBudgetReservation,
  reserveProviderBudget,
} from '@/lib/billing-runtime'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const { prompt, modelId, aspectRatio, conversationId, turnId, imageUrl, accessToken, userId }: {
      prompt: string
      modelId?: string
      aspectRatio?: string
      conversationId?: string
      turnId?: string
      imageUrl?: string
      accessToken?: string
      userId?: string
    } = await request.json()

    const auth = await resolveAuthenticatedAppUser(request, { accessToken, userId })
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'generation:image:ip', key: getClientIp(request), limit: 30, windowMs: 10 * 60_000 },
      { bucket: 'generation:image:user', key: auth.userId, limit: 15, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const serverSecret = getInternalApiSecret()

    // ── Subscription enforcement ──────────────────────────────────────────────
    const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
      serverSecret,
      userId: auth.userId,
    })

    if (!entitlements) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Could not verify subscription. Try signing out and back in.' },
        { status: 401 },
      )
    }

    let currentEntitlements = entitlements
    const budget = getBudgetTotals(currentEntitlements)
    const usedPct = budget.totalCents > 0 ? ((budget.usedCents / budget.totalCents) * 100).toFixed(2) : '0.00'
    console.log(`[GenerateImage] 📊 Entitlements: tier=${currentEntitlements.tier} | used=${budget.usedCents}¢ / ${budget.totalCents}¢ (${usedPct}% used, $${(budget.remainingCents / 100).toFixed(4)} remaining) | userId=${auth.userId}`)
    if (!isPaidPlan(currentEntitlements)) {
      return NextResponse.json(
        { error: 'generation_not_allowed', message: 'Image generation requires a paid plan.' },
        { status: 403 }
      )
    }
    if ((currentEntitlements.overlayStorageBytesUsed ?? 0) >= (currentEntitlements.overlayStorageBytesLimit ?? 0)) {
      return NextResponse.json(
        { error: 'storage_limit_exceeded', message: 'Overlay storage limit reached. Delete files or outputs, or upgrade your plan.' },
        { status: 403 },
      )
    }

    // ── Build reference image for editing (if provided) ──────────────────────
    // Accept data URLs (base64) or plain https URLs
    const referenceImage: string | undefined = imageUrl || undefined

    // ── Model selection: when user picks a model, use only that model ─────────
    // Fall back through all models only when no model is specified
    const priorityList = modelId
      ? [modelId]
      : IMAGE_MODELS.map((m) => m.id)
    const pricedPriorityList = priorityList.filter((candidateId) => calculateImageCostOrNull(candidateId) !== null)
    if (pricedPriorityList.length === 0) {
      return NextResponse.json(
        { error: 'pricing_missing', message: 'Image generation is temporarily unavailable because model pricing is missing.' },
        { status: 400 },
      )
    }
    if (modelId && pricedPriorityList[0] !== modelId) {
      return NextResponse.json(
        { error: 'pricing_missing', message: `Image model ${modelId} is not priced for production use.` },
        { status: 400 },
      )
    }

    const maxProviderCostUsd = Math.max(...pricedPriorityList.map((candidateId) => calculateImageCostOrNull(candidateId) ?? 0))
    const reservation = await reserveProviderBudget({
      userId: auth.userId,
      entitlements: currentEntitlements,
      providerCostUsd: maxProviderCostUsd,
      kind: 'generation',
      modelId: modelId ?? 'image-fallback',
    })
    if (!reservation.ok) {
      return NextResponse.json({ ...reservation.payload, error: reservation.code }, { status: reservation.status })
    }
    currentEntitlements = reservation.entitlements

    let lastError: Error | null = null
    let usedModelId: string | null = null
    let imageBase64: string | null = null

    for (const tryModelId of pricedPriorityList) {
      try {
        const imageModel = await getGatewayImageModel(tryModelId, auth.accessToken || undefined)

        // Use the AI SDK prompt-with-images format for image editing
        // When no reference image is provided, pass a plain string prompt
        const finalPrompt = referenceImage
          ? { text: prompt.trim(), images: [referenceImage] }
          : prompt.trim()
        const result = await generateImage({
          model: imageModel,
          prompt: finalPrompt,
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
      const errMsg = lastError?.message ?? 'Unknown error'
      console.error('[GenerateImage] Generation failed. Last error:', errMsg)
      await releaseProviderBudgetReservation({
        userId: auth.userId,
        reservationId: reservation.reservationId,
        reason: errMsg,
      }).catch((releaseError) => console.error('[GenerateImage] Failed to release budget reservation:', releaseError))
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
      if ((currentEntitlements.overlayStorageBytesUsed ?? 0) + imageBuffer.length > (currentEntitlements.overlayStorageBytesLimit ?? 0)) {
        await markProviderBudgetReconcile({
          userId: auth.userId,
          reservationId: reservation.reservationId,
          errorMessage: 'storage_limit_exceeded_after_generation',
        }).catch((reconcileError) => console.error('[GenerateImage] Failed to mark reservation for reconcile:', reconcileError))
        return NextResponse.json(
          { error: 'storage_limit_exceeded', message: 'Not enough Overlay storage remaining for this image.' },
          { status: 403 },
        )
      }
      const fileName = `overlay-image-${Date.now()}.png`
      outputId = await convex.mutation<string>(
        'outputs:create',
        {
          userId: auth.userId,
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
      const r2Key = keyForOutput(auth.userId, persistedOutputId, fileName)
      await checkGlobalR2Budget(imageBuffer.length)
      await uploadBuffer(r2Key, imageBuffer, 'image/png')
      uploadedR2Key = r2Key
      console.log(`[GenerateImage] ✅ Uploaded ${imageBuffer.length}B to R2 key=${r2Key}`)

      await convex.mutation(
        'outputs:update',
        {
          outputId: persistedOutputId,
          userId: auth.userId,
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
      await markProviderBudgetReconcile({
        userId: auth.userId,
        reservationId: reservation.reservationId,
        errorMessage: err instanceof Error ? err.message : 'Failed to save generated image',
      }).catch((reconcileError) => console.error('[GenerateImage] Failed to mark reservation for reconcile:', reconcileError))
      if (uploadedR2Key) {
        await deleteObject(uploadedR2Key).catch(() => {})
      }
      if (outputId) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save generated image'
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
    const costDollars = calculateImageCostOrNull(usedModelId)
    if (costDollars === null) {
      await markProviderBudgetReconcile({
        userId: auth.userId,
        reservationId: reservation.reservationId,
        errorMessage: `pricing_missing:${usedModelId}`,
      }).catch((reconcileError) => console.error('[GenerateImage] Failed to mark reservation for reconcile:', reconcileError))
      return NextResponse.json(
        { error: 'pricing_missing', message: `Image model ${usedModelId} is not priced for production use.` },
        { status: 500 },
      )
    }
    const costCents = billableBudgetCentsFromProviderUsd(costDollars)
    console.log(`[GenerateImage] 💰 Cost: model=${usedModelId} | provider=$${costDollars.toFixed(4)} billed=${costCents}¢`)
    if (costCents > 0 || reservation.reservationId) {
      try {
        const recordResult = await finalizeProviderBudgetReservation({
          userId: auth.userId,
          reservationId: reservation.reservationId,
          actualProviderCostUsd: costDollars,
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
          const updated = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
            serverSecret,
            userId: auth.userId,
          })
          if (updated) {
            const totalCents = updated.creditsTotal * 100
            const usedPct = totalCents > 0 ? ((updated.creditsUsed / totalCents) * 100).toFixed(2) : '0.00'
            console.log(`[GenerateImage] ✅ Usage recorded | new state: ${updated.creditsUsed}¢ / ${totalCents}¢ (${usedPct}% used, $${((totalCents - updated.creditsUsed) / 100).toFixed(4)} remaining)`)
          }
        } else {
          console.error(`[GenerateImage] ❌ finalizeProviderBudgetReservation returned null — check server logs for Convex error`)
        }
      } catch (recordError) {
        console.error('[GenerateImage] Failed to finalize budget reservation:', recordError)
        await markProviderBudgetReconcile({
          userId: auth.userId,
          reservationId: reservation.reservationId,
          errorMessage: recordError instanceof Error ? recordError.message : 'finalize_failed',
        }).catch((reconcileError) => console.error('[GenerateImage] Failed to mark reservation for reconcile:', reconcileError))
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
