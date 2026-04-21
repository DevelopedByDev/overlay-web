import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { ONBOARDING_SEEN_COOKIE } from '@/lib/onboarding-cookie'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const cookieStore = await cookies()
  const cookieUid = cookieStore.get(ONBOARDING_SEEN_COOKIE)?.value
  if (cookieUid === session.user.id) {
    return NextResponse.json({ hasSeenOnboarding: true })
  }

  const result = (await convex.query('users:getOnboardingStatus', {
    serverSecret: getInternalApiSecret(),
    userId: session.user.id,
  })) as { hasSeenOnboarding?: boolean } | null

  const hasSeen = Boolean(result?.hasSeenOnboarding)
  const response = NextResponse.json(result ?? { hasSeenOnboarding: false })

  // Heal: Convex says done but cookie missing (new browser, cleared cookies once, etc.)
  if (hasSeen && cookieUid !== session.user.id) {
    response.cookies.set(ONBOARDING_SEEN_COOKIE, session.user.id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    })
  }

  return response
}
