import { NextRequest } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { createMeteredStorageProxyResponse } from '@/lib/storage-proxy'
import { getSession } from '@/lib/workos-auth'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ outputId: string }> },
) {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { outputId } = await params
  const proxyTarget = await convex.query<{ url: string } | null>(
    'outputs:getStorageUrlForProxy',
    {
      outputId,
      userId: session.user.id,
      serverSecret: getInternalApiSecret(),
    },
    { throwOnError: true },
  )

  if (!proxyTarget?.url) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return await createMeteredStorageProxyResponse({
    upstreamUrl: proxyTarget.url,
    userId: session.user.id,
  })
}
