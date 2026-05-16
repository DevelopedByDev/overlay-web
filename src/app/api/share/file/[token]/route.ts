import { NextRequest } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { generatePresignedDownloadUrl } from '@/lib/r2'
import { isOwnedFileR2Key, isOwnedOutputR2Key } from '@/lib/storage-keys'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const serverSecret = getInternalApiSecret()
  const target = await convex.query<{
    r2Key: string | null
    mimeType: string | null
    name: string
    sizeBytes: number
    userId: string
  } | null>(
    'files:getPublicR2KeyByTokenByServer',
    { token, serverSecret },
    { throwOnError: true },
  )
  if (!target || !target.r2Key) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (
    !isOwnedFileR2Key(target.userId, target.r2Key) &&
    !isOwnedOutputR2Key(target.userId, target.r2Key)
  ) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  const presignedUrl = await generatePresignedDownloadUrl(target.r2Key)
  return Response.redirect(presignedUrl, 302)
}
