import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature } from '@/lib/slack'

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://getoverlay.io'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const timestamp = request.headers.get('x-slack-request-timestamp') || ''
  const signature = request.headers.get('x-slack-signature') || ''

  if (!verifySlackSignature(body, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  return NextResponse.json({
    response_type: 'ephemeral',
    text: `Voice capture is available in the desktop app: ${BASE_URL}`,
  })
}
