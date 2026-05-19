import * as Sentry from '@sentry/nextjs'

type SecurityEventLevel = 'info' | 'warning' | 'error'

function sentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)
}

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

  if (!sentryEnabled()) {
    return
  }

  Sentry.withScope((scope) => {
    scope.setTag('security_event', type)
    scope.setLevel(level === 'error' ? 'error' : level === 'info' ? 'info' : 'warning')
    for (const [key, value] of Object.entries(details)) {
      scope.setExtra(key, value)
    }
    Sentry.captureMessage(`security_event:${type}`)
  })
}
