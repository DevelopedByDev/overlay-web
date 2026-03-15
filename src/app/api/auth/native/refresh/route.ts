import { NextRequest, NextResponse } from 'next/server'
import { refreshSessionFromRefreshToken, type AuthUser } from '@/lib/workos-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : ''
    const user = body?.user as AuthUser | undefined

    if (!refreshToken || !user?.id || !user.email) {
      return NextResponse.json(
        { error: 'Refresh token and user are required' },
        { status: 400 }
      )
    }

    const session = await refreshSessionFromRefreshToken(refreshToken, user)

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      session,
    })
  } catch (error) {
    console.error('[Auth] Native refresh error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
