import { NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { randomBytes } from 'crypto'

// In-memory store for short-lived session transfer tokens
// In production, use Redis or similar
const sessionTransferTokens = new Map<string, { data: object; expires: number }>()

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now()
  for (const [token, entry] of sessionTransferTokens.entries()) {
    if (entry.expires < now) {
      sessionTransferTokens.delete(token)
    }
  }
}, 60000) // Clean up every minute

// Generate a deep link with a short-lived token for the desktop app
export async function POST() {
  try {
    const session = await getSession()
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Create auth data
    const authData = {
      userId: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName || '',
      lastName: session.user.lastName || '',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    }

    // Generate a short, random token
    const token = randomBytes(16).toString('hex')
    
    // Store the auth data with a 5-minute expiry
    sessionTransferTokens.set(token, {
      data: authData,
      expires: Date.now() + 5 * 60 * 1000
    })
    
    // Build a short deep link with just the token
    const deepLink = `overlay://auth/transfer?token=${token}`

    console.log(`[Desktop Link] Generated transfer token for user ${session.user.id}`)
    
    return NextResponse.json({ deepLink })
  } catch (error) {
    console.error('[Desktop Link] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate desktop link' },
      { status: 500 }
    )
  }
}

// GET endpoint for the desktop app to fetch session data using the token
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

    const entry = sessionTransferTokens.get(token)
    
    if (!entry) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      )
    }

    if (entry.expires < Date.now()) {
      sessionTransferTokens.delete(token)
      return NextResponse.json(
        { error: 'Token expired' },
        { status: 410 }
      )
    }

    // Delete the token after use (one-time use)
    sessionTransferTokens.delete(token)
    
    console.log('[Desktop Link] Session data retrieved for transfer')
    
    return NextResponse.json(entry.data)
  } catch (error) {
    console.error('[Desktop Link] Error retrieving session:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    )
  }
}
