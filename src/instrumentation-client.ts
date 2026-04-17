import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { sanitizeSentryEvent } from '@/lib/sentry-sanitize'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.1,
  beforeSend: sanitizeSentryEvent,
})

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_TOKEN?.trim()
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim()
if (posthogToken && posthogHost) {
  posthog.init(posthogToken, {
    api_host: posthogHost,
    defaults: '2026-01-30',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage',
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
