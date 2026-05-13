import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { convex } from '@/lib/convex'
import { generatePresignedUploadUrl, getMaxPresignedUploadBytes, getR2PresignTtlSeconds, keyForFile } from '@/lib/r2'
import { checkGlobalR2Budget, R2GlobalBudgetError } from '@/lib/r2-budget'
import { formatBytes } from '@/lib/storage-limits'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'
import { cleanupExpiredR2UploadIntents } from '@/lib/r2-upload-intents'

interface Entitlements {
  overlayStorageBytesUsed: number
  overlayStorageBytesLimit: number
}

export async function POST(request: NextRequest) {
  try {
    const { sizeBytes, name, mimeType, accessToken, userId: requestUserId } = await request.json().catch(() => ({})) as {
      sizeBytes?: number
      name?: string
      mimeType?: string
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, { accessToken, userId: requestUserId })
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'files:upload-url:ip', key: getClientIp(request), limit: 60, windowMs: 60 * 60_000 },
      { bucket: 'files:upload-url:user', key: auth.userId, limit: 30, windowMs: 60 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    const normalizedSizeBytes =
      typeof sizeBytes === 'number' && Number.isFinite(sizeBytes) && sizeBytes > 0
        ? Math.round(sizeBytes)
        : 0
    if (normalizedSizeBytes <= 0) {
      return NextResponse.json({ error: 'sizeBytes is required' }, { status: 400 })
    }
    const maxPresignedUploadBytes = getMaxPresignedUploadBytes()
    if (normalizedSizeBytes > maxPresignedUploadBytes) {
      return NextResponse.json({
        error: 'File is too large for direct upload.',
        message: `Direct uploads are limited to ${formatBytes(maxPresignedUploadBytes)} per file.`,
      }, { status: 413 })
    }

    const userId = auth.userId
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
    await cleanupExpiredR2UploadIntents({ userId, serverSecret }).catch((error) => {
      console.warn('[FilesUploadUrl] Failed to clean expired upload intents', error)
    })

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
    const expiresIn = getR2PresignTtlSeconds()
    await convex.mutation('files:createUploadIntentByServer', {
      userId,
      serverSecret,
      r2Key,
      declaredSizeBytes: normalizedSizeBytes,
      mimeType: resolvedMime,
      expiresAt: Date.now() + expiresIn * 1000,
    }, { throwOnError: true })
    const uploadUrl = await generatePresignedUploadUrl(r2Key, resolvedMime, normalizedSizeBytes, expiresIn)

    return NextResponse.json({ uploadUrl, r2Key, expiresIn, maxSizeBytes: normalizedSizeBytes })
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
