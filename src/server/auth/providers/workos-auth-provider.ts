import 'server-only'

import { getVerifiedAccessTokenClaims } from '../../../../convex/lib/auth'
import {
  getSession,
  type AuthSession,
} from '@/server/auth/workos-auth'
import type {
  AuthProvider,
  Session,
  TokenClaims,
  UserProfile,
} from '@overlay/app-core'

function toProviderSession(session: AuthSession): Session {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: session.user,
    expiresAt: session.expiresAt,
  }
}

function toTokenClaims(claims: Record<string, unknown>): TokenClaims | null {
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

function toUserProfile(claims: TokenClaims): UserProfile {
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    firstName: typeof claims.firstName === 'string' ? claims.firstName : undefined,
    lastName: typeof claims.lastName === 'string' ? claims.lastName : undefined,
    profilePictureUrl:
      typeof claims.profilePictureUrl === 'string' ? claims.profilePictureUrl : undefined,
    emailVerified:
      typeof claims.emailVerified === 'boolean' ? claims.emailVerified : undefined,
  }
}

export class WorkOSAuthProvider implements AuthProvider {
  async getSession(req: Request): Promise<Session | null> {
    void req
    const session = await getSession()
    return session ? toProviderSession(session) : null
  }

  async verifyAccessToken(token: string): Promise<TokenClaims | null> {
    const claims = await getVerifiedAccessTokenClaims(token)
    return claims ? toTokenClaims(claims) : null
  }

  async getUserProfile(token: string): Promise<UserProfile | null> {
    const claims = await this.verifyAccessToken(token)
    return claims ? toUserProfile(claims) : null
  }
}
