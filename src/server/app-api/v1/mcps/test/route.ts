import { NextRequest, NextResponse } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { getInternalApiSecret } from '@/server/shared/internal-api-secret'
import {
  discoverToolsCatalogForServer,
  persistMcpServerToolCatalog,
  type McpServerConfig,
} from '@/server/tools/mcp-tools'

function parseAuthType(value: unknown): McpServerConfig['authType'] {
  if (value === 'bearer' || value === 'header') return value
  return 'none'
}

function parseTransport(value: unknown): McpServerConfig['transport'] {
  return value === 'sse' ? 'sse' : 'streamable-http'
}

export async function POST(request: NextRequest, context: AppApiRouteContext) {
  let mcpServerId: string | undefined
  try {
    const body = await request.json()
    const record = body as Record<string, unknown>

    const url = record.url
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    mcpServerId = typeof record.mcpServerId === 'string' && record.mcpServerId.length > 0
      ? record.mcpServerId
      : undefined

    const authConfig = record.authConfig as McpServerConfig['authConfig'] | undefined
    const config: McpServerConfig = {
      _id: mcpServerId ?? 'test',
      userId: context.auth.userId,
      name: 'test',
      transport: parseTransport(record.transport),
      url,
      enabled: true,
      authType: parseAuthType(record.authType),
      authConfig,
      timeoutMs: typeof record.timeoutMs === 'number' ? record.timeoutMs : undefined,
    }

    const tools = await discoverToolsCatalogForServer(config)

    if (mcpServerId) {
      await persistMcpServerToolCatalog({
        mcpServerId,
        userId: context.auth.userId,
        serverSecret: getInternalApiSecret(),
        tools,
      })
    }

    return NextResponse.json({ ok: true, toolCount: tools.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (mcpServerId) {
      await persistMcpServerToolCatalog({
        mcpServerId,
        userId: context.auth.userId,
        serverSecret: getInternalApiSecret(),
        tools: [],
        catalogError: message,
      }).catch((_error) => undefined)
    }
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
