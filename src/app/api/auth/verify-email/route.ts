import { NextRequest, NextResponse } from 'next/server'
import { verifyEmail, resendVerificationEmail } from '@/lib/workos-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, code, action } = body

    // Handle resend verification email
    if (action === 'resend') {
      if (!userId) {
        return NextResponse.json(
          { error: 'User ID is required' },
          { status: 400 }
        )
      }

      const result = await resendVerificationEmail(userId)
      
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
    if (!userId || !code) {
      return NextResponse.json(
        { error: 'User ID and verification code are required' },
        { status: 400 }
      )
    }

    const result = await verifyEmail(userId, code)

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
