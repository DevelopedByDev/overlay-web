// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Audit logging layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

export interface IAudit {
  log(event: AuditEvent): Promise<void>
  query(opts?: AuditQueryOptions): Promise<AuditEvent[]>
}

export interface AuditEvent {
  id: string
  timestamp: number
  actorId: string
  actorType: 'user' | 'system' | 'plugin'
  action: string
  resource: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export interface AuditQueryOptions {
  limit?: number
  cursor?: string
  actorId?: string
  action?: string
  resource?: string
  from?: number
  to?: number
}
