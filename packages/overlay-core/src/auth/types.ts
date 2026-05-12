// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Auth layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

export type UserRole = 'superadmin' | 'admin' | 'user' | 'guest'

export interface Session {
  id: string
  userId: string
  token: string
  refreshToken?: string
  expiresAt: number
  createdAt: number
  ipAddress?: string
  userAgent?: string
}

export interface AuthResult {
  success: boolean
  user?: AuthUser
  session?: Session
  error?: string
}

export interface AuthUser {
  id: string
  orgId?: string
  email: string
  firstName?: string
  lastName?: string
  profilePictureUrl?: string
  emailVerified?: boolean
  role?: UserRole
  groups?: string[]
  claims?: Record<string, unknown>
}

export interface NewAuthUser {
  orgId?: string
  email: string
  firstName?: string
  lastName?: string
  profilePictureUrl?: string
  role?: UserRole
}

export interface AuthSession {
  accessToken: string
  refreshToken?: string
  user: AuthUser
  expiresAt: number
}

export interface AuthRedirectOptions {
  redirectUri?: string
  codeChallenge?: string
  provider?: string
}

export interface AuthCallbackResult {
  session: AuthSession
  redirectTo?: string
}

export interface AuthProviderHealth {
  ok: boolean
  message?: string
  latencyMs?: number
}

export interface AuthProviderConfig {
  sessionTTLMinutes?: number
  defaultRole?: UserRole
  roleMapping?: Record<string, UserRole>
}
