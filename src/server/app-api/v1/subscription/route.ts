import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { NextResponse } from 'next/server'
import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import { getTopUpPreferenceSnapshot } from '@/server/billing/billing-runtime'
import type { NextRequest } from 'next/server'

type AppSubscriptionResponse = {
  tier: 'free' | 'pro' | 'max'
  planKind?: 'free' | 'paid'
  planAmountCents?: number
  creditsUsed: number
  creditsTotal: number
  budgetUsedCents?: number
  budgetTotalCents?: number
  budgetRemainingCents?: number
  autoTopUpEnabled?: boolean
  autoTopUpAmountCents?: number
}

export async function GET(request: NextRequest, context: AppApiRouteContext) {
  const { auth } = context

  try {
    const entitlements = await convex.query<AppSubscriptionResponse | null>(
      'platform/usage:getEntitlementsByServer',
      {
        userId: auth.userId,
        serverSecret: getInternalApiSecret(),
      },
      { throwOnError: true },
    )
    if (!entitlements) {
      return NextResponse.json({ error: 'Failed to load subscription' }, { status: 502 })
    }
    return NextResponse.json({
      ...entitlements,
      ...getTopUpPreferenceSnapshot(entitlements),
      creditsUsed: entitlements.budgetUsedCents ?? entitlements.creditsUsed,
      creditsTotal:
        entitlements.budgetTotalCents !== undefined
          ? entitlements.budgetTotalCents / 100
          : entitlements.creditsTotal,
    })
  } catch (error) {
    console.error('[app/subscription]', error)
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
