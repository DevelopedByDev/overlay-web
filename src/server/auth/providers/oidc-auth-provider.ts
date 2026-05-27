import 'server-only'

import type {
  AuthProvider,
  Session,
  TokenClaims,
  UserProfile,
} from '@overlay/app-core'

export interface OidcAuthProviderConfig {
  issuerUrl?: string
  clientId?: string
  clientSecret?: string
  audience?: string
}

export class OidcAuthProvider implements AuthProvider {
  readonly providerConfigSummary: {
    provider: 'oidc' | 'keycloak'
    issuerUrl?: string
    clientId?: string
    hasClientSecret: boolean
    audience?: string
  }

  constructor(private readonly config: OidcAuthProviderConfig = {}) {
    this.providerConfigSummary = {
      provider: 'oidc',
      ...(config.issuerUrl ? { issuerUrl: config.issuerUrl } : {}),
      ...(config.clientId ? { clientId: config.clientId } : {}),
      hasClientSecret: Boolean(config.clientSecret),
      ...(config.audience ? { audience: config.audience } : {}),
    }
  }

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

  async deleteUser(userId: string): Promise<void> {
    void userId
  }
}
