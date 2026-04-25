import { NextRequest, NextResponse } from 'next/server'
import { authenticateNativeWithCode } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'
import { logSecurityEvent } from '@/lib/security-events'
import {
  isValidNativeAuthCode,
  isValidPkceVerifier,
} from '@/lib/native-auth-validation'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'auth:native-exchange:ip', key: getClientIp(request), limit: 20, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json().catch(() => ({})) as {
      code?: unknown
      codeVerifier?: unknown
    }

    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const codeVerifier = typeof body.codeVerifier === 'string' ? body.codeVerifier.trim() : ''

    if (!isValidNativeAuthCode(code) || !isValidPkceVerifier(codeVerifier)) {
      logSecurityEvent('native_exchange_rejected', {
        reason: !isValidNativeAuthCode(code) ? 'invalid_code' : 'invalid_code_verifier',
        path: request.nextUrl.pathname,
        ip: getClientIp(request),
      }, 'warning')
      return NextResponse.json({ error: 'Missing authorization code or verifier' }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const session = await authenticateNativeWithCode(code, codeVerifier)

    await convex.mutation('users:syncUserProfileByServer', {
      serverSecret: getInternalApiSecret(),
      userId: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      profilePictureUrl: session.user.profilePictureUrl,
    }, { throwOnError: true })

    return NextResponse.json({ success: true, session }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    logSecurityEvent('native_exchange_error', {
      reason: error instanceof Error ? error.message : String(error),
      path: request.nextUrl.pathname,
      ip: getClientIp(request),
    }, 'warning')
    return NextResponse.json({ error: 'Failed to complete native sign-in' }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
