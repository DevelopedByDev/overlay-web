import 'server-only'

import { clearSession } from '@/server/auth/workos-auth'
import { getOverlayServerContext } from '@/server/bootstrap'
import type { Session } from '@overlay/app-core'
import type { AuthSession } from '@/shared/auth/session-types'

const FALLBACK_SESSION_REQUEST = new Request('http://overlay.local/session')

function toAuthSession(session: Session): AuthSession | null {
  if (!session.refreshToken || typeof session.expiresAt !== 'number') {
    return null
  }

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      profilePictureUrl: session.user.profilePictureUrl,
      emailVerified: session.user.emailVerified ?? false,
    },
  }
}

export async function getOverlaySession(
  request: Request = FALLBACK_SESSION_REQUEST,
): Promise<AuthSession | null> {
  const session = await getOverlayServerContext().auth.getSession(request)
  return session ? toAuthSession(session) : null
}

export async function clearOverlaySession(): Promise<void> {
  await clearSession()
}
