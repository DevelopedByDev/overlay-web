import { logger } from '@/server/observability/logger'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { NextRequest, NextResponse } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { getServerProviderKey } from '@/server/ai/provider-keys'
import { getBaseUrl } from '@/server/web/app-url'

const COMPOSIO_API_BASE_URL = 'https://backend.composio.dev/api/v3'

type ComposioToolkitRecord = {
  slug?: string
  name?: string
  description?: string
  logo?: string
  logoUrl?: string
  meta?: {
    description?: string
    logo?: string
  }
}

type ComposioConnectedAccountRecord = {
  id?: string
  appName?: string
  status?: string
  toolkit?: {
    slug?: string
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadComposioSDK(apiKey: string): Promise<any> {
  let ComposioModule: { Composio: new (args: { apiKey: string }) => unknown }

  try {
    ComposioModule = await import('@composio/core')
  } catch (_error) {
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

function firstNonEmptyString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase()
}

function fallbackDisplayName(slug: string): string {
  return slug
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function mapToolkitRecord(toolkit: ComposioToolkitRecord) {
  const slug = normalizeSlug(firstNonEmptyString(toolkit.slug, toolkit.name) ?? '')
  const name = firstNonEmptyString(toolkit.name)
  return {
    slug,
    name: name ?? fallbackDisplayName(slug),
    description: firstNonEmptyString(toolkit.description, toolkit.meta?.description) ?? '',
    logoUrl: firstNonEmptyString(toolkit.logoUrl, toolkit.logo, toolkit.meta?.logo),
  }
}

async function fetchComposioJson<T>(apiKey: string, path: string): Promise<T | null> {
  const res = await fetch(`${COMPOSIO_API_BASE_URL}${path}`, {
    headers: { 'x-api-key': apiKey },
  })
  if (!res.ok) return null
  return await res.json() as T
}

async function fetchToolkitRecord(apiKey: string, slug: string) {
  const data = await fetchComposioJson<ComposioToolkitRecord>(
    apiKey,
    `/toolkits/${encodeURIComponent(slug)}`,
  )
  if (!data) return null
  const item = mapToolkitRecord(data)
  return item.slug ? item : null
}

async function fetchConnectedAccounts(apiKey: string, userId: string) {
  const url = new URL(`${COMPOSIO_API_BASE_URL}/connected_accounts`)
  url.searchParams.set('user_ids', userId)
  url.searchParams.set('limit', '100')

  const res = await fetch(url.toString(), { headers: { 'x-api-key': apiKey } })
  if (!res.ok) return []

  const data = await res.json() as { items?: ComposioConnectedAccountRecord[] }
  return Array.isArray(data.items) ? data.items : []
}

function getAllowedAppOrigins(): string[] {
  const configured = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.DEV_NEXT_PUBLIC_APP_URL,
    getBaseUrl(),
  ]

  const origins = new Set<string>()
  for (const value of configured) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    try {
      origins.add(new URL(trimmed).origin)
    } catch (_error) {
      continue
    }
  }

  if (process.env.NODE_ENV === 'development') {
    origins.add('http://localhost:3000')
    origins.add('http://127.0.0.1:3000')
  }

  return Array.from(origins)
}

function resolveComposioCallbackOrigin(request: NextRequest): string {
  const allowedOrigins = getAllowedAppOrigins()
  const requestOrigin = request.nextUrl.origin
  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin
  }

  const headerOrigin = request.headers.get('origin')?.trim()
  if (headerOrigin && allowedOrigins.includes(headerOrigin)) {
    return headerOrigin
  }

  return new URL(getBaseUrl()).origin
}

// GET - list connected integrations, or search toolkits
export async function GET(request: NextRequest, context: AppApiRouteContext) {
  try {
    const { auth } = context

    const apiKey = await getComposioApiKey(auth.accessToken)
    if (!apiKey) return NextResponse.json({ connected: [] })

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Search toolkits for the discovery dialog
    if (action === 'search') {
      const q = searchParams.get('q') || ''
      const cursor = searchParams.get('cursor') || ''
      const parsedLimit = Number.parseInt(searchParams.get('limit') || '20', 10)
      const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1), 100)

      const userId = auth.userId

      // Fetch connected accounts to annotate results
      const connectedData = { items: await fetchConnectedAccounts(apiKey, userId) }
      const connectedMap = new Map<string, string>()
      for (const acc of connectedData.items || []) {
        if (acc.status && acc.status !== 'ACTIVE') continue
        const slug = normalizeSlug(firstNonEmptyString(acc.toolkit?.slug, acc.appName) ?? '')
        if (slug && acc.id) connectedMap.set(slug, acc.id)
      }

      const url = new URL(`${COMPOSIO_API_BASE_URL}/toolkits`)
      if (q) url.searchParams.set('search', q)
      if (cursor) url.searchParams.set('cursor', cursor)
      url.searchParams.set('limit', String(limit))

      const res = await fetch(url.toString(), { headers: { 'x-api-key': apiKey } })
      if (!res.ok) return NextResponse.json({ data: [], items: [], hasMore: false, nextCursor: null })
      const data = await res.json()

      // items may be under data.items or data directly as an array
      const rawItems: ComposioToolkitRecord[] =
        Array.isArray(data) ? data : (data.items || [])

      let items = rawItems.map((toolkit) => {
        const mapped = mapToolkitRecord(toolkit)
        const slug = mapped.slug
        const connectedId = connectedMap.get(slug) ?? null
        return {
          slug,
          name: mapped.name,
          description: mapped.description,
          logoUrl: mapped.logoUrl,
          isConnected: connectedId !== null,
          connectedAccountId: connectedId,
        }
      }).filter((item) => item.slug)

      // Client-side filter as fallback if server doesn't filter
      if (q) {
        const lq = q.toLowerCase()
        items = items.filter(
          (item) =>
            item.slug.includes(lq) ||
            item.name.toLowerCase().includes(lq) ||
            item.description.toLowerCase().includes(lq)
        )
      }

      const nextCursor = firstNonEmptyString(data.nextCursor, data.next_cursor)
      return NextResponse.json({
        data: items,
        items,
        nextCursor,
        hasMore: nextCursor !== null,
      })
    }

    // Default: return connected integration slugs (scoped to this user's entity)
    const userId = auth.userId
    const connectedAccounts = await fetchConnectedAccounts(apiKey, userId)
    const connected: string[] = [
      ...new Set(connectedAccounts
        .filter((item) => !item.status || item.status === 'ACTIVE')
        .map((item) => normalizeSlug(firstNonEmptyString(item.toolkit?.slug, item.appName) ?? ''))
        .filter(Boolean)),
    ]
    const items = (await Promise.all(connected.map((slug) => fetchToolkitRecord(apiKey, slug).catch((_error) => null))))
      .filter((item): item is NonNullable<Awaited<ReturnType<typeof fetchToolkitRecord>>> => item !== null)
      .map((item) => ({
        slug: item.slug,
        name: item.name,
        description: item.description,
        logoUrl: item.logoUrl,
      }))

    return NextResponse.json({ connected, data: items, items, hasMore: false })
  } catch (_error) {
    return NextResponse.json({ connected: [] })
  }
}

