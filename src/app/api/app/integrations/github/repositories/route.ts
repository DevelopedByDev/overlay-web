import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import { getServerProviderKey } from '@/server/ai/provider-keys'
import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import { projectComposioEntityId } from '@/server/tools/composio-entity'
import {
  buildGithubRepositoryListResponse,
  classifyGithubRepositoryProxyFailure,
  findGithubConnectedAccountId,
  isGithubRepositoryToolSuccess,
  parseGithubRepositoryLimit,
  parseGithubRepositoryPage,
} from '@/server/integrations/github-repositories'
import type { GithubRepositoryListResponse } from '@overlay/app-core'
import type { Id } from '../../../../../../../convex/_generated/dataModel'

type ConnectedAccountRecord = {
  id?: string
  appName?: string
  status?: string
  isDisabled?: boolean
}

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

/**
 * Resolves the Composio API key from server provider or environment.
 */
async function getComposioApiKey(accessToken: string): Promise<string | null> {
  const serverKey = accessToken ? await getServerProviderKey('composio') : null
  return serverKey ?? process.env.COMPOSIO_API_KEY ?? null
}

function repositoryListErrorResponse(
  error: GithubRepositoryListResponse['error'],
  status = 200,
): NextResponse {
  return NextResponse.json(
    { items: [], nextCursor: null, error } as GithubRepositoryListResponse,
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
 * Surfaces Composio API error envelope fields (status, errorId, body) in logs.
 * Default util.inspect collapses these to `[Object]` and hides the API message.
 *
 * Also traverses `.cause` chain (up to 3 levels). `ComposioToolExecutionError`
 * wraps the underlying `APIError` from `@composio/client` as its `cause`, so
 * the actual HTTP status and response body live there, not on the outer error.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listConnectedAccounts(composio: any, entityId: string): Promise<ConnectedAccountRecord[]> {
  // Composio's v1 `connectedAccounts` endpoint started returning 410 ("Gone");
  // use the v3 SDK surface. `findGithubConnectedAccountId` already reads from
  // either `appName` (v1) or `toolkit.slug` (v3), so this swap is downstream-
  // transparent.
  try {
    const response = await composio.connectedAccounts.list({ userIds: [entityId] })
    return Array.isArray(response?.items) ? response.items : []
  } catch (err) {
    console.warn(
      `[GitHub Repositories] listConnectedAccounts SDK call failed for entity ${entityId.slice(-8)}:`,
      err instanceof Error ? err.message : String(err),
    )
    return []
  }
}

/**
 * GET /api/app/integrations/github/repositories
 *
 * Returns GitHub repositories visible to the connected account for this project.
 * Used by the project-settings drawer for repository selection.
 *
 * Query params:
 *   - projectId: string  — project whose connected GitHub account should be used
 *   - cursor?: string   — GitHub REST page number as an opaque client cursor
 *   - limit?: number    — max items per page (default 100, capped at 200)
 *
 * Response shape: GithubRepositoryListResponse
 *   - items: Array of { fullName (lowercased), private?, archived? }
 *   - nextCursor: pagination cursor or null
 *   - error?: 'github_not_connected' | 'fetch_failed' | 'rate_limited'
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' } as const,
        { status: 401 }
      )
    }

    // Get Composio API key
    const apiKey = await getComposioApiKey(auth.accessToken)
    if (!apiKey) {
      return repositoryListErrorResponse('github_not_connected')
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const entityId = await requireProjectEntityId(searchParams.get('projectId'), auth.userId)
    if (!entityId) {
      return repositoryListErrorResponse('github_not_connected', 400)
    }

    // Load the SDK once — used for both connectedAccounts.list (discovery) and
    // tools.execute (the actual proxy call below).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let composio: any
    try {
      composio = await loadComposioSDK(apiKey)
    } catch (err) {
      console.error('[GitHub Repositories] Failed to load Composio SDK:', describeComposioError(err))
      return repositoryListErrorResponse('fetch_failed')
    }

    const connectedAccounts = await listConnectedAccounts(composio, entityId)
    const githubConnectedAccountId = findGithubConnectedAccountId(connectedAccounts)
    if (!githubConnectedAccountId) {
      return repositoryListErrorResponse('github_not_connected')
    }

    const page = parseGithubRepositoryPage(searchParams.get('cursor'))
    const limit = parseGithubRepositoryLimit(searchParams.get('limit'))

    // Use Composio's pre-built GITHUB tool slug rather than the generic
    // external-proxy surface. The proxy is gated behind an org entitlement
    // (`ExternalProxy_OrgNotAllowed`) this org doesn't have; the toolkit
    // tool path is part of the core product.
    const composioArguments: Record<string, string | number> = {
      visibility: 'all',
      affiliation: 'owner,collaborator,organization_member',
      sort: 'updated',
      direction: 'desc',
      per_page: limit,
      page,
    }

    let result: unknown
    try {
      result = await composio.tools.execute(
        'GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER',
        {
          // Composio requires BOTH userId (entity_id) AND connectedAccountId
          // for tools.execute against authenticated toolkits. Passing only the
          // connectedAccountId returns 400 `ActionExecute_ConnectedAccountEntityIdRequired`.
          userId: entityId,
          connectedAccountId: githubConnectedAccountId,
          arguments: composioArguments,
          // Tying this server route to a dated toolkit version would be more
          // fragile than this flag, and matches how the chat flow uses these
          // tools (no version pinning).
          dangerouslySkipVersionCheck: true,
        },
      )
      if (!isGithubRepositoryToolSuccess(result)) {
        const error = classifyGithubRepositoryProxyFailure(result)
        console.error('[GitHub Repositories] GitHub tool execute failed:', result)
        return repositoryListErrorResponse(error)
      }
    } catch (err) {
      const error = classifyGithubRepositoryProxyFailure(err)
      console.error('[GitHub Repositories] Composio GitHub tool execute threw:', describeComposioError(err))
      return repositoryListErrorResponse(error)
    }

    return NextResponse.json(buildGithubRepositoryListResponse(result, { limit, page }))
  } catch (err) {
    console.error('[GitHub Repositories] Unexpected error:', err)
    // Return HTTP 500 for true server errors, not in the typed error field
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
