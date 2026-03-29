import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'

interface ProxyEntitlements {
  fileBandwidthBytesUsed: number
  fileBandwidthBytesLimit: number
}

function copyResponseHeaders(source: Headers, target: Headers) {
  const passThrough = [
    'content-type',
    'content-length',
    'cache-control',
    'etag',
    'last-modified',
    'accept-ranges',
  ]
  for (const name of passThrough) {
    const value = source.get(name)
    if (value) target.set(name, value)
  }
}

export async function createMeteredStorageProxyResponse(args: {
  upstreamUrl: string
  userId: string
  filename?: string
}): Promise<Response> {
  const serverSecret = getInternalApiSecret()
  const entitlements = await convex.query<ProxyEntitlements>(
    'usage:getEntitlementsByServer',
    {
      userId: args.userId,
      serverSecret,
    },
    { throwOnError: true },
  )

  if (!entitlements) {
    return Response.json({ error: 'Could not verify file bandwidth limits.' }, { status: 502 })
  }

  const usedBytes = Math.max(0, entitlements.fileBandwidthBytesUsed ?? 0)
  const limitBytes = Math.max(0, entitlements.fileBandwidthBytesLimit ?? 0)
  if (usedBytes >= limitBytes) {
    return Response.json({ error: 'bandwidth_limit_exceeded' }, { status: 403 })
  }

  const upstream = await fetch(args.upstreamUrl)
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: 'Failed to load stored asset.' }, { status: 502 })
  }

  const declaredLength = Number(upstream.headers.get('content-length') ?? '0')
  if (declaredLength > 0 && usedBytes + declaredLength > limitBytes) {
    return Response.json({ error: 'bandwidth_limit_exceeded' }, { status: 403 })
  }

  const reader = upstream.body.getReader()
  let streamedBytes = 0
  let recorded = false

  async function recordBytes() {
    if (recorded || streamedBytes <= 0) return
    recorded = true
    try {
      await convex.mutation(
        'usage:recordFileBandwidthUsageByServer',
        {
          userId: args.userId,
          serverSecret,
          bytesServed: streamedBytes,
        },
        { throwOnError: true },
      )
    } catch (error) {
      console.error('[storage-proxy] failed to record bandwidth usage', error)
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        void recordBytes()
        return
      }

      streamedBytes += value.byteLength
      if (usedBytes + streamedBytes > limitBytes) {
        await reader.cancel('bandwidth_limit_exceeded')
        controller.error(new Error('bandwidth_limit_exceeded'))
        return
      }

      controller.enqueue(value)
    },
    async cancel(reason) {
      await reader.cancel(reason)
    },
  })

  const headers = new Headers()
  copyResponseHeaders(upstream.headers, headers)
  if (args.filename) {
    headers.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(args.filename)}`)
  }
  return new Response(stream, {
    status: upstream.status,
    headers,
  })
}
