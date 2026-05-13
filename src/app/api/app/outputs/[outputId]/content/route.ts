import { NextRequest } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { generatePresignedDownloadUrl } from '@/lib/r2'
import { isOwnedOutputR2Key } from '@/lib/storage-keys'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ outputId: string }> },
) {
  const auth = await resolveAuthenticatedAppUser(request, {})
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const rateLimitResponse = await enforceRateLimits(request, [
    { bucket: 'r2-download:output:ip', key: getClientIp(request), limit: 600, windowMs: 10 * 60_000 },
    { bucket: 'r2-download:output:user', key: auth.userId, limit: 300, windowMs: 10 * 60_000 },
  ])
  if (rateLimitResponse) return rateLimitResponse

  const { outputId } = await params
  const serverSecret = getInternalApiSecret()
  const proxyTarget = await convex.query<{ r2Key?: string; url?: string; sizeBytes: number; type: string; fileName?: string; mimeType?: string } | null>(
    'outputs:getStorageUrlForProxy',
    {
      outputId,
      userId: auth.userId,
      serverSecret,
    },
    { throwOnError: true },
  )

  if (!proxyTarget) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (proxyTarget.r2Key) {
    if (!isOwnedOutputR2Key(auth.userId, proxyTarget.r2Key)) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    await convex.mutation('usage:recordFileBandwidthByServer', {
      serverSecret,
      userId: auth.userId,
      bytes: proxyTarget.sizeBytes ?? 0,
    }).catch((error) => console.warn('[outputs/content] bandwidth accounting failed', error))
    const presignedUrl = await generatePresignedDownloadUrl(proxyTarget.r2Key)
    return Response.redirect(presignedUrl, 302)
  }

  if (proxyTarget.url) {
    const upstream = await fetch(proxyTarget.url)
    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: 'Failed to load stored asset.' }, { status: 502 })
    }
    const headers = new Headers()
    const ct = upstream.headers.get('content-type')
    if (ct) headers.set('content-type', ct)
    const cd = upstream.headers.get('content-disposition')
    if (cd) headers.set('content-disposition', cd)
    return new Response(upstream.body, { status: 200, headers })
  }

  return Response.json({ error: 'Not found' }, { status: 404 })
}
