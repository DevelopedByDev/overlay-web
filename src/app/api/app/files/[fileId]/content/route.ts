import { NextRequest } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { generatePresignedDownloadUrl } from '@/lib/r2'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { fileId } = await params
  const proxyTarget = await convex.query<{ r2Key?: string; url?: string; name: string; sizeBytes: number } | null>(
    'files:getStorageUrlForProxy',
    {
      fileId,
      userId: session.user.id,
      serverSecret: getInternalApiSecret(),
    },
    { throwOnError: true },
  )

  if (!proxyTarget) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (proxyTarget.r2Key) {
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
