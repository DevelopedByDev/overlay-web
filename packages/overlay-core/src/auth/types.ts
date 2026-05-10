// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Auth layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

export type UserRole = 'superadmin' | 'admin' | 'user' | 'guest'

export interface Session {
  id: string
  userId: string
  token: string
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
  email: string
  firstName?: string
  lastName?: string
  profilePictureUrl?: string
  emailVerified?: boolean
  role?: UserRole
}

export interface NewAuthUser {
  email: string
  firstName?: string
  lastName?: string
  profilePictureUrl?: string
  role?: UserRole
}
