import { NextResponse } from 'next/server'
import { getSession, getSessionSecret } from '@/lib/workos-auth'
import { createHmac } from 'crypto'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Create a short-lived extension token (1 hour)
  const secret = getSessionSecret()
  const expiresAt = Date.now() + 60 * 60 * 1000
  const payload = JSON.stringify({
    userId: session.user.id,
    email: session.user.email,
    expiresAt,
  })
  const encodedPayload = Buffer.from(payload).toString('base64')
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('hex')
  const token = `${encodedPayload}.${signature}`

  return NextResponse.json({
    token,
    user: {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
    },
    expiresAt,
  })
}
