import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { convex } from '@/lib/convex'
import { jsonSchemaToZod } from './mcp-schema-to-zod'
import { getInternalApiSecret } from './internal-api-secret'
import { fireAndForgetRecordToolInvocation } from './tools/record-tool-invocation'

// Dynamic import of MCP SDK (ESM)
type McpClientModule = typeof import('@modelcontextprotocol/sdk/client/index.js')
type McpSseModule = typeof import('@modelcontextprotocol/sdk/client/sse.js')
type McpStreamableHttpModule = typeof import('@modelcontextprotocol/sdk/client/streamableHttp.js')
type McpTypesModule = typeof import('@modelcontextprotocol/sdk/types.js')

let mcpModules:
  | {
      Client: McpClientModule['Client']
      SSEClientTransport: McpSseModule['SSEClientTransport']
      StreamableHTTPClientTransport: McpStreamableHttpModule['StreamableHTTPClientTransport']
      ListToolsResultSchema: McpTypesModule['ListToolsResultSchema']
      CallToolResultSchema: McpTypesModule['CallToolResultSchema']
    }
  | undefined

async function loadMcpModules() {
  if (mcpModules) return mcpModules
  const [
    clientMod,
    sseMod,
    httpMod,
    typesMod,
  ] = await Promise.all([
    import('@modelcontextprotocol/sdk/client/index.js'),
    import('@modelcontextprotocol/sdk/client/sse.js'),
    import('@modelcontextprotocol/sdk/client/streamableHttp.js'),
    import('@modelcontextprotocol/sdk/types.js'),
  ])
  mcpModules = {
    Client: clientMod.Client,
    SSEClientTransport: sseMod.SSEClientTransport,
    StreamableHTTPClientTransport: httpMod.StreamableHTTPClientTransport,
    ListToolsResultSchema: typesMod.ListToolsResultSchema,
    CallToolResultSchema: typesMod.CallToolResultSchema,
  }
  return mcpModules
}

interface McpServerConfig {
  _id: string
  userId: string
  name: string
  description?: string
  transport: 'sse' | 'streamable-http'
  url: string
  enabled: boolean
  authType: 'none' | 'bearer' | 'header'
  authConfig?: {
    bearerToken?: string
    headerName?: string
    headerValue?: string
  }
  timeoutMs?: number
}

type McpCacheEntry = {
  tools: ToolSet
  createdAt: number
}
const mcpCache = new Map<string, McpCacheEntry>()
const mcpInFlight = new Map<string, Promise<ToolSet>>()
const MCP_CACHE_TTL_MS = 60_000 // 60 seconds

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function safeToolId(serverName: string, toolName: string): string {
  return `mcp_${slugify(serverName)}_${slugify(toolName)}`
}

function buildAuthHeaders(config: McpServerConfig): Record<string, string> {
  const headers: Record<string, string> = {}
  if (config.authType === 'bearer' && config.authConfig?.bearerToken) {
    headers['Authorization'] = `Bearer ${config.authConfig.bearerToken}`
  }
  if (config.authType === 'header' && config.authConfig?.headerName && config.authConfig?.headerValue) {
    headers[config.authConfig.headerName] = config.authConfig.headerValue
  }
  return headers
}

async function createMcpTransportAndClient(config: McpServerConfig) {
  const {
    Client,
    SSEClientTransport,
    StreamableHTTPClientTransport,
  } = await loadMcpModules()

  const url = new URL(config.url)
  const headers = buildAuthHeaders(config)
  const timeoutMs = config.timeoutMs ?? 30_000

  let transport: { start(): Promise<void>; close(): Promise<void>; send(message: unknown): Promise<void> } | undefined

  if (config.transport === 'sse') {
    transport = new SSEClientTransport(url, {
      requestInit: { headers },
      eventSourceInit: { headers } as EventSourceInit,
    } as import('@modelcontextprotocol/sdk/client/sse.js').SSEClientTransportOptions)
  } else {
    transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
    } as import('@modelcontextprotocol/sdk/client/streamableHttp.js').StreamableHTTPClientTransportOptions)
  }

  const client = new Client(
    { name: 'overlay-web', version: '0.1.0' },
    { capabilities: {} }
  )

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    await client.connect(transport as import('@modelcontextprotocol/sdk/shared/transport.js').Transport)
  } finally {
    clearTimeout(timeoutId)
  }

  return { client, transport, timeoutMs }
}

const MAX_MCP_TOOL_RESULT_CHARS = 50_000 // Truncate to prevent AI Gateway token limit errors

