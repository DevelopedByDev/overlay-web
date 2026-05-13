import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getDynamicTopUpConfig, isRecognizedTopUpAmount } from '@/lib/stripe-billing'
import { TOP_UP_MIN_AMOUNT_CENTS, derivePlanKind } from '@/lib/billing-pricing'

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export async function GET(request: NextRequest) {
  const auth = await resolveAuthenticatedAppUser(request, {})
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const subscription = await convex.query<{
    tier?: 'free' | 'pro' | 'max'
    planKind?: 'free' | 'paid'
    autoTopUpEnabled?: boolean
    autoTopUpAmountCents?: number
    offSessionConsentAt?: number
  } | null>('subscriptions:getByUserIdByServer', {
    serverSecret: getInternalApiSecret(),
    userId: auth.userId,
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
  const body = await request.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const auth = await resolveAuthenticatedAppUser(request, body)
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (typeof body.autoTopUpEnabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid autoTopUpEnabled' }, { status: 400 })
  }
  if (body.grantOffSessionConsent !== undefined && typeof body.grantOffSessionConsent !== 'boolean') {
    return NextResponse.json({ error: 'Invalid grantOffSessionConsent' }, { status: 400 })
  }

  const autoTopUpEnabled = body.autoTopUpEnabled
  const providedTopUpAmountCents = body.topUpAmountCents ?? body.autoTopUpAmountCents
  if (providedTopUpAmountCents !== undefined && typeof providedTopUpAmountCents !== 'number') {
    return NextResponse.json({ error: 'Invalid topUpAmountCents' }, { status: 400 })
  }
  const grantOffSessionConsent = body.grantOffSessionConsent === true

  const subscription = await convex.query<{
    tier?: 'free' | 'pro' | 'max'
    planKind?: 'free' | 'paid'
    autoTopUpAmountCents?: number
    offSessionConsentAt?: number
  } | null>('subscriptions:getByUserIdByServer', {
    serverSecret: getInternalApiSecret(),
    userId: auth.userId,
  })

  if (derivePlanKind(subscription ?? {}) !== 'paid') {
    return NextResponse.json({ error: 'Auto top-up is available only on paid plans' }, { status: 403 })
  }
  if (autoTopUpEnabled && !grantOffSessionConsent && !subscription?.offSessionConsentAt) {
    return NextResponse.json({ error: 'Off-session consent is required to enable auto top-up' }, { status: 400 })
  }

  const topUpAmountCents = Math.round(
    Number(providedTopUpAmountCents ?? subscription?.autoTopUpAmountCents ?? TOP_UP_MIN_AMOUNT_CENTS),
  )
  if (!Number.isFinite(topUpAmountCents)) {
    return NextResponse.json({ error: 'Invalid top-up amount' }, { status: 400 })
  }

  if (!isRecognizedTopUpAmount(topUpAmountCents)) {
    return NextResponse.json({ error: 'Unsupported top-up amount' }, { status: 400 })
  }

  const result = await convex.mutation<{ success: boolean; error?: string }>(
    'subscriptions:updateBillingPreferencesByServer',
    {
      serverSecret: getInternalApiSecret(),
      userId: auth.userId,
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
