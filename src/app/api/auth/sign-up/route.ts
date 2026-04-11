import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/workos-auth'
import { rateLimitByIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimitByIp(request, 'auth:sign-up', 5, 10 * 60_000)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const { email, password, firstName, lastName } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Basic password validation
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const result = await createUser(email, password, firstName, lastName)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create account' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      user: result.user,
      pendingEmailVerification: result.pendingEmailVerification,
      message: 'Account created! Please check your email to verify your account.',
    })
  } catch (error) {
    console.error('[Auth] Sign-up error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
