import { NextResponse } from 'next/server'
import { clearSession, getBaseUrl } from '@/lib/workos-auth'

export async function POST() {
  try {
    await clearSession()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Auth] Sign-out error:', error)
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    await clearSession()
    return NextResponse.redirect(`${getBaseUrl()}/`)
  } catch (error) {
    console.error('[Auth] Sign-out error:', error)
    return NextResponse.redirect(`${getBaseUrl()}/`)
  }
}
