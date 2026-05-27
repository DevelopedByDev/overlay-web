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
import { getRequiredApiKeyScopesForRoute, isApiKeyCandidate } from '@/server/auth/api-keys'
import { requireOverlayRouteCapability } from '@/server/capabilities'
import { validateApiBoundary } from './boundary'

const API_KEY_CANDIDATE_RATE_LIMITS = [
  { bucket: 'api-key-auth:candidate:ip', limit: 60, windowMs: 60_000 },
  { bucket: 'api-key-auth:candidate:ip-hour', limit: 600, windowMs: 60 * 60_000 },
] as const

const API_KEY_REQUEST_RATE_LIMIT = {
  bucket: 'api-key:request:key',
  limit: 300,
  windowMs: 10 * 60_000,
} as const

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
  const disabledCapabilityResponse = await requireOverlayRouteCapability(request)
  if (disabledCapabilityResponse) return disabledCapabilityResponse

  const authBody = await readJsonBodyForAuth(request).catch(() => ({}))
  const clientIp = getClientIp(request)
  const bearer = getBearerToken(request)
  if (isApiKeyCandidate(bearer)) {
    const apiKeyCandidateLimit = await enforceRateLimits(
      request,
      API_KEY_CANDIDATE_RATE_LIMITS.map((rule) => ({ ...rule, key: clientIp })),
    )
    if (apiKeyCandidateLimit) return apiKeyCandidateLimit
  }

  const auth = await resolveAuthenticatedAppUser(request, authBody, {
    clientIp,
    requiredApiKeyScopes: getRequiredApiKeyScopesForRoute(
      request.method,
      request.nextUrl.pathname,
    ),
  })
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const boundaryError = await validateApiBoundary(request)
  if (boundaryError) return boundaryError

  const rateLimits = getEndpointRateLimitSpecs({
    ip: clientIp,
    method: request.method,
    pathname: request.nextUrl.pathname,
    userId: auth.userId,
  })
  if (auth.authType === 'api-key' && auth.apiKeyId) {
    rateLimits.push({ ...API_KEY_REQUEST_RATE_LIMIT, key: auth.apiKeyId })
  }
  if (rateLimits.length > 0) {
    const rateLimitResponse = await enforceRateLimits(request, rateLimits)
    if (rateLimitResponse) return rateLimitResponse
    markRateLimitsSatisfied(request)
  }

  const response = await handleIdempotentMutation(request, auth.userId, async () => service(request, context))
  return standardizePaginatedListResponse(request, response)
}

function getBearerToken(request: NextRequest): string | undefined {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : undefined
}