async function callMcpTool(
  config: McpServerConfig,
  toolName: string,
  input: unknown
): Promise<{ isError?: boolean; content: unknown }> {
  console.log(`[MCP] Calling tool ${toolName} on server ${config.name}`)
  const { client, timeoutMs } = await createMcpTransportAndClient(config)
  try {
    const result = await client.callTool(
      { name: toolName, arguments: input as Record<string, unknown> },
      undefined,
      { signal: AbortSignal.timeout(timeoutMs) }
    )
    console.log(`[MCP] Tool ${toolName} on server ${config.name} returned (isError=${result.isError})`)
    return result as { isError?: boolean; content: unknown }
  } catch (err) {
    console.error(`[MCP] Tool ${toolName} on server ${config.name} failed: ${err instanceof Error ? err.message : String(err)}`)
    throw err
  } finally {
    try {
      await client.close()
    } catch {
      // ignore close errors
    }
  }
}

async function discoverToolsForServer(config: McpServerConfig): Promise<ToolSet> {
  const {
    Client,
    SSEClientTransport,
    StreamableHTTPClientTransport,
  } = await loadMcpModules()

  const url = new URL(config.url)
  const headers = buildAuthHeaders(config)
  const timeoutMs = config.timeoutMs ?? 30_000

  let transport: { start(): Promise<void>; close(): Promise<void>; send(message: unknown): Promise<void> } | undefined

  try {
    if (config.transport === 'sse') {
      transport = new SSEClientTransport(url, {
        requestInit: { headers },
        eventSourceInit: { headers } as EventSourceInit,
      } as import('@modelcontextprotocol/sdk/client/sse.js').SSEClientTransportOptions)
    } else {
      transport = new StreamableHTTPClientTransport(url, {
        requestInit: { headers },
      } as import('@modelcontextprotocol/sdk/client/streamableHttp.js').StreamableHTTPClientTransportOptions)
    }
  } catch (err) {
    console.warn(`[MCP] Failed to create transport for ${config.name}: ${err instanceof Error ? err.message : String(err)}`)
    return {}
  }

  const client = new Client(
    { name: 'overlay-web', version: '0.1.0' },
    { capabilities: {} }
  )

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      await client.connect(transport as import('@modelcontextprotocol/sdk/shared/transport.js').Transport)
    } finally {
      clearTimeout(timeoutId)
    }

    const toolsResult = await client.listTools({}, { signal: AbortSignal.timeout(timeoutMs) })
    const discoveredTools = toolsResult.tools ?? []

    if (discoveredTools.length === 0) {
      return {}
    }

    const toolSet: ToolSet = {}
    const seenNames = new Set<string>()

    for (const t of discoveredTools) {
      if (!t.name) continue

      let toolId = safeToolId(config.name, t.name)
      if (seenNames.has(toolId)) {
        let suffix = 1
        while (seenNames.has(`${toolId}_${suffix}`)) suffix++
        toolId = `${toolId}_${suffix}`
      }
      seenNames.add(toolId)

      const inputSchema = t.inputSchema as Record<string, unknown> | undefined
      const zodSchema = inputSchema
        ? jsonSchemaToZod(inputSchema)
        : z.object({})

      const descriptionParts: string[] = []
      if (t.description) descriptionParts.push(t.description)
      descriptionParts.push(`(MCP server: ${config.name})`)

      toolSet[toolId] = tool({
        description: descriptionParts.join(' '),
        inputSchema: zodSchema as z.ZodTypeAny,
        execute: async (input) => {
          const start = Date.now()
          try {
            const result = await callMcpTool(config, t.name, input)

            // Record invocation
            void fireAndForgetRecordToolInvocation({
              userId: config.userId,
              toolName: toolId,
              mode: 'act',
              modelId: undefined,
              conversationId: undefined,
              turnId: undefined,
              success: !result.isError,
              durationMs: Date.now() - start,
              error: result.isError ? 'Tool returned error flag' : undefined,
            })

            // Flatten MCP content into a serializable result
            const content = result.content
            let resultText: string
            if (Array.isArray(content) && content.length > 0) {
              // Prefer text content
              const textParts = content
                .filter((c): c is { type: string; text?: string } =>
                  typeof c === 'object' && c !== null
                )
                .map((c) => c.text)
                .filter((t): t is string => typeof t === 'string')
              if (textParts.length > 0) {
                resultText = textParts.join('\n')
              } else {
                // Fallback: return structured content
                resultText = JSON.stringify(content)
              }
            } else {
              resultText = JSON.stringify(result)
            }
            // Truncate very large results to prevent token limit errors
            if (resultText.length > MAX_MCP_TOOL_RESULT_CHARS) {
              console.warn(`[MCP] Truncating tool ${toolId} result from ${resultText.length} to ${MAX_MCP_TOOL_RESULT_CHARS} chars`)
              resultText = resultText.slice(0, MAX_MCP_TOOL_RESULT_CHARS) + '\n\n[Result truncated due to length]'
            }
            return resultText
          } catch (err) {
            void fireAndForgetRecordToolInvocation({
              userId: config.userId,
              toolName: toolId,
              mode: 'act',
              modelId: undefined,
              conversationId: undefined,
              turnId: undefined,
              success: false,
              durationMs: Date.now() - start,
              error: err instanceof Error ? err.message : String(err),
            })
            throw err
          }
        },
      })
    }

    return toolSet
  } catch (err) {
    console.warn(`[MCP] Failed to discover tools from ${config.name}: ${err instanceof Error ? err.message : String(err)}`)
    return {}
  } finally {
    try {
      await client.close()
    } catch {
      // ignore close errors
    }
  }
}

