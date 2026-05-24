import { NextRequest, NextResponse } from 'next/server'

type RouteContext = {
  params: Promise<{ path?: string[] }>
}

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD'])

async function proxyToV1(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path = [] } = await context.params
  const target = new URL(request.url)
  target.pathname = `/api/v1/${path.map(encodeURIComponent).join('/')}`

  const headers = new Headers(request.headers)
  headers.delete('connection')
  headers.delete('content-length')
  headers.delete('host')
  headers.set('x-overlay-api-compat-route', '/api/app')

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  if (!METHODS_WITHOUT_BODY.has(request.method)) {
    init.body = await request.arrayBuffer()
  }

  const upstream = await fetch(target, init)
  const responseHeaders = new Headers(upstream.headers)
  responseHeaders.set('Deprecation', 'true')
  responseHeaders.set('Link', '</api/v1>; rel="successor-version"')
  responseHeaders.set('X-Overlay-Deprecated-Api', '/api/app')

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export const GET = proxyToV1
export const POST = proxyToV1
export const PATCH = proxyToV1
export const DELETE = proxyToV1
export const PUT = proxyToV1
