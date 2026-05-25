import 'server-only'

import type { NextRequest } from 'next/server'
import { getOverlayServerContext } from '@/server/bootstrap'
import { getServiceAuthHeaderName, verifyServiceAuthToken } from '@/server/auth/service-auth'
import { consumeServiceAuthReplayNonce } from '@/server/auth/service-auth-replay'

/**
 * Browser requests use the session cookie. Server-side tool calls (e.g. Agent)
 * send the same WorkOS access token + userId in the JSON body and/or Authorization header.
 */
export async function resolveAuthenticatedAppUser(
  request: NextRequest,
  body: { accessToken?: string; userId?: string },
): Promise<{ userId: string; accessToken: string } | null> {
  const ctx = getOverlayServerContext()
  const session = await ctx.auth.getSession(request)
  if (session) {
    return { userId: session.user.id, accessToken: session.accessToken }
  }

  const internalUserId =
    typeof body.userId === 'string' && body.userId.trim()
      ? body.userId.trim()
      : request.nextUrl.searchParams.get('userId')?.trim() || ''
  const serviceAuthHeader = request.headers.get(getServiceAuthHeaderName())
  if (serviceAuthHeader?.trim()) {
    const serviceAuth = await verifyServiceAuthToken(
      serviceAuthHeader,
      {
        method: request.method,
        path: request.nextUrl.pathname,
        userId: internalUserId || undefined,
        replayConsumer: consumeServiceAuthReplayNonce,
      },
    )
    if (serviceAuth) {
      return { userId: serviceAuth.userId, accessToken: '' }
    }
  }

  const authHeader = request.headers.get('authorization')
  const bearer =
    authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : undefined
  const token =
    (typeof body.accessToken === 'string' && body.accessToken.trim()) || bearer
  const queryUserId = request.nextUrl.searchParams.get('userId')?.trim() || ''
  const uid =
    typeof body.userId === 'string' && body.userId.trim()
      ? body.userId.trim()
      : queryUserId
  if (!token || !uid) return null

  const claims = await ctx.auth.verifyAccessToken(token)
  if (!claims || claims.sub !== uid) return null

  return { userId: uid, accessToken: token }
}
