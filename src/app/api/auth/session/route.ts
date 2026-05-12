import { NextRequest, NextResponse } from 'next/server'
import { logAuthDebug, summarizeSessionForLog } from '@/lib/auth-debug'
import { getAuthProvider } from '@/lib/provider-runtime'
import type { AuthSession } from '@/lib/workos-auth'
import { rateLimitByIp } from '@/lib/rate-limit'

import { z } from '@/lib/api-schemas'

const AuthSessionRequestSchema = z.object({}).openapi('AuthSessionRequest')
const AuthSessionResponseSchema = z.unknown().openapi('AuthSessionResponse')
void AuthSessionRequestSchema
void AuthSessionResponseSchema

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitByIp(request, 'auth:session', 60, 60_000)
    if (rateLimitResponse) return rateLimitResponse
    const session = await getAuthProvider().getSession(request) as AuthSession | null
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
    logAuthDebug('/api/auth/session error', {
      error: error instanceof Error ? error.message : String(error),
    })
    console.error('[Auth] Session check error:', error)
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
}
