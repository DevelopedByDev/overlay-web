import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getTopUpPreferenceSnapshot } from '@/lib/billing-runtime'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'

type ConvexEntitlements = {
  tier: 'free' | 'pro' | 'max'
  planKind: 'free' | 'paid'
  planAmountCents: number
  budgetUsedCents: number
  budgetTotalCents: number
  budgetRemainingCents: number
  autoTopUpEnabled: boolean
  autoTopUpAmountCents: number
  autoTopUpConsentGranted: boolean
  creditsUsed: number
  creditsTotal: number
  billingPeriodEnd: string
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  if (userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const fetchConvexEntitlements = async (nextUserId: string) =>
    await convex.query<ConvexEntitlements>(
      'usage:getEntitlementsByServer',
      {
        userId: nextUserId,
        serverSecret: getInternalApiSecret(),
      },
      { throwOnError: true },
    )

  try {
    const entitlements = await fetchConvexEntitlements(userId)

    if (!entitlements) {
      return NextResponse.json({ error: 'Failed to load subscription' }, { status: 502 })
    }

    return NextResponse.json({
      tier: entitlements.tier,
      planKind: entitlements.planKind,
      planAmountCents: entitlements.planAmountCents,
      status: 'active' as const,
      ...getTopUpPreferenceSnapshot(entitlements),
      creditsUsed: entitlements.budgetUsedCents ?? entitlements.creditsUsed,
      creditsTotal: entitlements.budgetTotalCents ?? entitlements.creditsTotal * 100,
      budgetUsedCents: entitlements.budgetUsedCents ?? entitlements.creditsUsed,
      budgetTotalCents: entitlements.budgetTotalCents ?? entitlements.creditsTotal * 100,
      budgetRemainingCents:
        entitlements.budgetRemainingCents ??
        Math.max(0, (entitlements.budgetTotalCents ?? entitlements.creditsTotal * 100) - (entitlements.budgetUsedCents ?? entitlements.creditsUsed)),
      autoTopUpEnabled: entitlements.autoTopUpEnabled,
      autoTopUpConsentGranted: entitlements.autoTopUpConsentGranted,
      billingPeriodEnd: entitlements.billingPeriodEnd || null,
    })
  } catch (error) {
    console.error('[Subscription API] Error fetching subscription:', error)
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
