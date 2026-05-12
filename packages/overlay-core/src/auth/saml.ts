import type { IAuth } from './interface'
import type { AuthCallbackResult, AuthProviderConfig, AuthRedirectOptions, AuthResult, AuthSession, AuthUser, Session, UserRole } from './types'
import { UnsupportedAuthFlowError } from './errors'

export interface SAMLAuthOptions extends AuthProviderConfig {
  metadataUrl?: string
  metadataXml?: string
  entryPoint?: string
  issuer?: string
  cert?: string
  callbackUrl: string
  groupAttribute?: string
  roleAttribute?: string
  fetchImpl?: typeof fetch
}

export class SAMLAuth implements IAuth {
  readonly providerId = 'saml'
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: SAMLAuthOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async init(): Promise<void> {
    await this.health()
  }

  async health(): Promise<{ ok: boolean; message?: string; latencyMs?: number }> {
    const start = Date.now()
    if (this.options.metadataUrl) {
      const response = await this.fetchImpl(this.options.metadataUrl, { method: 'GET' })
      if (!response.ok) throw new Error(`SAML metadata fetch failed with HTTP ${response.status}`)
    }
    if (!this.options.metadataUrl && !this.options.metadataXml && !this.options.entryPoint) {
      throw new Error('SAML provider requires metadataUrl, metadataXml, or entryPoint.')
    }
    return { ok: true, latencyMs: Date.now() - start }
  }

  async getSession(_request?: Request): Promise<AuthSession | null> {
    return null
  }

  async requireSession(request?: Request): Promise<AuthSession> {
    const session = await this.getSession(request)
    if (!session) throw new Error('Authentication required')
    return session
  }

  createSignInUrl(options?: AuthRedirectOptions): string {
    const entryPoint = this.options.entryPoint ?? this.options.metadataUrl
    if (!entryPoint) throw new Error('SAML entry point is not configured.')
    const url = new URL(entryPoint)
    if (options?.redirectUri) url.searchParams.set('RelayState', options.redirectUri)
    return url.toString()
  }

  createSignUpUrl(options?: AuthRedirectOptions): string {
    return this.createSignInUrl(options)
  }

  async handleCallback(_request: Request): Promise<AuthCallbackResult> {
    throw new UnsupportedAuthFlowError(this.providerId, 'assertion_consumer_service_runtime')
  }

  async refreshSession(session: AuthSession): Promise<AuthSession> {
    return session
  }

  async signOut(): Promise<void> {}

  async getUserInfo(session: AuthSession): Promise<AuthUser> {
    return session.user
  }

  async syncUserProfile(user: AuthUser): Promise<AuthUser> {
    return user
  }

  async listUsers(): Promise<AuthUser[]> {
    return []
  }

  async authenticate(_request: Request): Promise<AuthResult> {
    return { success: false, error: 'SAML bearer authentication is not supported.' }
  }

  async logout(_request: Request): Promise<void> {}

  async validateSession(_token: string): Promise<AuthUser | null> {
    return null
  }

  async revokeSession(_token: string): Promise<void> {}
  async revokeAllUserSessions(_userId: string): Promise<void> {}
  async listActiveSessions(_userId: string): Promise<Session[]> {
    return []
  }
  async getUserRole(_userId: string): Promise<UserRole> {
    return this.options.defaultRole ?? 'user'
  }
  async setUserRole(_userId: string, _role: UserRole): Promise<void> {}
  async hasPermission(_userId: string, _permission: string): Promise<boolean> {
    return false
  }

  mapAttributesToUser(attributes: Record<string, unknown>): AuthUser {
    const groups = arrayClaim(attributes[this.options.groupAttribute ?? 'groups'])
    const roleClaim = arrayClaim(attributes[this.options.roleAttribute ?? 'roles'])[0] ?? groups[0]
    const role = roleClaim ? this.options.roleMapping?.[roleClaim] : undefined
    return {
      id: String(attributes.nameID ?? attributes.uid ?? attributes.email ?? ''),
      email: String(attributes.email ?? attributes.mail ?? ''),
      firstName: optionalString(attributes.firstName ?? attributes.givenName),
      lastName: optionalString(attributes.lastName ?? attributes.sn),
      emailVerified: true,
      role: role ?? this.options.defaultRole ?? 'user',
      groups,
      claims: attributes,
    }
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function arrayClaim(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value === 'string') return [value]
  return []
}
