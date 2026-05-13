import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import { sanitizeChatTitle } from '@/lib/chat-title'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { getGatewayLanguageModel } from '@/lib/ai-gateway'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import type { Entitlements } from '@/lib/app-contracts'
import { calculateTokenCostOrNull } from '@/lib/model-pricing'
import {
  billableBudgetCentsFromProviderUsd,
  finalizeProviderBudgetReservation,
  isPaidPlan,
  markProviderBudgetReconcile,
  releaseProviderBudgetReservation,
  reserveProviderBudget,
} from '@/lib/billing-runtime'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'

const TITLE_MODEL = 'nvidia/nemotron-nano-9b-v2'
const FALLBACK_TITLE = 'New Chat'

const titleSchema = z.object({
  title: z.string().describe('A concise chat title, 3 to 6 words, natural title case, no trailing punctuation'),
})

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      text?: string
      accessToken?: string
      userId?: string
    }
    const { text, accessToken, userId: requestedUserId } = body
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text required' }, { status: 400 })
    }

    const auth = await resolveAuthenticatedAppUser(request, {
      accessToken,
      userId: requestedUserId,
    })
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'helper:title:ip', key: getClientIp(request), limit: 120, windowMs: 10 * 60_000 },
      { bucket: 'helper:title:user', key: auth.userId, limit: 60, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    const serverSecret = getInternalApiSecret()
    const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
      serverSecret,
      userId: auth.userId,
    })
    if (!entitlements || !isPaidPlan(entitlements)) {
      return NextResponse.json({ title: null })
    }

    const estimatedInputTokens = Math.ceil(Math.min(text.length, 1200) / 4) + 80
    const estimatedOutputTokens = 80
    const estimatedCostUsd = calculateTokenCostOrNull(TITLE_MODEL, estimatedInputTokens, 0, estimatedOutputTokens)
    if (estimatedCostUsd === null) {
      return NextResponse.json({ error: 'pricing_missing', message: 'Title generation model pricing is missing.' }, { status: 500 })
    }
    const reservation = await reserveProviderBudget({
      userId: auth.userId,
      entitlements,
      providerCostUsd: estimatedCostUsd,
      kind: 'generation',
      modelId: TITLE_MODEL,
    })
    if (!reservation.ok) {
      return NextResponse.json({ title: null })
    }

    const model = await getGatewayLanguageModel(TITLE_MODEL, auth.accessToken)
    let result: { object: z.infer<typeof titleSchema>; usage?: { inputTokens?: number; outputTokens?: number } }
    try {
      result = await generateObject({
        model,
        schema: titleSchema,
        system:
          'You write short, precise chat titles. Capture the actual topic, not the first words.',
        temperature: 0.2,
        maxOutputTokens: 80,
        prompt: `Generate a concise title for a conversation that starts with this message:\n\n${text.slice(0, 1200)}`,
      })
    } catch (err) {
      await releaseProviderBudgetReservation({
        userId: auth.userId,
        reservationId: reservation.reservationId,
        reason: err instanceof Error ? err.message : 'title_generation_failed',
      }).catch((releaseError) => console.error('[ChatTitle][server] Failed to release reservation', releaseError))
      throw err
    }

    const extracted = result.object.title?.trim() ?? ''
    const sanitizedTitle = sanitizeChatTitle(extracted, FALLBACK_TITLE)
    if (sanitizedTitle === FALLBACK_TITLE) {
      console.warn('[ChatTitle][server] Gateway returned empty title', result.object)
      await markProviderBudgetReconcile({
        userId: auth.userId,
        reservationId: reservation.reservationId,
        errorMessage: 'empty_title_after_provider_success',
      }).catch(() => {})
      return NextResponse.json({ title: null }, { status: 502 })
    }

    const usage = (result as unknown as { usage?: { inputTokens?: number; outputTokens?: number } }).usage
    const inputTokens = usage?.inputTokens ?? estimatedInputTokens
    const outputTokens = usage?.outputTokens ?? estimatedOutputTokens
    const actualCostUsd = calculateTokenCostOrNull(TITLE_MODEL, inputTokens, 0, outputTokens)
    if (actualCostUsd === null) {
      await markProviderBudgetReconcile({
        userId: auth.userId,
        reservationId: reservation.reservationId,
        errorMessage: `pricing_missing:${TITLE_MODEL}`,
      }).catch(() => {})
    } else {
      const costCents = billableBudgetCentsFromProviderUsd(actualCostUsd)
      await finalizeProviderBudgetReservation({
        userId: auth.userId,
        reservationId: reservation.reservationId,
        actualProviderCostUsd: actualCostUsd,
        events: [{
          type: 'generation',
          modelId: TITLE_MODEL,
          inputTokens,
          outputTokens,
          cachedTokens: 0,
          cost: costCents,
          timestamp: Date.now(),
        }],
      }).catch(async (err) => {
        console.error('[ChatTitle][server] Failed to finalize reservation', err)
        await markProviderBudgetReconcile({
          userId: auth.userId,
          reservationId: reservation.reservationId,
          errorMessage: err instanceof Error ? err.message : 'finalize_failed',
        }).catch(() => {})
      })
    }

    return NextResponse.json({ title: sanitizedTitle })
  } catch (error) {
    console.error('[ChatTitle][server] Failed to generate title', error)
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 })
  }
}
