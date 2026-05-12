import type { IAuth } from './interface'
import type { AuthCallbackResult, AuthRedirectOptions, AuthResult, AuthSession, AuthUser, Session, UserRole } from './types'
import { UnsupportedAuthFlowError } from './errors'

export interface WorkOSAuthHandlers {
  getSession(request?: Request): Promise<AuthSession | null>
  createSignInUrl(options?: AuthRedirectOptions): Promise<string> | string
  createSignUpUrl(options?: AuthRedirectOptions): Promise<string> | string
  handleCallback(request: Request): Promise<AuthCallbackResult>
  refreshSession(session: AuthSession): Promise<AuthSession>
  signOut(session?: AuthSession | null): Promise<void>
  getUserInfo?(session: AuthSession): Promise<AuthUser>
  syncUserProfile?(user: AuthUser): Promise<AuthUser>
  listUsers?(params?: { page?: number; limit?: number }): Promise<AuthUser[]>
  createNativeAuthorizationUrl?(options: AuthRedirectOptions): Promise<string> | string
  exchangeNativeCode?(code: string, codeVerifier?: string): Promise<AuthSession>
  refreshNativeSession?(refreshToken: string): Promise<AuthSession>
  createDesktopLink?(session: AuthSession): Promise<string> | string
  createUser?(params: { email: string; password?: string; firstName?: string; lastName?: string }): Promise<AuthUser>
  sendPasswordResetEmail?(email: string): Promise<void>
  resetPassword?(token: string, password: string): Promise<void>
  verifyEmail?(token: string): Promise<AuthUser>
  resendVerificationEmail?(email: string): Promise<void>
}

export class WorkOSAuth implements IAuth {
  readonly providerId = 'workos'

  constructor(private readonly handlers: WorkOSAuthHandlers) {}

  async health(): Promise<{ ok: boolean; message?: string; latencyMs?: number }> {
    const start = Date.now()
    await this.handlers.getSession()
    return { ok: true, latencyMs: Date.now() - start }
  }

  getSession(request?: Request): Promise<AuthSession | null> {
    return this.handlers.getSession(request)
  }

  async requireSession(request?: Request): Promise<AuthSession> {
    const session = await this.getSession(request)
    if (!session) throw new Error('Authentication required')
    return session
  }

  createSignInUrl(options?: AuthRedirectOptions): Promise<string> | string {
    return this.handlers.createSignInUrl(options)
  }

  createSignUpUrl(options?: AuthRedirectOptions): Promise<string> | string {
    return this.handlers.createSignUpUrl(options)
  }

  handleCallback(request: Request): Promise<AuthCallbackResult> {
    return this.handlers.handleCallback(request)
  }

  refreshSession(session: AuthSession): Promise<AuthSession> {
    return this.handlers.refreshSession(session)
  }

  signOut(session?: AuthSession | null): Promise<void> {
    return this.handlers.signOut(session)
  }

  getUserInfo(session: AuthSession): Promise<AuthUser> {
    return this.handlers.getUserInfo?.(session) ?? Promise.resolve(session.user)
  }

  syncUserProfile(user: AuthUser): Promise<AuthUser> {
    return this.handlers.syncUserProfile?.(user) ?? Promise.resolve(user)
  }

  listUsers(params?: { page?: number; limit?: number }): Promise<AuthUser[]> {
    return this.handlers.listUsers?.(params) ?? Promise.resolve([])
  }

  async authenticate(request: Request): Promise<AuthResult> {
    const session = await this.getSession(request)
    return session
      ? { success: true, user: session.user, session: toSession(session) }
      : { success: false, error: 'No active session' }
  }

  logout(_request: Request): Promise<void> {
    return this.signOut(null)
  }

  async validateSession(token: string): Promise<AuthUser | null> {
    if (!token) return null
    return null
  }

  async revokeSession(_token: string): Promise<void> {}
  async revokeAllUserSessions(_userId: string): Promise<void> {}
  async listActiveSessions(_userId: string): Promise<Session[]> {
    return []
  }
  async getUserRole(_userId: string): Promise<UserRole> {
    return 'user'
  }
  async setUserRole(_userId: string, _role: UserRole): Promise<void> {}
  async hasPermission(_userId: string, _permission: string): Promise<boolean> {
    return false
  }

  createNativeAuthorizationUrl(options: AuthRedirectOptions): Promise<string> | string {
    return this.handlers.createNativeAuthorizationUrl?.(options) ?? unsupported(this.providerId, 'native_authorize')
  }
  exchangeNativeCode(code: string, codeVerifier?: string): Promise<AuthSession> {
    return this.handlers.exchangeNativeCode?.(code, codeVerifier) ?? unsupported(this.providerId, 'native_exchange')
  }
  refreshNativeSession(refreshToken: string): Promise<AuthSession> {
    return this.handlers.refreshNativeSession?.(refreshToken) ?? unsupported(this.providerId, 'native_refresh')
  }
  createDesktopLink(session: AuthSession): Promise<string> | string {
    return this.handlers.createDesktopLink?.(session) ?? unsupported(this.providerId, 'desktop_link')
  }
  createUser(params: { email: string; password?: string; firstName?: string; lastName?: string }): Promise<AuthUser> {
    return this.handlers.createUser?.(params) ?? unsupported(this.providerId, 'create_user')
  }
  sendPasswordResetEmail(email: string): Promise<void> {
    return this.handlers.sendPasswordResetEmail?.(email) ?? unsupported(this.providerId, 'password_reset_email')
  }
  resetPassword(token: string, password: string): Promise<void> {
    return this.handlers.resetPassword?.(token, password) ?? unsupported(this.providerId, 'reset_password')
  }
  verifyEmail(token: string): Promise<AuthUser> {
    return this.handlers.verifyEmail?.(token) ?? unsupported(this.providerId, 'verify_email')
  }
  resendVerificationEmail(email: string): Promise<void> {
    return this.handlers.resendVerificationEmail?.(email) ?? unsupported(this.providerId, 'resend_verification_email')
  }
}

function toSession(session: AuthSession): Session {
  return {
    id: session.accessToken.slice(0, 16),
    userId: session.user.id,
    token: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    createdAt: Date.now(),
  }
}

function unsupported<T>(providerId: string, flow: string): T {
  throw new UnsupportedAuthFlowError(providerId, flow)
}
