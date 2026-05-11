// @overlay/core — extracted from src/lib/security-events.ts
// Structured security event logger. Sentry-free version for core package.
// Production callers should also send to Sentry if desired.

type SecurityEventLevel = 'info' | 'warning' | 'error'

export function logSecurityEvent(
  type: string,
  details: Record<string, unknown>,
  level: SecurityEventLevel = 'warning',
) {
  const payload = {
    type,
    level,
    timestamp: new Date().toISOString(),
    ...details,
  }

  const serialized = JSON.stringify(payload)
  if (level === 'error') {
    console.error('[SecurityEvent]', serialized)
  } else if (level === 'info') {
    console.info('[SecurityEvent]', serialized)
  } else {
    console.warn('[SecurityEvent]', serialized)
  }
}
