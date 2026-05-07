import { NextRequest, NextResponse } from 'next/server'
import { sendPasswordResetEmail } from '@/lib/workos-auth'
import { enforceRateLimits, getClientIp, rateLimitByIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitByIp(request, 'auth:forgot-password', 5, 10 * 60_000)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const { email } = body
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const emailLimitResponse = await enforceRateLimits(request, [
      { bucket: 'auth:forgot-password:email', key: normalizedEmail, limit: 3, windowMs: 60 * 60_000 },
      { bucket: 'auth:forgot-password:ip-combined', key: getClientIp(request), limit: 10, windowMs: 60 * 60_000 },
    ])
    if (emailLimitResponse) return emailLimitResponse

    await sendPasswordResetEmail(email)

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    })
  } catch (error) {
    console.error('[Auth] Forgot password error:', error)
    // Still return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    })
  }
}
