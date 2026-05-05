import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { generatePresignedUploadUrl, keyForFile } from '@/lib/r2'
import { checkGlobalR2Budget, R2GlobalBudgetError } from '@/lib/r2-budget'
import { formatBytes } from '@/lib/storage-limits'

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
      const remainingBytes = Math.max(0, entitlements.overlayStorageBytesLimit - entitlements.overlayStorageBytesUsed)
      return NextResponse.json({
        error: 'Overlay storage limit reached.',
        message: `Not enough Overlay storage remaining. ${formatBytes(remainingBytes)} available, ${formatBytes(normalizedSizeBytes)} needed.`,
      }, { status: 403 })
    }

    await checkGlobalR2Budget(normalizedSizeBytes)

    const resolvedMime = (mimeType ?? 'application/octet-stream').toLowerCase().split(';')[0]!.trim()
    const BLOCKED_MIME_TYPES = new Set([
      'image/svg+xml',
      'text/html',
      'application/xhtml+xml',
      'application/javascript',
      'text/javascript',
    ])
    if (BLOCKED_MIME_TYPES.has(resolvedMime)) {
      return NextResponse.json({ error: `File type not allowed: ${resolvedMime}` }, { status: 415 })
    }

    const fileName = name ?? `upload-${Date.now()}`
    const fileIdPlaceholder = `tmp-${Date.now()}-${randomBytes(9).toString('base64url')}`
    const r2Key = keyForFile(userId, fileIdPlaceholder, fileName)
    const uploadUrl = await generatePresignedUploadUrl(r2Key, resolvedMime, 900)

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
