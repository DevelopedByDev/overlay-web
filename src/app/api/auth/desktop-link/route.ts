import { NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { randomBytes } from 'crypto'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { summarizeErrorForLog } from '@/lib/safe-log'
import {
  decryptSessionTransferPayload,
  encryptSessionTransferPayload,
} from '@/lib/session-transfer-crypto'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const

export async function POST() {
  try {
    const session = await getSession()
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
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
    const expiresAt = Date.now() + 5 * 60 * 1000

    await convex.mutation('sessionTransfer:storeToken', {
      serverSecret: getInternalApiSecret(),
      token,
      data: encryptSessionTransferPayload(JSON.stringify(authData)),
      expiresAt,
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
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token required' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    const dataJson = await convex.mutation<string>('sessionTransfer:consumeToken', {
      token,
      serverSecret: getInternalApiSecret(),
    })

    if (!dataJson) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404, headers: NO_STORE_HEADERS }
      )
    }

    const data = JSON.parse(decryptSessionTransferPayload(dataJson))
    return NextResponse.json(data, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[Desktop Link] Error retrieving session:', summarizeErrorForLog(error))
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
