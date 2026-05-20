import 'server-only'

import type {
  AuthProvider,
  Session,
  TokenClaims,
  UserProfile,
} from '@overlay/app-core'

export class NoOpAuthProvider implements AuthProvider {
  async getSession(req: Request): Promise<Session | null> {
    void req
    return null
  }

  async verifyAccessToken(token: string): Promise<TokenClaims | null> {
    void token
    return null
  }

  async getUserProfile(token: string): Promise<UserProfile | null> {
    void token
    return null
  }
}
