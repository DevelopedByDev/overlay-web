import { NextRequest, NextResponse } from 'next/server'
import { refreshSessionFromRefreshToken } from '@/lib/workos-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : ''
    const expectedUserId =
      typeof body?.userId === 'string'
        ? body.userId
        : typeof body?.user?.id === 'string'
          ? body.user.id
          : undefined

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      )
    }

    const session = await refreshSessionFromRefreshToken(refreshToken, expectedUserId)

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
