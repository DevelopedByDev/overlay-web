import type { GithubRepositoryListItem, GithubRepositoryListResponse } from '@overlay/app-core'

export const GITHUB_REPOSITORIES_ENDPOINT = 'https://api.github.com/user/repos'

const DEFAULT_REPOSITORY_LIMIT = 100
const MAX_REPOSITORY_LIMIT = 200

export type GithubRepositoriesProxyResponse = {
  status?: number
  data?: unknown
  headers?: unknown
  successful?: boolean
  error?: unknown
}

export type GithubConnectedAccountLike = {
  id?: unknown
  appName?: unknown
  app_name?: unknown
  toolkit?: unknown
  toolkitSlug?: unknown
  toolkit_slug?: unknown
  status?: unknown
  isDisabled?: unknown
  is_disabled?: unknown
}

function parsePositiveInteger(value: string | null | undefined): number | null {
  const trimmed = value?.trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function normalizeSlug(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function toolkitSlugFromConnectedAccount(account: GithubConnectedAccountLike): string {
  const toolkit = account.toolkit && typeof account.toolkit === 'object'
    ? account.toolkit as Record<string, unknown>
    : null
  return (
    normalizeSlug(account.appName) ||
    normalizeSlug(account.app_name) ||
    normalizeSlug(account.toolkitSlug) ||
    normalizeSlug(account.toolkit_slug) ||
    normalizeSlug(toolkit?.slug)
  )
}

function connectedAccountIsActive(account: GithubConnectedAccountLike): boolean {
  if (account.isDisabled === true || account.is_disabled === true) return false
  const status = normalizeSlug(account.status)
  return !status || status === 'active' || status === 'connected'
}

export function findGithubConnectedAccountId(
  accounts: readonly GithubConnectedAccountLike[],
): string | null {
  const account = accounts.find((item) =>
    toolkitSlugFromConnectedAccount(item) === 'github' &&
    connectedAccountIsActive(item) &&
    typeof item.id === 'string' &&
    item.id.trim(),
  )
  return typeof account?.id === 'string' ? account.id.trim() : null
}

export function parseGithubRepositoryPage(cursor: string | null | undefined): number {
  return parsePositiveInteger(cursor) ?? 1
}

export function parseGithubRepositoryLimit(limit: string | null | undefined): number {
  const parsed = limit ? Number.parseInt(limit, 10) : DEFAULT_REPOSITORY_LIMIT
  const safeLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REPOSITORY_LIMIT
  return Math.min(safeLimit, MAX_REPOSITORY_LIMIT)
}

function extractRepositoryFullName(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null

  const record = item as Record<string, unknown>
  const fullNameCandidate =
    record.full_name ||
    record.fullName ||
    record.name ||
    (typeof record.repository === 'object' && record.repository !== null
      ? (record.repository as Record<string, unknown>).full_name
      : null)

  let fullName = typeof fullNameCandidate === 'string' ? fullNameCandidate.trim() : ''
  if (fullName && !fullName.includes('/') && typeof record.owner === 'object' && record.owner !== null) {
    const owner = record.owner as Record<string, unknown>
    const ownerName = typeof owner.login === 'string' ? owner.login.trim() : ''
    if (ownerName) fullName = `${ownerName}/${fullName}`
  }

  const trimmed = fullName.trim()
  if (!trimmed) return null
  const parts = trimmed.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  return trimmed
}

function extractRepositoryFlags(item: unknown): { private?: boolean; archived?: boolean } {
  if (!item || typeof item !== 'object') return {}

  const record = item as Record<string, unknown>
  const flags: { private?: boolean; archived?: boolean } = {}

  if (typeof record.private === 'boolean') {
    flags.private = record.private
  } else if (typeof record.is_private === 'boolean') {
    flags.private = record.is_private
  } else if (record.visibility === 'private') {
    flags.private = true
  } else if (record.visibility === 'public') {
    flags.private = false
  }
  if (typeof record.archived === 'boolean') {
    flags.archived = record.archived
  }

  return flags
}

export function mapGithubRepositoryListItems(rawRepos: readonly unknown[]): GithubRepositoryListItem[] {
  const items: GithubRepositoryListItem[] = []
  for (const repo of rawRepos) {
    const fullName = extractRepositoryFullName(repo)
    if (!fullName) continue

    items.push({
      fullName: fullName.toLowerCase(),
      ...extractRepositoryFlags(repo),
    })
  }
  return items
}

export function extractGithubRepositoryArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []

  const record = data as Record<string, unknown>
  if (Array.isArray(record.items)) return record.items
  if (Array.isArray(record.repositories)) return record.repositories
  if (Array.isArray(record.details)) return record.details
  if (Array.isArray(record.data)) return record.data

  const nestedData = record.data && typeof record.data === 'object'
    ? record.data as Record<string, unknown>
    : null
  if (Array.isArray(nestedData?.items)) return nestedData.items
  if (Array.isArray(nestedData?.repositories)) return nestedData.repositories
  if (Array.isArray(nestedData?.details)) return nestedData.details
  return []
}

function getHeaderValue(headers: unknown, name: string): string | null {
  if (!headers) return null
  const lowerName = name.toLowerCase()
  const getter = (headers as { get?: unknown }).get
  if (typeof getter === 'function') {
    const value = (headers as { get(headerName: string): string | null }).get(name)
    return typeof value === 'string' && value.trim() ? value : null
  }
  if (Array.isArray(headers)) {
    for (const header of headers) {
      if (!Array.isArray(header) || header.length < 2) continue
      const [key, value] = header
      if (typeof key === 'string' && key.toLowerCase() === lowerName && typeof value === 'string') {
        return value
      }
    }
    return null
  }
  if (typeof headers !== 'object') return null

  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (key.toLowerCase() !== lowerName) continue
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').join(', ')
  }
  return null
}

