import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE_NAME = 'overlay_session'

const PROTECTED_ROUTES = ['/account', '/api/entitlements', '/api/portal', '/app', '/api/app']

const PUBLIC_ROUTES = [
  '/',
  '/auth',
  '/api/auth',
  '/api/webhooks',
  '/api/checkout/verify',
  '/api/slack', // Slack uses its own HMAC signature verification
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  if (isProtectedRoute(pathname)) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)

    if (!sessionCookie?.value) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      const signInUrl = new URL('/auth/sign-in', request.url)
      signInUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(signInUrl)
    }

    // Validate cookie has expected signed format (payload.signature)
    const parts = sessionCookie.value.split('.')
    if (parts.length < 2 || parts[0].length < 10) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Invalid session' },
          { status: 401 }
        )
      }
      const signInUrl = new URL('/auth/sign-in', request.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
