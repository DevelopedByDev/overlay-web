import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getVerifiedAccessTokenClaims, debugAccessTokenVerification } from '../../../../../../convex/lib/auth'
import { rateLimitByIp } from '@/lib/rate-limit'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const

interface ConvexEntitlements {
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
  dailyUsage: { ask: number; write: number; agent: number }
  dailyLimits: { ask: number; write: number; agent: number }
  transcriptionSecondsUsed: number
  transcriptionSecondsLimit: number
  localTranscriptionEnabled: boolean
  resetAt: string
  billingPeriodEnd: string
  lastSyncedAt: number
}

async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  const bearer =
    authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''

  if (!bearer) {
    return null
  }

  const claims = await getVerifiedAccessTokenClaims(bearer)
  if (typeof claims?.sub !== 'string' || !claims.sub.trim()) {
    const debug = await debugAccessTokenVerification(bearer)
    console.error('[NativeSubscription] Token verification failed:', JSON.stringify(debug))
    return null
  }
  return claims.sub
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitByIp(request, 'auth:native-subscription:ip', 60, 60_000)
    if (rateLimitResponse) return rateLimitResponse
    const userId = await getAuthenticatedUserId(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: NO_STORE_HEADERS }
      )
    }

    const entitlements = await convex.query<ConvexEntitlements>(
      'usage:getEntitlementsByServer',
      {
        userId,
        serverSecret: getInternalApiSecret(),
      },
      { throwOnError: true }
    )

    if (!entitlements) {
      return NextResponse.json(
        { error: 'Failed to load subscription' },
        { status: 502, headers: NO_STORE_HEADERS }
      )
    }

    return NextResponse.json(
      {
        ...entitlements,
        creditsUsed: entitlements.budgetUsedCents ?? entitlements.creditsUsed,
        creditsTotal:
          entitlements.budgetTotalCents !== undefined
            ? entitlements.budgetTotalCents / 100
            : entitlements.creditsTotal,
      },
      { headers: NO_STORE_HEADERS },
    )
  } catch (error) {
    console.error('[NativeSubscription] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
