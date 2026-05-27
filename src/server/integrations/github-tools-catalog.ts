import type { GithubToolInfo } from '@overlay/app-core'
import { categorizeGithubToolSlug } from '@/server/tools/github-tool-categories'

/**
 * Minimal Composio surface needed to enumerate a toolkit catalog. Decoupled
 * from `@composio/core` types so tests can inject a fake. Matches the
 * `ComposioLike` pattern in `composio-tools.ts`.
 */
export type ComposioCatalogClient = {
  tools: {
    get: (
      userId: string,
      filters: { toolkits?: string[]; tools?: string[] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      options?: any,
    ) => Promise<unknown>
  }
}

/**
 * Composio returns the catalog as a record keyed by slug, with each value
 * exposing at least description/name. The SDK types are loose, so we accept
 * the union of likely shapes and narrow at runtime.
 */
type ComposioToolCatalogEntry = {
  description?: unknown
  name?: unknown
  toolName?: unknown
}

export type CatalogErrorCode = 'fetch_failed' | 'rate_limited' | 'github_not_connected'

export type FetchCatalogResult =
  | { items: GithubToolInfo[] }
  | { error: CatalogErrorCode }

const ERROR_TEXT_TO_CODE: ReadonlyArray<readonly [RegExp, CatalogErrorCode]> = [
  [/no active connection/i, 'github_not_connected'],
  [/noactiveconnection/i, 'github_not_connected'],
  [/connected\s*account.*entity.*required/i, 'github_not_connected'],
  [/connectedaccountentityidrequired/i, 'github_not_connected'],
  [/rate.?limit/i, 'rate_limited'],
]

/**
 * Humanizes a Composio GitHub tool slug for display.
 *
 *   GITHUB_GET_AN_ISSUE → "Get an issue"
 *   GITHUB_LIST_PULL_REQUESTS → "List pull requests"
 *   GITHUB_GET_A_REPOSITORY_README → "Get a repository readme"
 *
 * Strips the `GITHUB_` prefix (no toolkit redundancy in the label), lowercases
 * the remainder, replaces underscores with spaces, and capitalizes the first
 * character. No special-case heuristics — slugs not starting with `GITHUB_`
 * pass through with the same lowercase/underscore handling.
 */
export function humanizeSlug(slug: string): string {
  const stripped = slug.startsWith('GITHUB_') ? slug.slice('GITHUB_'.length) : slug
  if (!stripped) return ''
  const words = stripped.replace(/_/g, ' ').toLowerCase().trim()
  if (!words) return ''
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function deriveStatus(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyValue = value as any
  if (typeof anyValue.status === 'number') return anyValue.status
  if (anyValue.cause) {
    return deriveStatus(anyValue.cause)
  }
  return null
}

function errorMessageText(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    try {
      return JSON.stringify(err)
    } catch {
      return ''
    }
  }
  return ''
}

/**
 * Classifies a thrown error from `composio.tools.get` into the response
 * error code surfaced to the picker UI. Mirrors
 * `classifyGithubRepositoryProxyFailure` for catalog-side errors.
 */
export function classifyCatalogFetchError(err: unknown): { error: CatalogErrorCode } {
  const status = deriveStatus(err)
  if (status === 429) return { error: 'rate_limited' }
  if (status === 401 || status === 403) return { error: 'github_not_connected' }

  const text = errorMessageText(err)
  for (const [pattern, code] of ERROR_TEXT_TO_CODE) {
    if (pattern.test(text)) {
      return { error: code }
    }
  }
  return { error: 'fetch_failed' }
}

function readStringField(entry: ComposioToolCatalogEntry, ...keys: Array<keyof ComposioToolCatalogEntry>): string {
  for (const key of keys) {
    const value = entry[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

/**
 * Transforms a Composio catalog response (record keyed by slug) into the
 * sorted `GithubToolInfo[]` shape the picker UI expects.
 *
 * - Falls back to a humanized slug when Composio omits `name`.
 * - Categorizes each slug via the shared heuristic.
 * - Sorts alphabetically by slug for stable output.
 */
export function buildCatalogItems(catalog: Record<string, ComposioToolCatalogEntry>): GithubToolInfo[] {
  const items: GithubToolInfo[] = []
  for (const [slug, entry] of Object.entries(catalog)) {
    if (!slug || typeof slug !== 'string') continue
    const safeEntry = entry && typeof entry === 'object' ? entry : {}
    const name = readStringField(safeEntry, 'name', 'toolName') || humanizeSlug(slug)
    const description = readStringField(safeEntry, 'description')
    items.push({
      slug,
      name,
      description,
      category: categorizeGithubToolSlug(slug),
    })
  }
  items.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
  return items
}

/**
 * Fetches the full GitHub toolkit catalog from Composio and maps it into
 * `GithubToolInfo[]`. Caller handles HTTP wrapping + caching.
 *
 * - Empty catalog → returns `{ error: 'github_not_connected' }` (Composio
 *   returns nothing when the entity has no connected GitHub account that
 *   the catalog enumeration can bind against).
 * - Thrown error → classified via `classifyCatalogFetchError`.
 */
export async function fetchGithubToolsCatalog(args: {
  entityId: string
  composio: ComposioCatalogClient
  /** Page-size cap. Composio honors values up to 500. */
  limit?: number
}): Promise<FetchCatalogResult> {
  const limit = args.limit ?? 500
  let raw: unknown
  try {
    raw = await args.composio.tools.get(
      args.entityId,
      { toolkits: ['github'] },
      { limit },
    )
  } catch (err) {
    return classifyCatalogFetchError(err)
  }

  if (!raw || typeof raw !== 'object') {
    return { error: 'github_not_connected' }
  }

  const catalog = raw as Record<string, ComposioToolCatalogEntry>
  const items = buildCatalogItems(catalog)
  if (items.length === 0) {
    return { error: 'github_not_connected' }
  }

  return { items }
}
