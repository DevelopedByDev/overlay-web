// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Auth layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type { AuthUser, AuthResult, Session, UserRole } from './types'

export interface IAuth {
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
}