async function buildMcpToolSet(args: {
  userId: string
  accessToken?: string
  serverSecret?: string
}): Promise<ToolSet> {
  const serverSecret = args.serverSecret ?? getInternalApiSecret()
  console.log(`[MCP] Fetching enabled MCP servers for user ${args.userId}`)
  const configs = (await convex.query('mcpServers:listEnabled', {
    userId: args.userId,
    accessToken: args.accessToken,
    serverSecret,
  })) as McpServerConfig[]

  if (!configs || configs.length === 0) {
    console.log(`[MCP] No enabled MCP servers found for user ${args.userId}`)
    return {}
  }
  console.log(`[MCP] Found ${configs.length} enabled MCP server(s): ${configs.map(c => c.name).join(', ')}`)

  const allTools: ToolSet = {}
  const globalSeen = new Set<string>()

  for (const config of configs) {
    try {
      console.log(`[MCP] Discovering tools from server: ${config.name} (${config.transport} ${config.url})`)
      const serverTools = await discoverToolsForServer(config)
      console.log(`[MCP] Discovered ${Object.keys(serverTools).length} tools from server: ${config.name}`)
      for (const [id, def] of Object.entries(serverTools)) {
        if (globalSeen.has(id)) {
          // Global collision: suffix the server name
          let suffix = 1
          let newId = `${id}_${suffix}`
          while (globalSeen.has(newId)) {
            suffix++
            newId = `${id}_${suffix}`
          }
          globalSeen.add(newId)
          allTools[newId] = def
        } else {
          globalSeen.add(id)
          allTools[id] = def
        }
      }
    } catch (err) {
      console.warn(`[MCP] Skipping server ${config.name} due to error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return allTools
}

export async function createMcpToolSet(args: {
  userId: string
  accessToken?: string
  serverSecret?: string
}): Promise<ToolSet> {
  const now = Date.now()
  const cacheKey = args.userId
  const cached = mcpCache.get(cacheKey)
  if (cached && now - cached.createdAt < MCP_CACHE_TTL_MS) {
    console.log(`[MCP] Cache hit for user ${args.userId}, returning ${Object.keys(cached.tools).length} cached tools`)
    return cached.tools
  }

  const existing = mcpInFlight.get(cacheKey)
  if (existing) {
    console.log(`[MCP] In-flight request for user ${args.userId}, awaiting`)
    return existing
  }

  console.log(`[MCP] Building MCP tool set for user ${args.userId}`)
  const promise = (async () => {
    try {
      const tools = await buildMcpToolSet(args)
      console.log(`[MCP] Built ${Object.keys(tools).length} MCP tools for user ${args.userId}`)
      mcpCache.set(cacheKey, { tools, createdAt: Date.now() })
      return tools
    } finally {
      mcpInFlight.delete(cacheKey)
    }
  })()
  mcpInFlight.set(cacheKey, promise)
  return promise
}

/** Fire-and-forget pre-warm. Errors are swallowed. */
export function prewarmMcpTools(args: {
  userId: string
  accessToken?: string
  serverSecret?: string
}): void {
  const cached = mcpCache.get(args.userId)
  if (cached && Date.now() - cached.createdAt < MCP_CACHE_TTL_MS) return
  if (mcpInFlight.has(args.userId)) return
  void createMcpToolSet(args).catch(() => {
    // swallow
  })
}
