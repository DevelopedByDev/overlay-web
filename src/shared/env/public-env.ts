/**
 * Client-safe environment values (NEXT_PUBLIC_* only).
 * Next.js inlines these at build time in browser bundles.
 * Do not add server secrets or non-NEXT_PUBLIC vars here.
 */

function read(name: string): string {
  return process.env[name]?.trim() ?? ''
}

export const publicEnv = {
  appUrl: read('NEXT_PUBLIC_APP_URL'),
  convexUrl: read('NEXT_PUBLIC_CONVEX_URL'),
  devConvexUrl: read('DEV_NEXT_PUBLIC_CONVEX_URL') || read('NEXT_PUBLIC_DEV_CONVEX_URL'),
  chatStreamRelayUrl: read('NEXT_PUBLIC_CHAT_STREAM_RELAY_URL'),
  sentryDsn: read('NEXT_PUBLIC_SENTRY_DSN'),
} as const

/** True in development builds (inlined by the bundler). */
export function isDevelopmentBuild(): boolean {
  return process.env.NODE_ENV === 'development'
}
