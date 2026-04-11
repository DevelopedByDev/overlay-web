import { NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { createHash, randomBytes } from 'crypto'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { summarizeErrorForLog } from '@/lib/safe-log'
import {
  decryptSessionTransferPayload,
  encryptSessionTransferPayload,
} from '@/lib/session-transfer-crypto'
import { normalizeCodeChallenge } from '@/lib/workos-auth'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const

const SESSION_TRANSFER_TTL_MS = 90 * 1000

function hashTransferTokenForLog(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 12)
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const requestBody = await request.json().catch(() => ({})) as { codeChallenge?: unknown }
    const codeChallenge = normalizeCodeChallenge(
      typeof requestBody.codeChallenge === 'string'
        ? requestBody.codeChallenge
        : null,
    )
    if (!codeChallenge) {
      return NextResponse.json(
        { error: 'A valid codeChallenge is required' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    const authData = {
      userId: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName || '',
      lastName: session.user.lastName || '',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    }

    const token = randomBytes(16).toString('hex')
    const expiresAt = Date.now() + SESSION_TRANSFER_TTL_MS

    await convex.mutation('sessionTransfer:storeToken', {
      serverSecret: getInternalApiSecret(),
      token,
      codeChallenge,
      data: encryptSessionTransferPayload(JSON.stringify(authData)),
      expiresAt,
    })

    console.log('[Desktop Link] Created session transfer token', {
      userId: session.user.id,
      tokenHashPrefix: hashTransferTokenForLog(token),
      expiresAt,
      hasCodeChallenge: Boolean(codeChallenge),
    })

    const deepLink = `overlay://auth/transfer?token=${token}`

    return NextResponse.json({ deepLink }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[Desktop Link] Error:', summarizeErrorForLog(error))
    return NextResponse.json(
      { error: 'Failed to generate desktop link' },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')?.trim()
    const codeVerifier = request.headers.get('x-overlay-code-verifier')?.trim() || undefined
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token required' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }
    if (!codeVerifier) {
      return NextResponse.json(
        { error: 'Code verifier required' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    const dataJson = await convex.mutation<string>('sessionTransfer:consumeToken', {
      token,
      codeVerifier,
      serverSecret: getInternalApiSecret(),
    })

    if (!dataJson) {
      console.warn('[Desktop Link] Session transfer consume rejected', {
        tokenHashPrefix: hashTransferTokenForLog(token),
        hasCodeVerifier: Boolean(codeVerifier),
      })
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404, headers: NO_STORE_HEADERS }
      )
    }

    const data = JSON.parse(decryptSessionTransferPayload(dataJson))
    console.log('[Desktop Link] Session transfer consumed', {
      tokenHashPrefix: hashTransferTokenForLog(token),
      userId: typeof data?.userId === 'string' ? data.userId : null,
      hasCodeVerifier: Boolean(codeVerifier),
    })
    return NextResponse.json(data, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[Desktop Link] Error retrieving session:', summarizeErrorForLog(error))
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
