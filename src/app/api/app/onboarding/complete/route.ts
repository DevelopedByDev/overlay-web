import { NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { ONBOARDING_SEEN_COOKIE } from '@/lib/onboarding-cookie'

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Persist to Convex when possible (cross-device, admin tools). If Convex is unavailable
  // or the deployment is behind, still set the cookie so the tour does not replay every load.
  let persistedToConvex = false
  try {
    const result = await convex.mutation('users:markOnboardingComplete', {
      serverSecret: getInternalApiSecret(),
      userId: session.user.id,
      email: session.user.email ?? undefined,
    })
    persistedToConvex = Boolean(
      result && typeof result === 'object' && 'ok' in result && (result as { ok: boolean }).ok,
    )
    if (!persistedToConvex) {
      console.warn('[onboarding/complete] Convex did not confirm save; cookie will still be set', {
        userId: session.user.id,
      })
    }
  } catch (e) {
    console.error('[onboarding/complete] Convex mutation failed; cookie will still be set', e)
  }

  const response = NextResponse.json({ ok: true as const, persistedToConvex })
  response.cookies.set(ONBOARDING_SEEN_COOKIE, session.user.id, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
