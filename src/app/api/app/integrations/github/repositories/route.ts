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

  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim()
  }

  return null
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
    const cursor = searchParams.get('cursor') ?? undefined
    const limitParam = searchParams.get('limit')
    const limit = Math.min(
      limitParam ? parseInt(limitParam, 10) : 100,
      200
    )

    // Load Composio SDK and initialize
    let composio: unknown
    try {
      composio = await loadComposioSDK(apiKey)
    } catch (err) {
      console.error('[GitHub Repositories] Failed to load Composio SDK:', err)
      return NextResponse.json(
        {
          items: [],
          nextCursor: null,
          error: 'fetch_failed',
        } as GithubRepositoryListResponse
      )
    }

    // Call Composio LIST_REPOSITORIES action
    let result: unknown
    try {
      // Use the Composio SDK to list repositories for the user's connected GitHub account
      const action = (composio as any).getAction('LIST_REPOSITORIES', 'github')
      const params: Record<string, unknown> = { limit }
      if (cursor) {
        params.cursor = cursor
      }
      result = await action.execute(params)
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
