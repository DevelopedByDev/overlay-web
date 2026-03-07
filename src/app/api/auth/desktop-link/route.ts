import { NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { randomBytes } from 'crypto'
import { convex } from '@/lib/convex'

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
      token,
      data: JSON.stringify(authData),
      expiresAt,
    })

    const deepLink = `overlay://auth/transfer?token=${token}`

    return NextResponse.json({ deepLink })
  } catch (error) {
    console.error('[Desktop Link] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate desktop link' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token required' },
        { status: 400 }
      )
    }

    const dataJson = await convex.mutation<string>('sessionTransfer:consumeToken', { token })

    if (!dataJson) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      )
    }

    const data = JSON.parse(dataJson)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[Desktop Link] Error retrieving session:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    )
  }
}
