import * as Sentry from '@sentry/nextjs'
import { sanitizeSentryEvent } from '@/lib/sentry-sanitize'

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.1,
  beforeSend: sanitizeSentryEvent,
})
