import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
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

const TAB_GROUP_MODEL = 'openai/gpt-oss-20b'
const tabGroupLabelSchema = z.object({
  title: z.string().describe('Chrome tab group label, 1 to 3 words, no punctuation'),
})

function fallbackLabel(text: string): string {
  const words = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[?!.,;:]+$/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
  return words.map((w) => w.replace(/^./, (c) => c.toUpperCase())).join(' ') || 'Overlay chat'
}

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

    const fallback = fallbackLabel(text)

    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'helper:tab-label:ip', key: getClientIp(request), limit: 120, windowMs: 10 * 60_000 },
      { bucket: 'helper:tab-label:user', key: auth.userId, limit: 60, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    const serverSecret = getInternalApiSecret()
    const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
      serverSecret,
      userId: auth.userId,
    })
    if (!entitlements || !isPaidPlan(entitlements)) {
      return NextResponse.json({ title: fallback })
    }

    const userPrompt = `Give a very short Chrome tab group name (at most 3 words, no punctuation) summarizing:\n\n${text.slice(0, 400)}`
    const estimatedInputTokens = Math.ceil(userPrompt.length / 4) + 80
    const estimatedOutputTokens = 32
    const estimatedCostUsd = calculateTokenCostOrNull(TAB_GROUP_MODEL, estimatedInputTokens, 0, estimatedOutputTokens)
    if (estimatedCostUsd === null) {
      return NextResponse.json({ title: fallback })
    }
    const reservation = await reserveProviderBudget({
      userId: auth.userId,
      entitlements,
      providerCostUsd: estimatedCostUsd,
      kind: 'generation',
      modelId: TAB_GROUP_MODEL,
    })
    if (!reservation.ok) return NextResponse.json({ title: fallback })

    let label = ''
    try {
      const model = await getGatewayLanguageModel(TAB_GROUP_MODEL, auth.accessToken)
      const result = await generateObject({
        model,
        schema: tabGroupLabelSchema,
        system:
          'You label Chrome tab groups. Return a title that is 1 to 3 words only, no quotes or trailing punctuation.',
        prompt: userPrompt,
        temperature: 0,
        maxOutputTokens: 32,
      })
      label = result.object.title
      const usage = (result as unknown as { usage?: { inputTokens?: number; outputTokens?: number } }).usage
      const inputTokens = usage?.inputTokens ?? estimatedInputTokens
      const outputTokens = usage?.outputTokens ?? estimatedOutputTokens
      const actualCostUsd = calculateTokenCostOrNull(TAB_GROUP_MODEL, inputTokens, 0, outputTokens)
      if (actualCostUsd === null) {
        await markProviderBudgetReconcile({
          userId: auth.userId,
          reservationId: reservation.reservationId,
          errorMessage: `pricing_missing:${TAB_GROUP_MODEL}`,
        }).catch(() => {})
      } else {
        const costCents = billableBudgetCentsFromProviderUsd(actualCostUsd)
        await finalizeProviderBudgetReservation({
          userId: auth.userId,
          reservationId: reservation.reservationId,
          actualProviderCostUsd: actualCostUsd,
          events: [{
            type: 'generation',
            modelId: TAB_GROUP_MODEL,
            inputTokens,
            outputTokens,
            cachedTokens: 0,
            cost: costCents,
            timestamp: Date.now(),
          }],
        }).catch(async (err) => {
          await markProviderBudgetReconcile({
            userId: auth.userId,
            reservationId: reservation.reservationId,
            errorMessage: err instanceof Error ? err.message : 'finalize_failed',
          }).catch(() => {})
        })
      }
    } catch (err) {
      await releaseProviderBudgetReservation({
        userId: auth.userId,
        reservationId: reservation.reservationId,
        reason: err instanceof Error ? err.message : 'tab_group_label_failed',
      }).catch(() => {})
      return NextResponse.json({ title: fallback })
    }

    const words = label
      .replace(/[.!?,;:]+$/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
    const sanitized = words.join(' ') || fallback

    return NextResponse.json({ title: sanitized })
  } catch (error) {
    console.error('[TabGroupLabel] failed', error)
    return NextResponse.json({ error: 'Failed to generate label' }, { status: 500 })
  }
}
