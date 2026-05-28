import * as Sentry from '@sentry/nextjs'
import { sanitizeSentryEvent } from '@/shared/security/sentry-sanitize'

// Intentional mirror of sentry.server.config.ts: Next.js loads edge and server configs separately.
Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.1,
  beforeSend: sanitizeSentryEvent,
})
