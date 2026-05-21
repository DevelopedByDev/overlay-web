import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import {
  enforceRateLimits,
  getClientIp,
  markRateLimitsSatisfied,
} from '@/server/security/rate-limit'
import { getEndpointRateLimitSpecs } from '@/server/security/rate-limit-specs'
import { handleIdempotentMutation } from '@/server/app-api/idempotency'
import { standardizePaginatedListResponse } from '@/server/app-api/pagination'
import { validateApiBoundary } from './boundary'

export type BffRouteContext = {
  params: Promise<Record<string, string | string[]>>
}

export type BffDomainService = (
  request: NextRequest,
  context: unknown,
) => Response | Promise<Response>

async function readJsonBodyForAuth(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return {}
  const text = await request.clone().text().catch(() => '')
  if (!text.trim()) return {}
  const parsed = JSON.parse(text) as unknown
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {}
}

export async function handleBffRoute(
  request: NextRequest,
  context: unknown,
  service: BffDomainService,
): Promise<Response> {
  const authBody = await readJsonBodyForAuth(request).catch(() => ({}))

  const auth = await resolveAuthenticatedAppUser(request, authBody)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const boundaryError = await validateApiBoundary(request)
  if (boundaryError) return boundaryError

  const rateLimits = getEndpointRateLimitSpecs({
    ip: getClientIp(request),
    method: request.method,
    pathname: request.nextUrl.pathname,
    userId: auth.userId,
  })
  if (rateLimits.length > 0) {
    const rateLimitResponse = await enforceRateLimits(request, rateLimits)
    if (rateLimitResponse) return rateLimitResponse
    markRateLimitsSatisfied(request)
  }

  const response = await handleIdempotentMutation(request, auth.userId, async () => service(request, context))
  return standardizePaginatedListResponse(request, response)
}
