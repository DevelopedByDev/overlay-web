import { NextResponse } from 'next/server'
import { logAuthDebug, summarizeSessionForLog } from '@/lib/auth-debug'
import { getSession } from '@/lib/workos-auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      logAuthDebug('/api/auth/session unauthenticated')
      return NextResponse.json({ authenticated: false }, { status: 200 })
    }
    logAuthDebug('/api/auth/session authenticated', summarizeSessionForLog(session))
    return NextResponse.json({
      authenticated: true,
      user: session.user,
    })
  } catch (error) {
    logAuthDebug('/api/auth/session error', {
      error: error instanceof Error ? error.message : String(error),
    })
    console.error('[Auth] Session check error:', error)
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
}
