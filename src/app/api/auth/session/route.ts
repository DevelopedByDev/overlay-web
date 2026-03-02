import { NextResponse } from 'next/server'
import { getSession, refreshSessionIfNeeded } from '@/lib/workos-auth'

export async function GET() {
  try {
    // Try to refresh session if needed
    const session = await refreshSessionIfNeeded()
    
    if (!session) {
      // Try getting current session without refresh
      const currentSession = await getSession()
      if (!currentSession) {
        return NextResponse.json({ authenticated: false }, { status: 200 })
      }
      return NextResponse.json({
        authenticated: true,
        user: currentSession.user,
      })
    }

    return NextResponse.json({
      authenticated: true,
      user: session.user,
    })
  } catch (error) {
    console.error('[Auth] Session check error:', error)
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
}
