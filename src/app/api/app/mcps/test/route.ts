import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { url, transport, authType, authConfig } = body as Record<string, unknown>
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
    const isDev = process.env.NODE_ENV === 'development'
    if (parsed.protocol !== 'https:' && !(isDev && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))) {
      return NextResponse.json({ error: 'HTTPS required in production. HTTP allowed for localhost/127.0.0.1 in development only.' }, { status: 400 })
    }

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
