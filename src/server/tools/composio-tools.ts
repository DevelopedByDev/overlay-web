import 'server-only'

import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ToolSet } from 'ai'
import { getServerProviderKey } from '@/server/ai/provider-keys'
import { projectComposioEntityId } from '@/server/tools/composio-entity'

type JsonRecord = Record<string, unknown>

// Minimal surface of the Composio SDK that buildBrowserUnifiedTools needs.
// Letting tests inject a fake Composio without depending on @composio/core types.
type ComposioLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (userId: string, config?: any) => Promise<{
    tools: () => Promise<ToolSet>
  }>
  tools: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (userId: string, filters: { toolkits?: string[]; tools?: string[] }, options?: any) => Promise<ToolSet>
  }
}

const REMOVED_COMPOSIO_TOOLS = new Set([
  'COMPOSIO_REMOTE_BASH_TOOL',
  'COMPOSIO_REMOTE_WORKBENCH',
])

async function getComposioApiKey(accessToken?: string): Promise<string | null> {
  if (!accessToken) {
    return process.env.COMPOSIO_API_KEY ?? null
  }

  const serverKey = await getServerProviderKey('composio')
  return serverKey ?? process.env.COMPOSIO_API_KEY ?? null
}

function resolveComposioSessionIdFactory() {
  let composioSessionId: string | null = null

  function getProvidedSessionId(toolName: string, args: JsonRecord): string | undefined {
    if (toolName === 'COMPOSIO_SEARCH_TOOLS') {
      const session = args.session
      if (session && typeof session === 'object' && !Array.isArray(session)) {
        const id = (session as JsonRecord).id
        if (typeof id === 'string' && id.trim()) {
          return id.trim()
        }
      }
      return undefined
    }

    const sessionId = args.session_id
    return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : undefined
  }

  function resolve(toolName: string, args: JsonRecord): string {
    const provided = getProvidedSessionId(toolName, args)
    const fallbackSessionId = `overlay-web-${Date.now()}`

    if (!composioSessionId) {
      composioSessionId = provided || fallbackSessionId
    } else if (provided && provided !== composioSessionId) {
      console.warn(
        `[Composio] Overriding mismatched session_id for ${toolName}: ${provided} -> ${composioSessionId}`
      )
    }

    return composioSessionId
  }

  return { resolve }
}

function withConsistentComposioSession(
  toolName: string,
  args: JsonRecord,
  resolver: (toolName: string, args: JsonRecord) => string,
): JsonRecord {
  const sessionId = resolver(toolName, args)
  const normalized: JsonRecord = { ...args }

  if (toolName === 'COMPOSIO_SEARCH_TOOLS') {
    const existingSession =
      normalized.session &&
      typeof normalized.session === 'object' &&
      !Array.isArray(normalized.session)
        ? (normalized.session as JsonRecord)
        : {}

    normalized.session = {
      ...existingSession,
      id: sessionId,
    }

    if (normalized.session && typeof normalized.session === 'object') {
      delete (normalized.session as JsonRecord).generate_id
    }

    return normalized
  }

  normalized.session_id = sessionId
  return normalized
}

