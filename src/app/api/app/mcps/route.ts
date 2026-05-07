import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { convex } from '@/lib/convex'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { validatePublicNetworkUrl } from '@/lib/ssrf'

async function validateMcpUrl(url: unknown): Promise<string | null> {
  const result = await validatePublicNetworkUrl(url, { allowLocalDev: true, requireHttps: true })
  return result.ok ? null : result.error
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const mcps = await convex.query('mcpServers:list', {
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json(mcps || [])
  } catch {
    return NextResponse.json({ error: 'Failed to fetch MCP servers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const {
      name,
      description,
      transport,
      url,
      enabled,
      authType,
      authConfig,
      timeoutMs,
    } = body as Record<string, unknown>
    if (!name || !transport || !url) {
      return NextResponse.json(
        { error: 'name, transport, and url are required' },
        { status: 400 }
      )
    }

    const urlError = await validateMcpUrl(url)
    if (urlError) {
      return NextResponse.json({ error: urlError }, { status: 400 })
    }

    const mcpServerId = await convex.mutation<string>('mcpServers:create', {
      userId: auth.userId,
      serverSecret,
      name,
      description: description || '',
      transport,
      url,
      enabled: enabled !== false,
      authType: authType || 'none',
      authConfig: authConfig || undefined,
      timeoutMs: typeof timeoutMs === 'number' ? timeoutMs : undefined,
    })
    return NextResponse.json({ id: mcpServerId })
  } catch {
    return NextResponse.json({ error: 'Failed to create MCP server' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const {
      mcpServerId,
      name,
      description,
      transport,
      url,
      enabled,
      authType,
      authConfig,
      timeoutMs,
    } = body as Record<string, unknown>
    if (!mcpServerId) {
      return NextResponse.json({ error: 'mcpServerId required' }, { status: 400 })
    }

    if (url !== undefined) {
      const urlError = await validateMcpUrl(url)
      if (urlError) {
        return NextResponse.json({ error: urlError }, { status: 400 })
      }
    }

    await convex.mutation('mcpServers:update', {
      mcpServerId,
      userId: auth.userId,
      serverSecret,
      name,
      description,
      transport,
      url,
      enabled,
      authType,
      authConfig,
      timeoutMs,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update MCP server' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let body: { accessToken?: string; userId?: string } = {}
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        body = await request.json()
      } catch {
        body = {}
      }
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const mcpServerId = request.nextUrl.searchParams.get('mcpServerId')
    if (!mcpServerId) {
      return NextResponse.json({ error: 'mcpServerId required' }, { status: 400 })
    }

    await convex.mutation('mcpServers:remove', {
      mcpServerId,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete MCP server' }, { status: 500 })
  }
}
