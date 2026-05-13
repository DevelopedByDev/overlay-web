import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { ONBOARDING_SEEN_COOKIE } from '@/lib/onboarding-cookie'

export async function GET(request: NextRequest) {
  const session = await getSession()
  const auth = await resolveAuthenticatedAppUser(request, {})
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const userId = auth.userId

  const cookieStore = await cookies()
  const cookieUid = cookieStore.get(ONBOARDING_SEEN_COOKIE)?.value
  if (cookieUid === userId) {
    return NextResponse.json({ hasSeenOnboarding: true })
  }

  const result = (await convex.query('users:getOnboardingStatus', {
    serverSecret: getInternalApiSecret(),
    userId,
  })) as { hasSeenOnboarding?: boolean } | null

  const hasSeen = Boolean(result?.hasSeenOnboarding)
  const response = NextResponse.json(result ?? { hasSeenOnboarding: false })

  // Heal: Convex says done but cookie missing (new browser, cleared cookies once, etc.)
  if (session?.user?.id === userId && hasSeen && cookieUid !== userId) {
    response.cookies.set(ONBOARDING_SEEN_COOKIE, userId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    })
  }

  return response
}
