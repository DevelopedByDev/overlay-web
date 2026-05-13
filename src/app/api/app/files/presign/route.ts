import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { convex } from '@/lib/convex'
import { generatePresignedUploadUrl, keyForFile } from '@/lib/r2'
import { checkGlobalR2Budget, R2GlobalBudgetError } from '@/lib/r2-budget'

interface Entitlements {
  overlayStorageBytesUsed: number
  overlayStorageBytesLimit: number
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const name = searchParams.get('name')
    const rawMime = searchParams.get('mimeType') ?? 'application/octet-stream'
    const mimeType = rawMime.toLowerCase().split(';')[0]!.trim()
    const sizeBytesRaw = searchParams.get('sizeBytes')

    const BLOCKED_MIME_TYPES = new Set([
      'image/svg+xml',
      'text/html',
      'application/xhtml+xml',
      'application/javascript',
      'text/javascript',
    ])
    if (BLOCKED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json({ error: `File type not allowed: ${mimeType}` }, { status: 415 })
    }

    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    if (!sizeBytesRaw || isNaN(Number(sizeBytesRaw))) {
      return NextResponse.json({ error: 'sizeBytes required' }, { status: 400 })
    }

    const sizeBytes = Math.round(Number(sizeBytesRaw))
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return NextResponse.json({ error: 'sizeBytes must be greater than 0' }, { status: 400 })
    }
    const userId = auth.userId
    const serverSecret = getInternalApiSecret()

    const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
      serverSecret,
      userId,
    })

    if (!entitlements) {
      return NextResponse.json({ error: 'Could not verify subscription.' }, { status: 401 })
    }

    if (entitlements.overlayStorageBytesUsed + sizeBytes > entitlements.overlayStorageBytesLimit) {
      return NextResponse.json(
        { error: 'storage_limit_exceeded', message: 'Not enough Overlay storage remaining.' },
        { status: 403 },
      )
    }

    await checkGlobalR2Budget(sizeBytes)

    const fileIdPlaceholder = `tmp-${Date.now()}-${randomBytes(9).toString('base64url')}`
    const r2Key = keyForFile(userId, fileIdPlaceholder, name)
    const presignedUrl = await generatePresignedUploadUrl(r2Key, mimeType)

    console.log(`[FilesPresign] Generated PUT URL for userId=${userId} key=${r2Key} size=${sizeBytes}B`)

    return NextResponse.json({ r2Key, presignedUrl, expiresIn: Number(process.env['R2_PRESIGN_TTL_SECONDS'] ?? 300) })
  } catch (err) {
    if (err instanceof R2GlobalBudgetError) {
      return NextResponse.json(
        { error: 'storage_limit_exceeded', message: 'Global R2 storage cap reached. Contact support.' },
        { status: 403 },
      )
    }
    console.error('[FilesPresign] Error:', err)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}
