import { NextRequest, NextResponse } from 'next/server'
import { getServerProviderKey } from '@/lib/server-provider-keys'
import { getVerifiedAccessTokenClaims, debugAccessTokenVerification } from '../../../../../../convex/lib/auth'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const

async function isAuthenticatedRequest(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  const bearer =
    authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''

  if (!bearer) {
    return false
  }

  const claims = await getVerifiedAccessTokenClaims(bearer)
  if (!claims?.sub) {
    const debug = await debugAccessTokenVerification(bearer)
    console.error('[NativeProviderKeys] Token verification failed:', JSON.stringify(debug))
    return false
  }
  return true
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticatedRequest(request)
    if (!authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: NO_STORE_HEADERS }
      )
    }

    const body = (await request.json().catch(() => ({}))) as { providers?: unknown }
    const providers = Array.isArray(body.providers)
      ? body.providers.filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        )
      : []

    if (providers.length === 0) {
      return NextResponse.json(
        { error: 'providers is required' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    const keys = Object.fromEntries(
      await Promise.all(
        providers.map(async (provider) => [
          provider,
          await getServerProviderKey(provider.trim()),
        ] as const)
      )
    )

    return NextResponse.json({ keys }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[NativeProviderKeys] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch provider keys' },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
