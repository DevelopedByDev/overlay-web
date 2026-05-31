import { NextRequest, NextResponse } from 'next/server'
import { logAuthDebug, summarizeSessionForLog } from '@/server/auth/auth-debug'
import { getOverlaySession } from '@/server/auth/session'
import { formatOverlayConfigError, isOverlayConfigError } from '@/server/config'
import { rateLimitByIp } from '@/server/security/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitByIp(request, 'auth:session', 60, 60_000)
    if (rateLimitResponse) return rateLimitResponse
    const session = await getOverlaySession()
    if (!session) {
      logAuthDebug('/api/auth/session unauthenticated')
      return NextResponse.json({ authenticated: false }, { status: 200 })
    }
    logAuthDebug('/api/auth/session authenticated', summarizeSessionForLog(session))
    return NextResponse.json({
      authenticated: true,
      user: session.user,
    })
  } catch (error) {
    if (isOverlayConfigError(error)) {
      const formatted = formatOverlayConfigError(error)
      return NextResponse.json(
        {
          authenticated: false,
          error: 'Runtime configuration is invalid',
          code: 'runtime_config_invalid',
          issues: formatted.issues,
        },
        { status: 503 },
      )
    }

    logAuthDebug('/api/auth/session error', {
      error: error instanceof Error ? error.message : String(error),
    })
    console.error('[Auth] Session check error:', error)
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
}
