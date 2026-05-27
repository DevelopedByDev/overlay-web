import 'server-only'

import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ToolSet } from 'ai'
import { getServerProviderKey } from '@/server/ai/provider-keys'
import { projectComposioEntityId } from '@/server/tools/composio-entity'

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

/**
 * Curated read-only GitHub tool slugs surfaced to the chat AI.
 *
 * Selected to cover "ask questions about an allowlisted repo" use cases —
 * NO write/admin/destructive operations. Composio's
 * `{ toolkits: ['github'], limit: 500 }` exposes ~500 tools including
 * DELETE/ADD_COLLABORATOR/etc.; this list narrows the surface to the
 * minimum set the chat needs.
 *
 * Phase B follow-up (separate PR): per-project `allowGithubWrites: boolean`
 * flag that swaps in the full toolkit instead of this curated list.
 */
const CHAT_GITHUB_READONLY_TOOL_SLUGS = [
  // Repo metadata
  'GITHUB_GET_A_REPOSITORY',
  'GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER',
  // File/directory content
  'GITHUB_GET_REPOSITORY_CONTENT',
  'GITHUB_GET_A_REPOSITORY_README',
  // Commits
  'GITHUB_LIST_COMMITS',
  'GITHUB_GET_A_COMMIT',
  // Issues
  'GITHUB_LIST_REPOSITORY_ISSUES',
  'GITHUB_GET_AN_ISSUE',
  // Pull requests
  'GITHUB_LIST_PULL_REQUESTS',
  'GITHUB_GET_A_PULL_REQUEST',
  // Search
  'GITHUB_SEARCH_CODE',
] as const

async function getComposioApiKey(accessToken?: string): Promise<string | null> {
  if (!accessToken) {
    return process.env.COMPOSIO_API_KEY ?? null
  }

  const serverKey = await getServerProviderKey('composio')
  return serverKey ?? process.env.COMPOSIO_API_KEY ?? null
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

if (process.env.NODE_ENV !== 'production') {
  // Dev: clear any cached ToolSet at module load so changes here take
  // effect on the next chat turn without needing a hard restart. In prod,
  // the cache persists across requests as before.
  composioCache.clear()
  composioInFlight.clear()
}

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
  const entityId = projectComposioEntityId(args.userId, args.projectId)

  // Static curated read-only GitHub toolset. The v3 tool-router session
  // (composio.create) returned only meta-tools (SEARCH_TOOLS, etc.) which
  // broke name-based allowlist matching. The static `tools.get` surface
  // returns Vercel-AI-SDK-compatible tool callables keyed by their
  // GITHUB_* slug — which is exactly what applyGithubRepoAllowlistToTools
  // matches at the route layer.
  const rawTools = (await composio.tools.get(entityId, {
    tools: [...CHAT_GITHUB_READONLY_TOOL_SLUGS],
  })) as ToolSet

  console.log(
    '[composio-tools] static github toolset keys:',
    Object.keys(rawTools),
  )

  return rawTools
}

export async function createBrowserUnifiedTools(args: {
  userId: string
  projectId: string
  accessToken?: string
  /** Inject a Composio SDK instance (or fake) for tests. */
  composio?: ComposioLike
}): Promise<ToolSet> {
  // When a fake Composio is injected we bypass the cache so each test gets a
  // fresh build path. The cache is keyed on the entity id only, so reusing it
  // across tests would yield stale results from the first run.
  if (args.composio) {
    return buildBrowserUnifiedTools(args)
  }

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
