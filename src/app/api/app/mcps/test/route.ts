import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { validatePublicNetworkUrl } from '@/lib/ssrf'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { url, transport, authType, authConfig } = body as Record<string, unknown>
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    const validation = await validatePublicNetworkUrl(url, { allowLocalDev: true, requireHttps: true })
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })
    const parsed = validation.url

    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
    let transportInstance
    const headers: Record<string, string> = {}
    if (authType === 'bearer' && (authConfig as { bearerToken?: string })?.bearerToken) {
      headers['Authorization'] = `Bearer ${(authConfig as { bearerToken: string }).bearerToken}`
    }
    if (authType === 'header' && (authConfig as { headerName?: string; headerValue?: string })?.headerName && (authConfig as { headerName: string; headerValue: string }).headerValue) {
      headers[(authConfig as { headerName: string }).headerName] = (authConfig as { headerValue: string }).headerValue
    }

    if (transport === 'sse') {
      const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js')
      transportInstance = new SSEClientTransport(parsed, {
        requestInit: { headers },
        eventSourceInit: { headers } as EventSourceInit,
      })
    } else {
      const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js')
      transportInstance = new StreamableHTTPClientTransport(parsed, {
        requestInit: { headers },
      })
    }

    const client = new Client({ name: 'overlay-web-test', version: '0.1.0' }, { capabilities: {} })
    await client.connect(transportInstance)
    const toolsResult = await client.listTools()
    await client.close()
    return NextResponse.json({ ok: true, toolCount: toolsResult.tools?.length ?? 0 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
