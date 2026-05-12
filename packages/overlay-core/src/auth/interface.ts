// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Auth layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type {
  AuthCallbackResult,
  AuthProviderHealth,
  AuthRedirectOptions,
  AuthResult,
  AuthSession,
  AuthUser,
  Session,
  UserRole,
} from './types'

export interface IAuth {
  readonly providerId?: string

  init?(): Promise<void>
  health?(): Promise<AuthProviderHealth>

  getSession(request?: Request): Promise<AuthSession | null>
  requireSession(request?: Request): Promise<AuthSession>
  createSignInUrl(options?: AuthRedirectOptions): Promise<string> | string
  createSignUpUrl(options?: AuthRedirectOptions): Promise<string> | string
  handleCallback(request: Request): Promise<AuthCallbackResult>
  refreshSession(session: AuthSession): Promise<AuthSession>
  signOut(session?: AuthSession | null): Promise<void>
  getUserInfo(session: AuthSession): Promise<AuthUser>
  syncUserProfile(user: AuthUser): Promise<AuthUser>
  listUsers(params?: { page?: number; limit?: number }): Promise<AuthUser[]>

  authenticate(request: Request): Promise<AuthResult>
  logout(request: Request): Promise<void>
  validateSession(token: string): Promise<AuthUser | null>
  revokeSession(token: string): Promise<void>
  revokeAllUserSessions(userId: string): Promise<void>
  listActiveSessions(userId: string): Promise<Session[]>

  // RBAC
  getUserRole(userId: string): Promise<UserRole>
  setUserRole(userId: string, role: UserRole): Promise<void>
  hasPermission(userId: string, permission: string): Promise<boolean>

  // Native/mobile helpers. Providers that do not support these flows should
  // throw a clear unsupported-flow error.
  createNativeAuthorizationUrl?(options: AuthRedirectOptions): Promise<string> | string
  exchangeNativeCode?(code: string, codeVerifier?: string): Promise<AuthSession>
  refreshNativeSession?(refreshToken: string): Promise<AuthSession>
  createDesktopLink?(session: AuthSession): Promise<string> | string

  // Email/password helpers for WorkOS/local auth.
  createUser?(params: { email: string; password?: string; firstName?: string; lastName?: string }): Promise<AuthUser>
  sendPasswordResetEmail?(email: string): Promise<void>
  resetPassword?(token: string, password: string): Promise<void>
  verifyEmail?(token: string): Promise<AuthUser>
  resendVerificationEmail?(email: string): Promise<void>
}
