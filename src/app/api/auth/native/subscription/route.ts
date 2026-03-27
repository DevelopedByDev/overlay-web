import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getVerifiedAccessTokenClaims } from '../../../../../../convex/lib/auth'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const

interface ConvexEntitlements {
  tier: 'free' | 'pro' | 'max'
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
  return typeof claims?.sub === 'string' && claims.sub.trim().length > 0 ? claims.sub : null
}

export async function GET(request: NextRequest) {
  try {
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

    return NextResponse.json(entitlements, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[NativeSubscription] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
