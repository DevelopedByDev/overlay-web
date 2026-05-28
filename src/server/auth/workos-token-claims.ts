import type { Session, TokenClaims, UserProfile } from '@overlay/app-core'

export const ACCESS_TOKEN_REFRESH_LEEWAY_MS = 120_000
export const COOKIE_REFRESH_WITHIN_MS = 24 * 60 * 60 * 1000

export function decodeJwtExpMs(accessToken: string): number | null {
  try {
    const parts = accessToken.trim().split('.')
    if (parts.length !== 3) return null
    const segment = parts[1]!
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
    const pad = normalized.length % 4
    const padded = pad === 0 ? normalized : normalized + '='.repeat(4 - pad)
    const json = Buffer.from(padded, 'base64').toString('utf-8')
    const payload = JSON.parse(json) as { exp?: number }
    if (typeof payload.exp !== 'number') return null
    return payload.exp * 1000
  } catch {
    return null
  }
}

export function shouldRefreshAccessToken(accessToken: string, now = Date.now()): boolean {
  const expMs = decodeJwtExpMs(accessToken)
  if (expMs === null) return true
  return expMs <= now + ACCESS_TOKEN_REFRESH_LEEWAY_MS
}

export function toProviderSession(session: {
  accessToken: string
  refreshToken?: string
  user: Session['user']
  expiresAt?: number
}): Session {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: session.user,
    expiresAt: session.expiresAt,
  }
}

export function toTokenClaims(claims: Record<string, unknown>): TokenClaims | null {
  if (
    typeof claims.iss !== 'string' ||
    typeof claims.sub !== 'string' ||
    typeof claims.exp !== 'number'
  ) {
    return null
  }

  return {
    ...claims,
    iss: claims.iss,
    sub: claims.sub,
    aud:
      typeof claims.aud === 'string' || Array.isArray(claims.aud)
        ? claims.aud
        : undefined,
    exp: claims.exp,
    iat: typeof claims.iat === 'number' ? claims.iat : undefined,
  }
}

export function toUserProfile(claims: TokenClaims): UserProfile {
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    firstName: typeof claims.firstName === 'string' ? claims.firstName : undefined,
    lastName: typeof claims.lastName === 'string' ? claims.lastName : undefined,
    profilePictureUrl:
      typeof claims.profilePictureUrl === 'string'
        ? claims.profilePictureUrl
        : undefined,
    emailVerified:
      typeof claims.emailVerified === 'boolean' ? claims.emailVerified : undefined,
  }
}
