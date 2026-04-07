import type { NextRequest } from 'next/server'
import { getVerifiedAccessTokenClaims } from '../../convex/lib/auth'
import { validateServerSecret } from '../../convex/lib/auth'
import { getSession } from '@/lib/workos-auth'

/**
 * Browser requests use the session cookie. Server-side tool calls (e.g. Agent)
 * send the same WorkOS access token + userId in the JSON body and/or Authorization header.
 */
export async function resolveAuthenticatedAppUser(
  request: NextRequest,
  body: { accessToken?: string; userId?: string },
): Promise<{ userId: string; accessToken: string } | null> {
  const session = await getSession()
  if (session) {
    return { userId: session.user.id, accessToken: session.accessToken }
  }

  const internalApiSecret = request.headers.get('x-internal-api-secret')?.trim()
  const internalUserId =
    typeof body.userId === 'string' && body.userId.trim()
      ? body.userId.trim()
      : request.nextUrl.searchParams.get('userId')?.trim() || ''
  if (validateServerSecret(internalApiSecret) && internalUserId) {
    return { userId: internalUserId, accessToken: '' }
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

  const claims = await getVerifiedAccessTokenClaims(token)
  if (!claims || claims.sub !== uid) return null

  return { userId: uid, accessToken: token }
}
