import type { NextRequest } from 'next/server'

/** Stable string for app base (no trailing slash on origin-only URLs). */
function formatParsedBaseUrl(u: URL): string {
  if (u.pathname === '/' && !u.search && !u.hash) {
    return u.origin
  }
  return `${u.origin}${u.pathname}${u.search}${u.hash}`
}

/**
 * Env vars are often set to `localhost:3000` without a scheme; `new URL()` then throws Invalid URL.
 */
function normalizeAppBaseUrl(raw: string | undefined, fallback: string): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) {
    return fallback
  }
  try {
    const u = new URL(trimmed)
    // Node accepts `localhost:3000` as a bogus URL (protocol `localhost:`, origin `"null"`).
    // Only treat real http(s) bases as already valid.
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return formatParsedBaseUrl(u)
    }
  } catch {
    // continue to scheme prepending
  }
  if (trimmed.includes('://')) {
    return fallback
  }
  const hostPort = trimmed.split('/')[0] ?? trimmed
  const hostname = (hostPort.split(':')[0] ?? '').toLowerCase()
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
  const prefixed = `${isLocal ? 'http' : 'https'}://${trimmed}`
  try {
    return formatParsedBaseUrl(new URL(prefixed))
  } catch {
    return fallback
  }
}

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

const DEFAULT_APP_URL = 'https://getoverlay.io'

export function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'development') {
    const fromEnv =
      process.env.DEV_NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
    return normalizeAppBaseUrl(fromEnv, DEFAULT_APP_URL)
  }

  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return normalizeAppBaseUrl(process.env.NEXT_PUBLIC_APP_URL, DEFAULT_APP_URL)
  }

  const vercelHost = process.env.VERCEL_URL?.trim()
  if (vercelHost) {
    return normalizeAppBaseUrl(`https://${vercelHost}`, DEFAULT_APP_URL)
  }

  return DEFAULT_APP_URL
}
