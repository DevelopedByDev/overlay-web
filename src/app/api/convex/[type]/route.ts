import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { getServiceAuthHeaderName, verifyServiceAuthToken } from '@/lib/service-auth'

import { z } from '@/lib/api-schemas'

const ConvexProxyRequestSchema = z.object({ type: z.enum(['query', 'mutation', 'action']).optional() }).passthrough().openapi('ConvexProxyRequest')
const ConvexProxyResponseSchema = z.unknown().openapi('ConvexProxyResponse')
void ConvexProxyRequestSchema
void ConvexProxyResponseSchema

type ConvexRequestType = 'query' | 'mutation' | 'action'

function resolveConvexUrl(): string | undefined {
  if (process.env.NODE_ENV === 'development' && process.env.DEV_NEXT_PUBLIC_CONVEX_URL) {
    return process.env.DEV_NEXT_PUBLIC_CONVEX_URL
  }

  return process.env.NEXT_PUBLIC_CONVEX_URL
}

function isConvexRequestType(value: string): value is ConvexRequestType {
  return value === 'query' || value === 'mutation' || value === 'action'
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await context.params

    if (!isConvexRequestType(type)) {
      return NextResponse.json({ error: 'Invalid Convex request type' }, { status: 404 })
    }

    const serviceAuthHeader = request.headers.get(getServiceAuthHeaderName())
    const serviceAuth = serviceAuthHeader
      ? await verifyServiceAuthToken(
          serviceAuthHeader,
          { method: request.method, path: request.nextUrl.pathname },
        )
      : null
    const session = serviceAuth ? null : await getSession()
    if (!serviceAuth && !session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const convexUrl = resolveConvexUrl()
    if (!convexUrl) {
      return NextResponse.json({ error: 'Convex URL is not configured' }, { status: 500 })
    }

    const bodyText = await request.text()
    const response = await fetch(`${convexUrl}/api/${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: bodyText,
      cache: 'no-store',
    })

    const responseText = await response.text()

    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Convex proxy request failed'
    return NextResponse.json(
      {
        status: 'error',
        errorMessage: message,
      },
      { status: 502 }
    )
  }
}
