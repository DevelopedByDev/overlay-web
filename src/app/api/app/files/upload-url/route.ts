import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { generatePresignedUploadUrl, keyForFile } from '@/lib/r2'
import { checkGlobalR2Budget, R2GlobalBudgetError } from '@/lib/r2-budget'

interface Entitlements {
  overlayStorageBytesUsed: number
  overlayStorageBytesLimit: number
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sizeBytes, name, mimeType } = await request.json().catch(() => ({})) as {
      sizeBytes?: number
      name?: string
      mimeType?: string
    }
    const normalizedSizeBytes =
      typeof sizeBytes === 'number' && Number.isFinite(sizeBytes) && sizeBytes > 0
        ? Math.round(sizeBytes)
        : 0
    if (normalizedSizeBytes <= 0) {
      return NextResponse.json({ error: 'sizeBytes is required' }, { status: 400 })
    }

    const userId = session.user.id
    const serverSecret = getInternalApiSecret()

    const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
      serverSecret,
      userId,
    })
    if (!entitlements) return NextResponse.json({ error: 'Could not verify subscription.' }, { status: 401 })
    if (entitlements.overlayStorageBytesUsed + normalizedSizeBytes > entitlements.overlayStorageBytesLimit) {
      return NextResponse.json({ error: 'Overlay storage limit reached.' }, { status: 403 })
    }

    await checkGlobalR2Budget(normalizedSizeBytes)

    const fileName = name ?? `upload-${Date.now()}`
    const fileIdPlaceholder = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const r2Key = keyForFile(userId, fileIdPlaceholder, fileName)
    const uploadUrl = await generatePresignedUploadUrl(r2Key, mimeType ?? 'application/octet-stream')

    return NextResponse.json({ uploadUrl, r2Key })
  } catch (error) {
    if (error instanceof R2GlobalBudgetError) {
      return NextResponse.json({ error: 'Overlay storage limit reached.' }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : 'Failed to generate upload URL'
    if (message.includes('storage_limit_exceeded')) {
      return NextResponse.json({ error: 'Overlay storage limit reached.' }, { status: 403 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
