import { NextRequest, NextResponse } from 'next/server'
import { readEmailVerificationTicket, verifyEmail, resendVerificationEmail } from '@/lib/workos-auth'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body?.action
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    const ticketValue = typeof body?.ticket === 'string' ? body.ticket : ''
    const ticket = readEmailVerificationTicket(ticketValue)

    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'auth:verify-email:ip', key: getClientIp(request), limit: 10, windowMs: 10 * 60_000 },
      { bucket: 'auth:verify-email:ticket', key: ticket?.userId ?? ticketValue, limit: 8, windowMs: 10 * 60_000 },
      ...(action === 'resend'
        ? [{ bucket: 'auth:verify-email:resend', key: ticket?.userId ?? ticketValue, limit: 3, windowMs: 10 * 60_000 }]
        : []),
    ])
    if (rateLimitResponse) return rateLimitResponse

    if (!ticket) {
      return NextResponse.json(
        { error: 'Verification session expired. Please sign up again or request a new verification email.' },
        { status: 400 }
      )
    }

    // Handle resend verification email
    if (action === 'resend') {
      const result = await resendVerificationEmail(ticket.userId)
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to resend verification email' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Verification email sent',
      })
    }

    // Handle verify code
    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      )
    }

    const result = await verifyEmail(ticket.userId, code)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Invalid verification code' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
    })
  } catch (error) {
    console.error('[Auth] Verify email error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
