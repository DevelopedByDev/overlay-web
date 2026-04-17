import { NextRequest, NextResponse } from 'next/server'
import { authenticateWithPassword } from '@/lib/workos-auth'
import { rateLimitByIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitByIp(request, 'auth:sign-in', 10, 60_000)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const result = await authenticateWithPassword(email, password)

    if (result.pendingEmailVerification) {
      return NextResponse.json(
        { error: result.error, pendingEmailVerification: true },
        { status: 403 }
      )
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Authentication failed' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      user: result.user,
    })
  } catch (error) {
    console.error('[Auth] Sign-in error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
