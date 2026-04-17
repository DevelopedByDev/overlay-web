import { NextRequest, NextResponse } from 'next/server'
import { resetPassword } from '@/lib/workos-auth'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'auth:reset-password:ip', key: getClientIp(request), limit: 8, windowMs: 10 * 60_000 },
      { bucket: 'auth:reset-password:token', key: token, limit: 5, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const result = await resetPassword(token, password)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to reset password' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now sign in.',
    })
  } catch (error) {
    console.error('[Auth] Reset password error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
