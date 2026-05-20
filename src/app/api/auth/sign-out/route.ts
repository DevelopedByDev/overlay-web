import { NextResponse } from 'next/server'
import { clearOverlaySession } from '@/server/auth/session'

export async function POST() {
  try {
    await clearOverlaySession()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Auth] Sign-out error:', error)
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    )
  }
}
