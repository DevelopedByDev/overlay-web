import 'server-only'

import { logger } from '@/server/observability/logger'
import * as Sentry from '@sentry/nextjs'
import { publicEnv } from '@/shared/env/public-env'
import { serverEnv } from '@/server/env/server-env'

type SecurityEventLevel = 'info' | 'warning' | 'error'

function sentryEnabled(): boolean {
  return Boolean(serverEnv.sentryDsn || publicEnv.sentryDsn)
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
    logger.error('[SecurityEvent]', serialized)
  } else if (level === 'info') {
    logger.info('[SecurityEvent]', serialized)
  } else {
    logger.warn('[SecurityEvent]', serialized)
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