async function loadComposioModules(): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Composio: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VercelProvider: any
}> {
  try {
    const [coreModule, vercelModule] = await Promise.all([
      import('@composio/core'),
      import('@composio/vercel'),
    ])

    return {
      Composio: coreModule.Composio,
      VercelProvider: vercelModule.VercelProvider,
    }
  } catch {
    const coreUrl = pathToFileURL(
      path.resolve(process.cwd(), '../overlay-desktop/node_modules/@composio/core/dist/index.mjs')
    ).href
    const vercelUrl = pathToFileURL(
      path.resolve(process.cwd(), '../overlay-desktop/node_modules/@composio/vercel/dist/index.mjs')
    ).href

    try {
      const coreModule = await import(/* webpackIgnore: true */ coreUrl)
      const vercelModule = await import(/* webpackIgnore: true */ vercelUrl)

      return {
        Composio: coreModule.Composio,
        VercelProvider: vercelModule.VercelProvider,
      }
    } catch (error) {
      throw new Error(
        `Composio packages are unavailable for overlay-landing: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}

/**
 * Cache of resolved Composio tool sets, keyed by project Composio entity. The
 * first request per project per process pays the ~700–1000ms init cost;
 * subsequent requests inside TTL are basically free. In-flight promises are
 * stored so concurrent requests coalesce.
 */
type ComposioCacheEntry = {
  tools: ToolSet
  createdAt: number
}
const composioCache = new Map<string, ComposioCacheEntry>()
const composioInFlight = new Map<string, Promise<ToolSet>>()
const COMPOSIO_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

async function buildBrowserUnifiedTools(args: {
  userId: string
  projectId: string
  accessToken?: string
  /** Inject a Composio SDK instance (or fake) for tests. */
  composio?: ComposioLike
}): Promise<ToolSet> {
  let composio: ComposioLike
  if (args.composio) {
    composio = args.composio
  } else {
    const apiKey = await getComposioApiKey(args.accessToken)
    if (!apiKey) {
      throw new Error('COMPOSIO_API_KEY is not configured. Set it in Convex or the server environment.')
    }
    const { Composio, VercelProvider } = await loadComposioModules()
    composio = new Composio({ apiKey, provider: new VercelProvider() }) as ComposioLike
  }
  // manageConnections: false — integrations are managed exclusively via the
  // project settings drawer in this app, never via chat. Defaulting to `true`
  // makes Composio inject `MANAGE_CONNECTIONS` / `INITIATE_CONNECTION` meta-
  // tools and have SEARCH_TOOLS surface them, which causes the model to
  // present a "Connect this integration" card even when the toolkit is
  // already connected for the entity. Tools fall back to the entity's
  // existing connected accounts when called directly.
  // Diagnostic Fix A: explicitly scope toolkits. v3 tool-router defaults to a
  // small meta-tool set (SEARCH_TOOLS, MULTI_EXECUTE_TOOL, etc.) and never
  // pre-loads individual toolkit tools — which breaks the GITHUB_*-name-based
  // allowlist wrap below. Passing `toolkits` may (a) cause Composio to expose
  // individual toolkit tools directly, or (b) just narrow what SEARCH_TOOLS
  // surfaces. The next `[composio-tools] session toolset keys:` log line
  // tells us which.
  const session = await composio.create(
    projectComposioEntityId(args.userId, args.projectId),
    {
      toolkits: ['github', 'gmail', 'googledrive', 'googlecalendar', 'googlesheets', 'slack', 'notion', 'linear', 'outlook', 'cal_com'],
      manageConnections: false,
    },
  )
  const rawTools = (await session.tools()) as ToolSet
  // Diagnostic: confirms what Composio puts in the toolset for this session.
  // Specifically: do GITHUB_* tools exist? Is COMPOSIO_MANAGE_CONNECTIONS still
  // here despite `manageConnections: false`? Remove once the chat→github path
  // is stable.
  console.log('[composio-tools] session toolset keys:', Object.keys(rawTools))
  const wrappedTools = {} as ToolSet
  const { resolve } = resolveComposioSessionIdFactory()

  for (const [toolName, toolDef] of Object.entries(rawTools)) {
    if (REMOVED_COMPOSIO_TOOLS.has(toolName)) {
      continue
    }

    if (!toolDef || typeof toolDef !== 'object') {
      continue
    }

    const originalExecute = (toolDef as { execute?: unknown }).execute
    if (typeof originalExecute !== 'function') {
      wrappedTools[toolName] = toolDef
      continue
    }

    wrappedTools[toolName] = {
      ...toolDef,
      execute: async (input: JsonRecord, extra: unknown) => {
        const normalizedInput = withConsistentComposioSession(toolName, input ?? {}, resolve)
        return (originalExecute as (input: JsonRecord, extra: unknown) => Promise<unknown>)(
          normalizedInput,
          extra
        )
      },
    }
  }

  return wrappedTools
}

export async function createBrowserUnifiedTools(args: {
  userId: string
  projectId: string
  accessToken?: string
}): Promise<ToolSet> {
  const now = Date.now()
  const cacheKey = projectComposioEntityId(args.userId, args.projectId)
  const cached = composioCache.get(cacheKey)
  if (cached && now - cached.createdAt < COMPOSIO_CACHE_TTL_MS) {
    return cached.tools
  }

  const existing = composioInFlight.get(cacheKey)
  if (existing) return existing

  const promise = (async () => {
    try {
      const tools = await buildBrowserUnifiedTools(args)
      composioCache.set(cacheKey, { tools, createdAt: Date.now() })
      return tools
    } finally {
      composioInFlight.delete(cacheKey)
    }
  })()
  composioInFlight.set(cacheKey, promise)
  return promise
}

/** Fire-and-forget pre-warm. Errors are swallowed — the real call will surface them. */
export function prewarmBrowserUnifiedTools(args: {
  userId: string
  projectId: string
  accessToken?: string
}): void {
  const cacheKey = projectComposioEntityId(args.userId, args.projectId)
  const cached = composioCache.get(cacheKey)
  if (cached && Date.now() - cached.createdAt < COMPOSIO_CACHE_TTL_MS) return
  if (composioInFlight.has(cacheKey)) return
  void createBrowserUnifiedTools(args).catch(() => {
    // swallow — next real call will throw and surface properly
  })
}
