import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import { convex } from '@/server/database/convex'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import { validatePublicNetworkUrl } from '@/server/security/ssrf'
import type { Id } from '../../../../../convex/_generated/dataModel'

async function validateMcpUrl(url: unknown): Promise<string | null> {
  const result = await validatePublicNetworkUrl(url, { allowLocalDev: true, requireHttps: true })
  return result.ok ? null : result.error
}

type ProjectAccessResult =
  | { ok: true; projectId: string }
  | { ok: false; response: NextResponse }

async function requireProjectAccess(projectId: unknown, userId: string, serverSecret: string): Promise<ProjectAccessResult> {
  const trimmedProjectId = typeof projectId === 'string' ? projectId.trim() : ''
  if (!trimmedProjectId) {
    return { ok: false, response: NextResponse.json({ error: 'projectId required' }, { status: 400 }) }
  }

  try {
    const project = await convex.query<{ _id: string } | null>('projects/projects:get', {
      projectId: trimmedProjectId as Id<'projects'>,
      userId,
      serverSecret,
    })
    if (!project) {
      return { ok: false, response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) }
    }
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) }
  }

  return { ok: true, projectId: trimmedProjectId }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const projectAccess = await requireProjectAccess(request.nextUrl.searchParams.get('projectId'), auth.userId, serverSecret)
    if (!projectAccess.ok) return projectAccess.response

    const mcps = await convex.query('integrations/mcpServers:list', {
      userId: auth.userId,
      projectId: projectAccess.projectId,
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
      projectId,
    } = body as Record<string, unknown>
    if (!name || !transport || !url) {
      return NextResponse.json(
        { error: 'name, transport, and url are required' },
        { status: 400 }
      )
    }
    const projectAccess = await requireProjectAccess(projectId, auth.userId, serverSecret)
    if (!projectAccess.ok) return projectAccess.response

    const urlError = await validateMcpUrl(url)
    if (urlError) {
      return NextResponse.json({ error: urlError }, { status: 400 })
    }

    const mcpServerId = await convex.mutation<string>('integrations/mcpServers:create', {
      userId: auth.userId,
      projectId: projectAccess.projectId,
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
      projectId,
    } = body as Record<string, unknown>
    if (!mcpServerId) {
      return NextResponse.json({ error: 'mcpServerId required' }, { status: 400 })
    }
    const projectAccess = await requireProjectAccess(projectId, auth.userId, serverSecret)
    if (!projectAccess.ok) return projectAccess.response

    if (url !== undefined) {
      const urlError = await validateMcpUrl(url)
      if (urlError) {
        return NextResponse.json({ error: urlError }, { status: 400 })
      }
    }

    await convex.mutation('integrations/mcpServers:update', {
      mcpServerId,
      userId: auth.userId,
      projectId: projectAccess.projectId,
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
    let body: { accessToken?: string; userId?: string; projectId?: string } = {}
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
    const projectAccess = await requireProjectAccess(
      request.nextUrl.searchParams.get('projectId') ?? body.projectId,
      auth.userId,
      serverSecret,
    )
    if (!projectAccess.ok) return projectAccess.response

    await convex.mutation('integrations/mcpServers:remove', {
      mcpServerId,
      userId: auth.userId,
      projectId: projectAccess.projectId,
      serverSecret,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete MCP server' }, { status: 500 })
  }
}
