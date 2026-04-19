import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { refreshSessionFromRefreshToken } from '@/lib/workos-auth'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : ''
    const expectedUserId =
      typeof body?.userId === 'string'
        ? body.userId
        : typeof body?.user?.id === 'string'
          ? body.user.id
          : undefined

    const tokenBucketKey = expectedUserId ?? createHash('sha256').update(refreshToken).digest('hex').slice(0, 16)
    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'auth:native-refresh:ip', key: getClientIp(request), limit: 20, windowMs: 10 * 60_000 },
      { bucket: 'auth:native-refresh:user', key: tokenBucketKey, limit: 12, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    const session = await refreshSessionFromRefreshToken(refreshToken, expectedUserId)

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401, headers: NO_STORE_HEADERS }
      )
    }

    return NextResponse.json({
      success: true,
      session,
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[Auth] Native refresh error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
