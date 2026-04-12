import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServiceAuthHeaderName, verifyServiceAuthToken } from '@/lib/service-auth'

const SESSION_COOKIE_NAME = 'overlay_session'
const CSP_REPORT_PATH = '/api/security/csp-report'
const CSP_NONCE_HEADER = 'x-csp-nonce'
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production'

const PROTECTED_ROUTES = ['/account', '/api/entitlements', '/api/portal', '/api/convex', '/app', '/api/app']

const PUBLIC_ROUTES = [
  '/',
  '/auth',
  '/api/auth',
  '/api/security',
  '/api/webhooks',
  '/api/checkout/verify',
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

function createCspNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function parseOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  try {
    return new URL(trimmed).origin
  } catch {
    return null
  }
}

function uniqueSources(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  )
}

function buildConnectSrc(): string[] {
  return uniqueSources([
    "'self'",
    'https://api-js.mixpanel.com',
    'https://api.mixpanel.com',
    'https://mixpanel.com',
    parseOrigin(process.env.NEXT_PUBLIC_MIXPANEL_API_HOST),
    parseOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN),
    parseOrigin(process.env.SENTRY_DSN),
    parseOrigin(process.env.NEXT_PUBLIC_CONVEX_URL),
    parseOrigin(process.env.DEV_NEXT_PUBLIC_CONVEX_URL),
    IS_DEVELOPMENT ? 'ws:' : null,
    IS_DEVELOPMENT ? 'wss:' : null,
  ])
}

function getCspHeaderName(): 'Content-Security-Policy' | 'Content-Security-Policy-Report-Only' {
  return process.env.SECURITY_CSP_ENFORCE === 'true'
    ? 'Content-Security-Policy'
    : 'Content-Security-Policy-Report-Only'
}

function buildCspPolicy(nonce: string): string {
  const scriptSrc = uniqueSources([
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    IS_DEVELOPMENT ? "'unsafe-eval'" : null,
    'https://va.vercel-scripts.com',
  ])

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    `connect-src ${buildConnectSrc().join(' ')}`,
    "frame-src 'self' blob: data: https://www.youtube.com https://www.youtube-nocookie.com",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    `report-uri ${CSP_REPORT_PATH}`,
    'report-to csp-endpoint',
  ]

  if (!IS_DEVELOPMENT) {
    directives.push('upgrade-insecure-requests')
  }

  return directives.join('; ')
}

function applyBrowserSecurityHeaders(
  response: NextResponse,
  headerName: 'Content-Security-Policy' | 'Content-Security-Policy-Report-Only',
  cspPolicy: string,
): NextResponse {
  response.headers.set(headerName, cspPolicy)
  response.headers.set('Reporting-Endpoints', `csp-endpoint="${CSP_REPORT_PATH}"`)
  response.headers.delete(
    headerName === 'Content-Security-Policy'
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy'
  )
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const nonce = createCspNonce()
  const cspHeaderName = getCspHeaderName()
  const cspPolicy = buildCspPolicy(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(CSP_NONCE_HEADER, nonce)
  requestHeaders.set(cspHeaderName, cspPolicy)

  const nextResponse = () =>
    applyBrowserSecurityHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      cspHeaderName,
      cspPolicy,
    )

  if (isPublicRoute(pathname)) {
    return nextResponse()
  }

  if (isProtectedRoute(pathname)) {
    if (pathname.startsWith('/api/')) {
      const serviceAuth = await verifyServiceAuthToken(
        request.headers.get(getServiceAuthHeaderName()),
        {
          method: request.method,
          path: pathname,
        },
      )
      if (serviceAuth) {
        return nextResponse()
      }
    }

    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)

    if (!sessionCookie?.value) {
      if (pathname.startsWith('/api/')) {
        return applyBrowserSecurityHeaders(
          NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          ),
          cspHeaderName,
          cspPolicy,
        )
      }
      const signInUrl = new URL('/auth/sign-in', request.url)
      signInUrl.searchParams.set('redirect', pathname)
      return applyBrowserSecurityHeaders(
        NextResponse.redirect(signInUrl),
        cspHeaderName,
        cspPolicy,
      )
    }

    const parts = sessionCookie.value.split('.')
    if (parts.length < 2 || parts[0].length < 10) {
      if (pathname.startsWith('/api/')) {
        return applyBrowserSecurityHeaders(
          NextResponse.json(
            { error: 'Invalid session' },
            { status: 401 }
          ),
          cspHeaderName,
          cspPolicy,
        )
      }
      const signInUrl = new URL('/auth/sign-in', request.url)
      return applyBrowserSecurityHeaders(
        NextResponse.redirect(signInUrl),
        cspHeaderName,
        cspPolicy,
      )
    }
  }

  return nextResponse()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
