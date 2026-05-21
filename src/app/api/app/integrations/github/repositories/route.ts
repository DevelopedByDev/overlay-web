import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { getServerProviderKey } from '@/lib/server-provider-keys'
import type { GithubRepositoryListResponse, GithubRepositoryListItem } from '@overlay/app-core'

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

/**
 * Extracts repository full name from a Composio repository object.
 * Tries multiple possible field names since Composio's response shape may vary.
 *
 * Returns only values that contain a literal `/` separator — bare repository
 * names without an owner prefix would render in the picker but fail validation
 * on save (the normalizer regex requires `owner/name`), producing confusing
 * 400 errors. Skip them at the extractor instead.
 */
function extractRepositoryFullName(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null

  const record = item as Record<string, unknown>

  // Try common field names for repository full name
  const fullName =
    record.full_name ||
    record.fullName ||
    record.name ||
    (typeof record.repository === 'object' && record.repository !== null
      ? (record.repository as Record<string, unknown>).full_name
      : null)

  if (typeof fullName !== 'string') return null
  const trimmed = fullName.trim()
  if (!trimmed) return null
  // Must contain exactly one '/' producing two non-empty segments.
  const parts = trimmed.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  return trimmed
}

/**
 * Extracts boolean flags from a repository object.
 */
function extractRepositoryFlags(item: unknown): { private?: boolean; archived?: boolean } {
  if (!item || typeof item !== 'object') return {}

  const record = item as Record<string, unknown>
  const flags: { private?: boolean; archived?: boolean } = {}

  if (typeof record.private === 'boolean') {
    flags.private = record.private
  }
  if (typeof record.archived === 'boolean') {
    flags.archived = record.archived
  }

  return flags
}

/**
 * GET /api/app/integrations/github/repositories
 *
 * Returns the authenticated user's GitHub repositories as seen by their connected
 * Composio account. Used by the project-settings drawer for repository selection.
 *
 * Query params:
 *   - cursor?: string   — pagination cursor (passed through to Composio opaquely)
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
      return NextResponse.json({
        items: [],
        nextCursor: null,
        error: 'github_not_connected',
      } as GithubRepositoryListResponse)
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)

    // cursor: opaque string forwarded to Composio. Validated against a permissive
    // alphanumeric/base64-ish character set before forwarding to avoid forwarding
    // attacker-controlled values into the SDK's URL construction (defense in depth).
    const rawCursor = searchParams.get('cursor')
    const cursor = rawCursor && /^[A-Za-z0-9+/=_.\-]{1,512}$/.test(rawCursor) ? rawCursor : undefined

    // limit: clamp to [1, 200] with default 100. parseInt may return NaN for
    // non-numeric input; Number.isFinite guards against propagating NaN into
    // Math.min (which would yield NaN and be forwarded to the SDK).
    const limitParam = searchParams.get('limit')
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : 100
    const limit = Math.min(
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100,
      200,
    )

    // Load Composio SDK and create a per-user session. The session binds the
    // outbound tool calls to the user's connected GitHub account.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let session: any
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const composio: any = await loadComposioSDK(apiKey)
      session = await composio.create(auth.userId)
    } catch (err) {
      console.error('[GitHub Repositories] Failed to load Composio SDK or create session:', err)
      return NextResponse.json(
        {
          items: [],
          nextCursor: null,
          error: 'fetch_failed',
        } as GithubRepositoryListResponse
      )
    }

    // Execute the GITHUB_LIST_REPOS tool via the session. This matches the
    // documented Composio SDK API (session.execute(toolSlug, args)) — the
    // earlier draft used a non-existent composio.getAction() method.
    let result: unknown
    try {
      const args: Record<string, unknown> = { per_page: limit }
      if (cursor) {
        args.cursor = cursor
      }
      result = await session.execute('GITHUB_LIST_REPOS', args)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const isRateLimit =
        errorMsg.toLowerCase().includes('rate') ||
        errorMsg.toLowerCase().includes('429')

      if (isRateLimit) {
        return NextResponse.json({
          items: [],
          nextCursor: null,
          error: 'rate_limited',
        } as GithubRepositoryListResponse)
      }

      console.error('[GitHub Repositories] Composio action failed:', err)
      return NextResponse.json({
        items: [],
        nextCursor: null,
        error: 'fetch_failed',
      } as GithubRepositoryListResponse)
    }

    // Extract repositories from result
    let rawRepos: unknown[] = []
    let nextCursor: string | null = null

    if (result && typeof result === 'object') {
      const record = result as Record<string, unknown>

      // Try to extract items array from various possible shapes
      if (Array.isArray(record.items)) {
        rawRepos = record.items
      } else if (Array.isArray(record.data)) {
        rawRepos = record.data
      } else if (Array.isArray(record.repositories)) {
        rawRepos = record.repositories
      } else if (Array.isArray(result)) {
        rawRepos = result as unknown[]
      }

      // Extract pagination cursor if present
      if (typeof record.nextCursor === 'string') {
        nextCursor = record.nextCursor
      } else if (typeof record.cursor === 'string') {
        nextCursor = record.cursor
      }
    }

    // Map repositories to the response DTO
    const items: GithubRepositoryListItem[] = []
    for (const repo of rawRepos) {
      const fullName = extractRepositoryFullName(repo)
      if (!fullName) continue

      const flags = extractRepositoryFlags(repo)
      items.push({
        fullName: fullName.toLowerCase(),
        ...flags,
      })
    }

    return NextResponse.json({
      items,
      nextCursor,
    } as GithubRepositoryListResponse)
  } catch (err) {
    console.error('[GitHub Repositories] Unexpected error:', err)
    // Return HTTP 500 for true server errors, not in the typed error field
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
