import { NextRequest } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { generatePresignedDownloadUrl } from '@/lib/r2'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { getAppOutputProxyTarget } from '@/lib/app-api/output-service'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ outputId: string }> },
) {
  const auth = await resolveAuthenticatedAppUser(request, {})
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { outputId } = await params
  const proxyTarget = await getAppOutputProxyTarget(
    auth.userId,
    getInternalApiSecret(),
    outputId,
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
