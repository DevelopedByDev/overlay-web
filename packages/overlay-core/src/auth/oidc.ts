import type { IAuth } from './interface'
import type { AuthCallbackResult, AuthProviderConfig, AuthRedirectOptions, AuthResult, AuthSession, AuthUser, Session, UserRole } from './types'
import { UnsupportedAuthFlowError } from './errors'

interface OidcDiscovery {
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint?: string
  end_session_endpoint?: string
}

export interface OIDCAuthOptions extends AuthProviderConfig {
  issuer: string
  clientId: string
  clientSecret?: string
  redirectUri: string
  scopes?: string[]
  groupClaim?: string
  roleClaim?: string
  fetchImpl?: typeof fetch
}

export class OIDCAuth implements IAuth {
  readonly providerId = 'oidc'
  private discovery: OidcDiscovery | null = null
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: OIDCAuthOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async init(): Promise<void> {
    await this.getDiscovery()
  }

  async health(): Promise<{ ok: boolean; message?: string; latencyMs?: number }> {
    const start = Date.now()
    await this.getDiscovery()
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

  async createSignInUrl(options?: AuthRedirectOptions): Promise<string> {
    const discovery = await this.getDiscovery()
    const redirectUri = options?.redirectUri ?? this.options.redirectUri
    const params = new URLSearchParams({
      client_id: this.options.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: (this.options.scopes ?? ['openid', 'email', 'profile']).join(' '),
    })
    if (options?.codeChallenge) {
      params.set('code_challenge', options.codeChallenge)
      params.set('code_challenge_method', 'S256')
    }
    return `${discovery.authorization_endpoint}?${params.toString()}`
  }

  createSignUpUrl(options?: AuthRedirectOptions): Promise<string> | string {
    return this.createSignInUrl(options)
  }

  async handleCallback(request: Request): Promise<AuthCallbackResult> {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    if (!code) throw new Error('OIDC callback is missing code.')
    const session = await this.exchangeCode(code, this.options.redirectUri)
    return { session }
  }

  async refreshSession(session: AuthSession): Promise<AuthSession> {
    if (!session.refreshToken) return session
    const discovery = await this.getDiscovery()
    const token = await this.postToken(discovery.token_endpoint, {
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    })
    return this.sessionFromToken(token, session.user)
  }

  async signOut(): Promise<void> {}

  async getUserInfo(session: AuthSession): Promise<AuthUser> {
    const discovery = await this.getDiscovery()
    if (!discovery.userinfo_endpoint) return session.user
    const response = await this.fetchImpl(discovery.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    if (!response.ok) throw new Error(`OIDC userinfo failed with HTTP ${response.status}`)
    return this.userFromClaims(await response.json() as Record<string, unknown>)
  }

  async syncUserProfile(user: AuthUser): Promise<AuthUser> {
    return user
  }

  async listUsers(): Promise<AuthUser[]> {
    return []
  }

  async authenticate(request: Request): Promise<AuthResult> {
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) return { success: false, error: 'No bearer token' }
    const user = await this.validateSession(authorization.slice('Bearer '.length))
    return user ? { success: true, user } : { success: false, error: 'Invalid bearer token' }
  }

  async logout(_request: Request): Promise<void> {}

  async validateSession(token: string): Promise<AuthUser | null> {
    if (!token) return null
    const [, payload] = token.split('.')
    if (!payload) return null
    try {
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>
      return this.userFromClaims(claims)
    } catch {
      return null
    }
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

  async exchangeNativeCode(code: string): Promise<AuthSession> {
    return this.exchangeCode(code, this.options.redirectUri)
  }

  createNativeAuthorizationUrl(options: AuthRedirectOptions): Promise<string> | string {
    return this.createSignInUrl(options)
  }

  async refreshNativeSession(refreshToken: string): Promise<AuthSession> {
    return this.refreshSession({ accessToken: '', refreshToken, user: { id: '', email: '' }, expiresAt: 0 })
  }

  createDesktopLink(): string {
    throw new UnsupportedAuthFlowError(this.providerId, 'desktop_link')
  }

  private async exchangeCode(code: string, redirectUri: string): Promise<AuthSession> {
    const discovery = await this.getDiscovery()
    const token = await this.postToken(discovery.token_endpoint, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    })
    return this.sessionFromToken(token)
  }

  private async postToken(endpoint: string, body: Record<string, string>): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({
      client_id: this.options.clientId,
      ...body,
    })
    if (this.options.clientSecret) params.set('client_secret', this.options.clientSecret)
    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })
    if (!response.ok) throw new Error(`OIDC token exchange failed with HTTP ${response.status}`)
    return await response.json() as Record<string, unknown>
  }

  private async getDiscovery(): Promise<OidcDiscovery> {
    if (this.discovery) return this.discovery
    const issuer = this.options.issuer.replace(/\/$/, '')
    const response = await this.fetchImpl(`${issuer}/.well-known/openid-configuration`)
    if (!response.ok) throw new Error(`OIDC discovery failed with HTTP ${response.status}`)
    this.discovery = await response.json() as OidcDiscovery
    return this.discovery
  }

  private sessionFromToken(token: Record<string, unknown>, fallbackUser?: AuthUser): AuthSession {
    const accessToken = String(token.access_token ?? '')
    const refreshToken = typeof token.refresh_token === 'string' ? token.refresh_token : undefined
    const expiresIn = typeof token.expires_in === 'number' ? token.expires_in : 3600
    const user = fallbackUser ?? this.userFromClaims(readJwtClaims(accessToken))
    return {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
      user,
    }
  }

  private userFromClaims(claims: Record<string, unknown>): AuthUser {
    const groups = arrayClaim(claims[this.options.groupClaim ?? 'groups'])
    const roleClaim = arrayClaim(claims[this.options.roleClaim ?? 'roles'])[0] ?? groups[0]
    const mappedRole = roleClaim ? this.options.roleMapping?.[roleClaim] : undefined
    return {
      id: String(claims.sub ?? claims.user_id ?? ''),
      orgId: typeof claims.org_id === 'string' ? claims.org_id : undefined,
      email: String(claims.email ?? ''),
      firstName: typeof claims.given_name === 'string' ? claims.given_name : undefined,
      lastName: typeof claims.family_name === 'string' ? claims.family_name : undefined,
      profilePictureUrl: typeof claims.picture === 'string' ? claims.picture : undefined,
      emailVerified: Boolean(claims.email_verified),
      role: mappedRole ?? this.options.defaultRole ?? 'user',
      groups,
      claims,
    }
  }
}

function readJwtClaims(token: string): Record<string, unknown> {
  const [, payload] = token.split('.')
  if (!payload) return {}
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

function arrayClaim(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value === 'string') return [value]
  return []
}
