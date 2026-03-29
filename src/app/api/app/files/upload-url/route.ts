import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sizeBytes } = await request.json().catch(() => ({ sizeBytes: 0 })) as {
      sizeBytes?: number
    }
    const normalizedSizeBytes =
      typeof sizeBytes === 'number' && Number.isFinite(sizeBytes) && sizeBytes > 0
        ? Math.round(sizeBytes)
        : 0
    if (normalizedSizeBytes <= 0) {
      return NextResponse.json({ error: 'sizeBytes is required' }, { status: 400 })
    }

    const serverSecret = getInternalApiSecret()
    const uploadUrl = await convex.mutation('files:generateUploadUrl', {
      userId: session.user.id,
      serverSecret,
      sizeBytes: normalizedSizeBytes,
    })
    if (!uploadUrl) return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
    return NextResponse.json({ uploadUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate upload URL'
    if (message.includes('storage_limit_exceeded')) {
      return NextResponse.json({ error: 'Overlay storage limit reached.' }, { status: 403 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
