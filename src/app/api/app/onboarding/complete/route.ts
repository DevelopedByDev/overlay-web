import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/server/auth/workos-auth'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import { ONBOARDING_SEEN_COOKIE } from '@/features/auth/lib/onboarding-cookie'

export async function POST(request: NextRequest) {
  const session = await getSession()
  const body = await request.json().catch(() => ({}))
  const auth = await resolveAuthenticatedAppUser(request, body)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const userId = auth.userId
  const userEmail = session?.user?.id === userId ? session.user.email : undefined

  // Persist to Convex when possible (cross-device, admin tools). If Convex is unavailable
  // or the deployment is behind, still set the cookie so the tour does not replay every load.
  let persistedToConvex = false
  try {
    const result = await convex.mutation('auth/users:markOnboardingComplete', {
      serverSecret: getInternalApiSecret(),
      userId,
      email: userEmail,
    })
    persistedToConvex = Boolean(
      result && typeof result === 'object' && 'ok' in result && (result as { ok: boolean }).ok,
    )
    if (!persistedToConvex) {
      console.warn('[onboarding/complete] Convex did not confirm save; cookie will still be set', {
        userId,
      })
    }
  } catch (e) {
    console.error('[onboarding/complete] Convex mutation failed; cookie will still be set', e)
  }

  const response = NextResponse.json({ ok: true as const, persistedToConvex })
  response.cookies.set(ONBOARDING_SEEN_COOKIE, userId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
