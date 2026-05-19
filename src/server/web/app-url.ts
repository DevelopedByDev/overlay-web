import 'server-only'

import type { NextRequest } from 'next/server'
import { publicEnv, isDevelopmentBuild } from '@/shared/env/public-env'
import {
  DEFAULT_APP_URL,
  isLocalOrigin,
  normalizeAppBaseUrl,
} from '@/shared/web/normalize-app-url'
import { isDevelopmentRuntime, serverEnv } from '@/server/env/server-env'

/**
 * Canonical app base URL for server-side redirects, Stripe, WorkOS, etc.
 */
export function getBaseUrl(): string {
  if (isDevelopmentRuntime()) {
    const fromEnv = serverEnv.devAppUrlOverride || publicEnv.appUrl
    return normalizeAppBaseUrl(fromEnv, DEFAULT_APP_URL)
  }

  if (publicEnv.appUrl) {
    return normalizeAppBaseUrl(publicEnv.appUrl, DEFAULT_APP_URL)
  }

  if (serverEnv.vercelUrl) {
    return normalizeAppBaseUrl(`https://${serverEnv.vercelUrl}`, DEFAULT_APP_URL)
  }

  return DEFAULT_APP_URL
}

/**
 * Base URL for server-side `fetch` to this app's own Route Handlers.
 * Trusts the request origin when it matches the configured app origin,
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

    if (isDevelopmentBuild() && isLocalOrigin(requestOrigin)) {
      return requestOrigin
    }
  }

  return canonicalBaseUrl
}
