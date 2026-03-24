import type { NextRequest } from 'next/server'

/**
 * Base URL for server-side `fetch` to this app's own Route Handlers (memory, knowledge, files).
 * Prefer the incoming request's host so local dev does not POST to production.
 */
export function getInternalApiBaseUrl(request?: NextRequest): string {
  if (request) {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    if (host) {
      const forwarded = request.headers.get('x-forwarded-proto')
      const proto =
        forwarded ||
        (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
      return `${proto}://${host}`
    }
  }
  return getBaseUrl()
}

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  if (process.env.NODE_ENV === 'development') {
    return process.env.DEV_NEXT_PUBLIC_APP_URL || 'https://getoverlay.io'
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return 'https://getoverlay.io'
}
