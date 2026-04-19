import { NextRequest, NextResponse } from 'next/server'
import { sendPasswordResetEmail } from '@/lib/workos-auth'
import { rateLimitByIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitByIp(request, 'auth:forgot-password', 5, 10 * 60_000)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

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
