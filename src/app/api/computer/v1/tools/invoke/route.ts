import { NextRequest, NextResponse } from 'next/server'
import type { ToolSet } from 'ai'
import { convex } from '@/lib/convex'
import { createBrowserUnifiedTools } from '@/lib/composio-tools'
import { COMPUTER_TOOL_RPC_ALLOWLIST } from '@/lib/computer-capabilities'
import { getComputerServerSecret, requireComputerApiContext } from '@/lib/computer-api-route'
import { isComputerOwnedSessionKey } from '@/lib/computer-openclaw'
import type { HybridSearchChunk } from '../../../../../../../convex/knowledge'

type ComputerToolRpcRequest = {
  toolName?: string
  input?: Record<string, unknown>
  sessionKey?: string
  idempotencyKey?: string
}

type ComputerToolRpcResponse = {
  success: boolean
  output?: unknown
  artifacts?: unknown[]
  error?: string
}

function isAllowedComputerToolName(name: string): boolean {
  if (COMPUTER_TOOL_RPC_ALLOWLIST.includes(name as (typeof COMPUTER_TOOL_RPC_ALLOWLIST)[number])) {
    return true
  }
  return false
}

async function executeComposioTool(
  userId: string,
  toolName: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const tools = await createBrowserUnifiedTools({ userId })
  const tool =
    toolName === 'composio.search_tools'
      ? tools.COMPOSIO_SEARCH_TOOLS
      : typeof input.name === 'string'
        ? (tools as ToolSet)[input.name]
        : undefined

  if (!tool || typeof tool !== 'object' || typeof (tool as { execute?: unknown }).execute !== 'function') {
    throw new Error('Requested Composio tool is unavailable')
  }

  const execute = (tool as { execute: (input: Record<string, unknown>, extra: unknown) => Promise<unknown> }).execute
  const toolInput =
    toolName === 'composio.search_tools'
      ? input
      : (input.args && typeof input.args === 'object' ? input.args : {})

  return await execute(toolInput as Record<string, unknown>, undefined)
}

export async function POST(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = (await request.json()) as ComputerToolRpcRequest
    const toolName = body.toolName?.trim()
    if (!toolName || !isAllowedComputerToolName(toolName)) {
      return NextResponse.json(
        { success: false, error: 'Tool is not allowed for computer RPC.' } satisfies ComputerToolRpcResponse,
        { status: 403 },
      )
    }

    if (body.sessionKey?.trim() && !isComputerOwnedSessionKey(body.sessionKey, {
      computerId: auth.computerId,
      userId: auth.userId,
    })) {
      return NextResponse.json(
        { success: false, error: 'Session does not belong to this computer.' } satisfies ComputerToolRpcResponse,
        { status: 403 },
      )
    }

    if (toolName === 'search_knowledge') {
      const input = body.input ?? {}
      const query = typeof input.query === 'string' ? input.query.trim() : ''
      if (!query) {
        return NextResponse.json(
          { success: false, error: 'query is required' } satisfies ComputerToolRpcResponse,
          { status: 400 },
        )
      }

      const output = await convex.action<{ chunks: HybridSearchChunk[] }>('knowledge:hybridSearch', {
        userId: auth.userId,
        serverSecret: getComputerServerSecret(),
        query,
        projectId: typeof input.projectId === 'string' ? input.projectId : undefined,
        sourceKind: input.sourceKind === 'file' || input.sourceKind === 'memory' ? input.sourceKind : undefined,
        kVec: typeof input.kVec === 'number' ? input.kVec : undefined,
        kLex: typeof input.kLex === 'number' ? input.kLex : undefined,
        m: typeof input.m === 'number' ? input.m : undefined,
      })

      return NextResponse.json({ success: true, output } satisfies ComputerToolRpcResponse)
    }

    const output = await executeComposioTool(auth.userId, toolName, body.input ?? {})
    return NextResponse.json({ success: true, output } satisfies ComputerToolRpcResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool invocation failed'
    return NextResponse.json(
      { success: false, error: message } satisfies ComputerToolRpcResponse,
      { status: 500 },
    )
  }
}

