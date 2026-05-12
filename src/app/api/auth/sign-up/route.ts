import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/workos-auth'
import { enforceRateLimits, getClientIp, rateLimitByIp } from '@/lib/rate-limit'

import { z } from '@/lib/api-schemas'

const AuthSignUpRequestSchema = z.object({ email: z.string().email().optional(), password: z.string().optional(), firstName: z.string().optional(), lastName: z.string().optional() }).openapi('AuthSignUpRequest')
const AuthSignUpResponseSchema = z.unknown().openapi('AuthSignUpResponse')
void AuthSignUpRequestSchema
void AuthSignUpResponseSchema

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitByIp(request, 'auth:sign-up', 5, 10 * 60_000)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const { email, password, firstName, lastName } = body
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

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

    const emailLimitResponse = await enforceRateLimits(request, [
      { bucket: 'auth:sign-up:email', key: normalizedEmail, limit: 3, windowMs: 60 * 60_000 },
      { bucket: 'auth:sign-up:ip-combined', key: getClientIp(request), limit: 10, windowMs: 60 * 60_000 },
    ])
    if (emailLimitResponse) return emailLimitResponse

    const result = await createUser(email, password, firstName, lastName)

    if (!result.success) {
      return NextResponse.json(
        { error: 'If this email can be used, we will send the next step by email.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      user: result.user,
      verificationTicket: result.verificationTicket,
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
