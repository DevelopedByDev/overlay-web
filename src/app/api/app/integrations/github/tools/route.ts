import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import { getServerProviderKey } from '@/server/ai/provider-keys'
import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import { projectComposioEntityId } from '@/server/tools/composio-entity'
import {
  fetchGithubToolsCatalog,
  type ComposioCatalogClient,
} from '@/server/integrations/github-tools-catalog'
import {
  DEFAULT_GITHUB_TOOL_SLUGS,
} from '@/server/tools/composio-tools'
import { isHardDeniedGithubTool } from '@/server/tools/github-tools-hard-deny'
import type { GithubToolInfo, GithubToolListResponse } from '@overlay/app-core'
import type { Id } from '../../../../../../../convex/_generated/dataModel'

/**
 * Loads the Composio SDK using dynamic import with fallback to overlay-desktop node_modules.
 * Matches the pattern from sibling integrations routes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadComposioSDK(apiKey: string): Promise<any> {
  let ComposioModule: { Composio: new (args: { apiKey: string }) => unknown }

  try {
    ComposioModule = await import('@composio/core')
  } catch {
    const coreUrl = pathToFileURL(
      path.resolve(process.cwd(), '../overlay-desktop/node_modules/@composio/core/dist/index.mjs')
    ).href
    ComposioModule = await import(/* webpackIgnore: true */ coreUrl)
  }

  const { Composio } = ComposioModule
  return new Composio({ apiKey })
}

async function getComposioApiKey(accessToken: string): Promise<string | null> {
  const serverKey = accessToken ? await getServerProviderKey('composio') : null
  return serverKey ?? process.env.COMPOSIO_API_KEY ?? null
}

function toolListErrorResponse(
  error: NonNullable<GithubToolListResponse['error']>,
  status = 200,
): NextResponse {
  return NextResponse.json(
    {
      items: [],
      defaultEnabled: [...DEFAULT_GITHUB_TOOL_SLUGS],
      hardDenied: [],
      error,
    } satisfies GithubToolListResponse,
    { status },
  )
}

async function requireProjectEntityId(projectId: string | null, userId: string): Promise<string | null> {
  const trimmed = projectId?.trim()
  if (!trimmed) return null

  try {
    const project = await convex.query<{ _id: string } | null>('projects/projects:get', {
      projectId: trimmed as Id<'projects'>,
      userId,
      serverSecret: getInternalApiSecret(),
    })
    if (!project) return null
  } catch {
    return null
  }

  return projectComposioEntityId(userId, trimmed)
}

/**
 * Logs Composio API error envelope fields (status, errorId, body) plus the
 * `.cause` chain. Mirrors the sibling repos route's diagnostic helper so the
 * picker UI gets a useful server log when fetches fail.
 */
function describeComposioError(err: unknown, depth = 0): Record<string, unknown> {
  if (!err || typeof err !== 'object') return { message: String(err) }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = err as any
  const out: Record<string, unknown> = {
    name: anyErr.constructor?.name,
    code: anyErr.code,
    status: anyErr.status,
    errorId: anyErr.errorId,
    error: anyErr.error,
    message: err instanceof Error ? err.message : String(err),
  }
  if (anyErr.possibleFixes) out.possibleFixes = anyErr.possibleFixes
  if (depth < 3 && anyErr.cause) {
    out.cause = describeComposioError(anyErr.cause, depth + 1)
  }
  return out
}

/**
 * Per-entity catalog cache. Composio's GitHub toolkit catalog is stable across
 * a session — refetching ~500 tools on every chat-settings drawer open is
 * wasteful (1–2s round trip + prompt overhead) and would rate-limit easily.
 *
 * Dev: cleared at module load so tweaks here surface on next request without a
 * hard restart. Prod: persists for the TTL.
 */
type CatalogCacheEntry = {
  items: GithubToolInfo[]
  fetchedAt: number
}
const catalogCache = new Map<string, CatalogCacheEntry>()
const CATALOG_TTL_MS = 60 * 60 * 1000 // 1 hour

if (process.env.NODE_ENV !== 'production') {
  catalogCache.clear()
}

/**
 * GET /api/app/integrations/github/tools
 *
 * Returns the full Composio GitHub toolkit catalog plus the server-side
 * default-enabled list and the resolved hard-deny list, for the project-
 * settings tool picker.
 *
 * Query params:
 *   - projectId: string  — project whose connected GitHub account scopes the fetch
 *
 * Response shape: GithubToolListResponse
 *   - items: Array of { slug, name, description, category }
 *   - defaultEnabled: slugs enabled by default when no override is set
 *   - hardDenied: slugs in `items` that are blocked by the hard-deny policy
 *   - error?: 'github_not_connected' | 'fetch_failed' | 'rate_limited'
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' } as const,
        { status: 401 },
      )
    }

    const apiKey = await getComposioApiKey(auth.accessToken)
    if (!apiKey) {
      return toolListErrorResponse('github_not_connected')
    }

    const { searchParams } = new URL(request.url)
    const entityId = await requireProjectEntityId(searchParams.get('projectId'), auth.userId)
    if (!entityId) {
      return toolListErrorResponse('github_not_connected', 400)
    }

    // Serve from cache when fresh. The catalog is keyed by entity so two
    // projects under the same user still get independent fetches (matches
    // how the chat route scopes Composio entities).
    const cached = catalogCache.get(entityId)
    if (cached && Date.now() - cached.fetchedAt < CATALOG_TTL_MS) {
      return NextResponse.json({
        items: cached.items,
        defaultEnabled: [...DEFAULT_GITHUB_TOOL_SLUGS],
        hardDenied: cached.items
          .filter((item) => isHardDeniedGithubTool(item.slug))
          .map((item) => item.slug),
      } satisfies GithubToolListResponse)
    }

    let composio: ComposioCatalogClient
    try {
      composio = (await loadComposioSDK(apiKey)) as ComposioCatalogClient
    } catch (err) {
      console.error('[GitHub Tools Catalog] Failed to load Composio SDK:', describeComposioError(err))
      return toolListErrorResponse('fetch_failed')
    }

    const result = await fetchGithubToolsCatalog({ entityId, composio })
    if ('error' in result) {
      // Only log when it's not the expected "not connected" branch — those are
      // a user-onboarding state, not a system error.
      if (result.error !== 'github_not_connected') {
        console.error('[GitHub Tools Catalog] fetch failed:', result.error)
      }
      return toolListErrorResponse(result.error)
    }

    catalogCache.set(entityId, { items: result.items, fetchedAt: Date.now() })

    return NextResponse.json({
      items: result.items,
      defaultEnabled: [...DEFAULT_GITHUB_TOOL_SLUGS],
      // Resolved against the actual catalog so the UI sees real slugs (the
      // verb-gated regex patterns are an implementation detail). The picker
      // greys these out instead of hiding them so users understand the policy.
      hardDenied: result.items
        .filter((item) => isHardDeniedGithubTool(item.slug))
        .map((item) => item.slug),
    } satisfies GithubToolListResponse)
  } catch (err) {
    console.error('[GitHub Tools Catalog] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
