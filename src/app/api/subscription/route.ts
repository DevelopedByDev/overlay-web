import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'

type ConvexEntitlements = {
  tier: 'free' | 'pro' | 'max'
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
      status: 'active' as const,
      creditsUsed: entitlements.creditsUsed,
      creditsTotal: entitlements.creditsTotal,
      billingPeriodEnd: entitlements.billingPeriodEnd || null,
    })
  } catch (error) {
    console.error('[Subscription API] Error fetching subscription:', error)
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