export function parseNextCursorFromLinkHeader(linkHeader: string | null | undefined): string | null {
  if (!linkHeader?.trim()) return null

  for (const part of linkHeader.split(',')) {
    const [urlPart, ...parameterParts] = part.split(';')
    const hasNextRel = parameterParts.some((param) => /rel="?next"?/i.test(param.trim()))
    if (!hasNextRel) continue

    const urlMatch = urlPart?.match(/<([^>]+)>/)
    const rawUrl = urlMatch?.[1]?.trim()
    if (!rawUrl) continue

    try {
      const url = new URL(rawUrl, GITHUB_REPOSITORIES_ENDPOINT)
      const page = parsePositiveInteger(url.searchParams.get('page'))
      return page ? String(page) : null
    } catch {
      return null
    }
  }

  return null
}

export function computeNextGithubRepositoriesCursor({
  headers,
  itemCount,
  limit,
  page,
}: {
  headers: unknown
  itemCount: number
  limit: number
  page: number
}): string | null {
  const linkCursor = parseNextCursorFromLinkHeader(getHeaderValue(headers, 'link'))
  if (linkCursor) return linkCursor
  return itemCount === limit ? String(page + 1) : null
}

export function buildGithubRepositoryListResponse(
  proxyResponse: GithubRepositoriesProxyResponse,
  params: { limit: number; page: number },
): GithubRepositoryListResponse {
  const rawRepos = extractGithubRepositoryArray(proxyResponse.data)
  const items = mapGithubRepositoryListItems(rawRepos)
  return {
    items,
    nextCursor: computeNextGithubRepositoriesCursor({
      headers: proxyResponse.headers,
      itemCount: rawRepos.length,
      limit: params.limit,
      page: params.page,
    }),
  }
}

function getStatus(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const status = (value as Record<string, unknown>).status
  return typeof status === 'number' ? status : null
}

function errorText(value: unknown): string {
  if (value instanceof Error) return value.message
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

export function classifyGithubRepositoryProxyFailure(
  value: unknown,
): NonNullable<GithubRepositoryListResponse['error']> {
  const status = getStatus(value)
  const text = errorText(value).toLowerCase()

  if (status === 429 || text.includes('rate limit') || text.includes('rate_limit')) {
    return 'rate_limited'
  }
  if (
    status === 401 ||
    status === 403 ||
    text.includes('no active connection') ||
    text.includes('noactiveconnection')
  ) {
    return 'github_not_connected'
  }
  return 'fetch_failed'
}

/**
 * Success predicate for a `composio.tools.execute` response targeting
 * `GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER`.
 *
 * The SDK returns `{ data, successful, error, ... }` per ToolExecuteResponseSchema.
 * Treat a bare array as successful too (defensive — Composio occasionally returns
 * raw arrays for list tools).
 */
export function isGithubRepositoryToolSuccess(value: unknown): value is GithubRepositoriesProxyResponse {
  if (Array.isArray(value)) return true
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (record.successful === true) return true
  if (record.successful === false) return false
  // Backwards-compatible: if `successful` is absent, fall back to the
  // proxy-shaped check (2xx status, or status absent).
  const status = getStatus(value)
  return status === null || (status >= 200 && status < 300)
}