// POST - initiate connection (returns redirect URL) or disconnect
export async function POST(request: NextRequest, context: AppApiRouteContext) {
  try {
    const body = await request.json()
    const { auth } = context

    const { action, toolkit } = body as { action?: string; toolkit?: string }
    if (!toolkit) return NextResponse.json({ error: 'toolkit required' }, { status: 400 })

    const apiKey = await getComposioApiKey(auth.accessToken)
    if (!apiKey) return NextResponse.json({ error: 'Composio not configured' }, { status: 503 })

    const userId = auth.userId

    const composio = await loadComposioSDK(apiKey)

    if (action === 'disconnect') {
      // Find all connected accounts for this user+toolkit and delete them all
      const accounts = await composio.connectedAccounts.list({
        userIds: [userId],
        toolkitSlugs: [toolkit],
      })
      const deleteRequests: Array<Promise<unknown>> = []
      for (const acc of accounts.items ?? []) {
        if (acc && typeof acc === 'object' && 'id' in acc && typeof acc.id === 'string') {
          deleteRequests.push(composio.connectedAccounts.delete(acc.id))
        }
      }
      await Promise.all(deleteRequests)
      return NextResponse.json({ success: true })
    }

    // action === 'connect' — get OAuth redirect URL via Composio SDK
    // Derive origin from the request so the callback works on any domain (www, non-www, localhost)
    const origin = resolveComposioCallbackOrigin(request)
    const callbackUrl = `${origin}/auth/composio/callback`

    // Get an auth config for this toolkit; create a Composio-managed one if none exists
    let authConfigId: string
    try {
      const authConfigs = await composio.authConfigs.list({ toolkit })
      const firstConfig = (authConfigs.items ?? authConfigs)?.[0]
      if (firstConfig?.id) {
        authConfigId = firstConfig.id
      } else {
        // Auto-create a Composio-managed auth config for this toolkit
        const created = await composio.authConfigs.create(toolkit, {
          type: 'use_composio_managed_auth',
        })
        authConfigId = created.id
      }
    } catch (err) {
      logger.error('[Integrations] Failed to get/create auth config:', err)
      return NextResponse.json({ error: `Could not find auth config for ${toolkit}` }, { status: 500 })
    }

    const connectionRequest = await composio.connectedAccounts.link(
      userId,
      authConfigId,
      { callbackUrl }
    )

    const redirectUrl =
      typeof connectionRequest.redirectUrl === 'string' &&
      connectionRequest.redirectUrl.startsWith('http')
        ? connectionRequest.redirectUrl
        : null

    return NextResponse.json({
      redirectUrl,
      connectionId: connectionRequest.id ?? connectionRequest.connectionId ?? null,
      status: connectionRequest.status ?? null,
    })
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to process integration request' }, { status: 500 })
  }
}
