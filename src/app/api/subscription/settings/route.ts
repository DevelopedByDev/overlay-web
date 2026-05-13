import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getDynamicTopUpConfig, isRecognizedTopUpAmount } from '@/lib/stripe-billing'
import { TOP_UP_MIN_AMOUNT_CENTS, derivePlanKind } from '@/lib/billing-pricing'
import { isBillingDisabled } from '@/lib/billing-runtime'

import { z } from '@/lib/api-schemas'

const SubscriptionSettingsRequestSchema = z.object({ autoTopUpEnabled: z.boolean().optional(), topUpAmountCents: z.number().optional(), autoTopUpAmountCents: z.number().optional(), grantOffSessionConsent: z.boolean().optional() }).passthrough().openapi('SubscriptionSettingsRequest')
const SubscriptionSettingsResponseSchema = z.unknown().openapi('SubscriptionSettingsResponse')
void SubscriptionSettingsRequestSchema
void SubscriptionSettingsResponseSchema

type BillingSettingsResponse = {
  planKind: 'free' | 'paid'
  autoTopUpEnabled: boolean
  topUpAmountCents: number
  autoTopUpAmountCents: number
  offSessionConsentAt?: number
  topUpMinAmountCents: number
  topUpMaxAmountCents: number
  topUpStepAmountCents: number
}

export async function GET() {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (isBillingDisabled()) {
    const topUpConfig = getDynamicTopUpConfig()
    return NextResponse.json({
      planKind: 'free',
      autoTopUpEnabled: false,
      topUpAmountCents: 0,
      autoTopUpAmountCents: 0,
      topUpMinAmountCents: topUpConfig.minAmountCents,
      topUpMaxAmountCents: topUpConfig.maxAmountCents,
      topUpStepAmountCents: topUpConfig.stepAmountCents,
    } satisfies BillingSettingsResponse)
  }

  const subscription = await convex.query<{
    tier?: 'free' | 'pro' | 'max'
    planKind?: 'free' | 'paid'
    autoTopUpEnabled?: boolean
    autoTopUpAmountCents?: number
    offSessionConsentAt?: number
  } | null>('subscriptions:getByUserIdByServer', {
    serverSecret: getInternalApiSecret(),
    userId: session.user.id,
  })

  const topUpConfig = getDynamicTopUpConfig()
  const response: BillingSettingsResponse = {
    planKind: derivePlanKind(subscription ?? {}),
    autoTopUpEnabled: Boolean(subscription?.autoTopUpEnabled),
    topUpAmountCents: subscription?.autoTopUpAmountCents ?? TOP_UP_MIN_AMOUNT_CENTS,
    autoTopUpAmountCents: subscription?.autoTopUpAmountCents ?? TOP_UP_MIN_AMOUNT_CENTS,
    offSessionConsentAt: subscription?.offSessionConsentAt,
    topUpMinAmountCents: topUpConfig.minAmountCents,
    topUpMaxAmountCents: topUpConfig.maxAmountCents,
    topUpStepAmountCents: topUpConfig.stepAmountCents,
  }
  return NextResponse.json(response)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (isBillingDisabled()) {
    return NextResponse.json({ error: 'Auto top-up is unavailable because billing is disabled for this deployment.' }, { status: 403 })
  }

  const body = await request.json()
  const autoTopUpEnabled = Boolean(body.autoTopUpEnabled)
  const providedTopUpAmountCents = body.topUpAmountCents ?? body.autoTopUpAmountCents
  const grantOffSessionConsent = Boolean(body.grantOffSessionConsent)

  const subscription = await convex.query<{
    tier?: 'free' | 'pro' | 'max'
    planKind?: 'free' | 'paid'
    autoTopUpAmountCents?: number
  } | null>('subscriptions:getByUserIdByServer', {
    serverSecret: getInternalApiSecret(),
    userId: session.user.id,
  })

  if (derivePlanKind(subscription ?? {}) !== 'paid') {
    return NextResponse.json({ error: 'Auto top-up is available only on paid plans' }, { status: 403 })
  }

  const topUpAmountCents = Math.round(
    Number(providedTopUpAmountCents ?? subscription?.autoTopUpAmountCents ?? TOP_UP_MIN_AMOUNT_CENTS),
  )

  if (!isRecognizedTopUpAmount(topUpAmountCents)) {
    return NextResponse.json({ error: 'Unsupported top-up amount' }, { status: 400 })
  }

  const result = await convex.mutation<{ success: boolean; error?: string }>(
    'subscriptions:updateBillingPreferencesByServer',
    {
      serverSecret: getInternalApiSecret(),
      userId: session.user.id,
      autoTopUpEnabled,
      topUpAmountCents,
      grantOffSessionConsent,
    },
    { throwOnError: true },
  )

  if (!result?.success) {
    return NextResponse.json({ error: result?.error || 'Failed to update billing settings' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
