import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../convex/_generated/api'
import { getSession } from '@/lib/workos-auth'

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL
if (!CONVEX_URL) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL environment variable is required')
}
const convex = new ConvexHttpClient(CONVEX_URL)

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

  try {
    const entitlements = await convex.query(api.usage.getEntitlements, {
      userId,
      accessToken: session.accessToken,
    })

    if (!entitlements) {
      return NextResponse.json({ tier: 'free', status: 'active' })
    }

    return NextResponse.json({
      tier: entitlements.tier || 'free',
      status: 'active',
      creditsUsed: entitlements.creditsUsed || 0,
      creditsTotal: entitlements.creditsTotal || 0,
      billingPeriodEnd: entitlements.billingPeriodEnd || null
    })
  } catch (error) {
    console.error('[Subscription API] Error fetching subscription:', error)
    return NextResponse.json({ tier: 'free', status: 'active' })
  }
}
