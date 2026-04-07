import type { NextRequest } from 'next/server'

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

/**
 * Base URL for server-side `fetch` to this app's own Route Handlers (memory, knowledge, files).
 * Only trust the incoming request origin when it matches the configured app origin,
 * or when local development is explicitly using localhost.
 */
export function getInternalApiBaseUrl(request?: NextRequest): string {
  const canonicalBaseUrl = getBaseUrl()
  const canonicalOrigin = new URL(canonicalBaseUrl).origin

  if (request) {
    const requestOrigin = request.nextUrl.origin
    if (requestOrigin === canonicalOrigin) {
      return requestOrigin
    }

    if (process.env.NODE_ENV === 'development' && isLocalOrigin(requestOrigin)) {
      return requestOrigin
    }
  }

  return canonicalBaseUrl
}

export function getAutomationExecutorBaseUrl(): string {
  const explicitExecutorBaseUrl = process.env.AUTOMATION_EXECUTOR_BASE_URL?.trim()
  if (explicitExecutorBaseUrl) {
    return explicitExecutorBaseUrl
  }

  return getBaseUrl()
}

export function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'development') {
    return process.env.DEV_NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://getoverlay.io'
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return 'https://getoverlay.io'
}
