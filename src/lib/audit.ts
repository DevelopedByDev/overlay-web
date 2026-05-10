// @enterprise-future — not wired to production
// Structured audit logger.
// Writes JSON lines to stderr; keeps an in-memory ring buffer for API reads.
// In Phase 4 this can be swapped to write to a Convex auditLogs table.

export interface AuditEvent {
  id: string
  timestamp: number
  actorId: string
  actorType: 'user' | 'system'
  action: string
  resource: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

const RING_BUFFER_SIZE = 1000
const ringBuffer: AuditEvent[] = []

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function logAuditEvent(
  event: Omit<AuditEvent, 'id' | 'timestamp'>,
): AuditEvent {
  const fullEvent: AuditEvent = {
    ...event,
    id: generateId(),
    timestamp: Date.now(),
  }

  // Push to ring buffer
  ringBuffer.push(fullEvent)
  if (ringBuffer.length > RING_BUFFER_SIZE) {
    ringBuffer.shift()
  }

  // Write structured JSON to stderr
  console.error(`[AUDIT] ${JSON.stringify(fullEvent)}`)

  return fullEvent
}

export function getRecentAuditEvents(options?: {
  limit?: number
  action?: string
  actorId?: string
}): AuditEvent[] {
  let events = [...ringBuffer].reverse()
  if (options?.action) {
    events = events.filter((e) => e.action === options.action)
  }
  if (options?.actorId) {
    events = events.filter((e) => e.actorId === options.actorId)
  }
  const limit = options?.limit ?? 50
  return events.slice(0, limit)
}
