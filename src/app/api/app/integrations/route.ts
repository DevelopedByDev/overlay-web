import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { NextRequest, NextResponse } from 'next/server'
import { getServerProviderKey } from '@/lib/server-provider-keys'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'

type ComposioAppRecord = {
  key?: string
  slug?: string
  name?: string
  displayName?: string
  display_name?: string
  appName?: string
  app_name?: string
  description?: string
  logo?: string
  logoUrl?: string
}

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

function mapAppRecord(app: ComposioAppRecord) {
  const slug = normalizeSlug(firstNonEmptyString(app.key, app.slug, app.appName, app.app_name, app.name) ?? '')
  const name = firstNonEmptyString(app.displayName, app.display_name, app.name, app.appName, app.app_name)
  return {
    slug,
    name: name ?? fallbackDisplayName(slug),
    description: firstNonEmptyString(app.description) ?? '',
    logoUrl: firstNonEmptyString(app.logoUrl, app.logo),
  }
}

async function fetchAppRecord(apiKey: string, slug: string) {
  const res = await fetch(`https://backend.composio.dev/api/v1/apps/${encodeURIComponent(slug)}`, {
    headers: { 'x-api-key': apiKey },
  })
  if (!res.ok) return null
  const data = await res.json() as ComposioAppRecord
  const item = mapAppRecord(data)
  return item.slug ? item : null
}

// GET - list connected integrations, or search toolkits
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = await getComposioApiKey(auth.accessToken)
    if (!apiKey) return NextResponse.json({ connected: [] })

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Search toolkits for the discovery dialog
    if (action === 'search') {
      const q = searchParams.get('q') || ''
      const cursor = searchParams.get('cursor') || ''
      const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50)

      const userId = auth.userId

    // Fetch connected accounts to annotate results
      const connectedRes = await fetch(
        `https://backend.composio.dev/api/v1/connectedAccounts?entityId=${encodeURIComponent(userId)}&page=1&pageSize=100`,
        { headers: { 'x-api-key': apiKey } }
      )
      const connectedData = connectedRes.ok ? await connectedRes.json() : { items: [] }
      const connectedMap = new Map<string, string>()
      for (const acc of connectedData.items || []) {
        if (acc.appName) connectedMap.set(acc.appName.toLowerCase(), acc.id)
      }

      const url = new URL('https://backend.composio.dev/api/v1/apps')
      // Composio apps endpoint uses 'query' for search
      if (q) url.searchParams.set('query', q)
      if (cursor) url.searchParams.set('cursor', cursor)
      url.searchParams.set('limit', String(limit))

      const res = await fetch(url.toString(), { headers: { 'x-api-key': apiKey } })
      if (!res.ok) return NextResponse.json({ items: [], nextCursor: null })
      const data = await res.json()

      // items may be under data.items or data directly as an array
      const rawItems: ComposioAppRecord[] =
        Array.isArray(data) ? data : (data.items || [])

      let items = rawItems.map((app) => {
        const mapped = mapAppRecord(app)
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

      return NextResponse.json({ items, nextCursor: data.nextCursor ?? null })
    }

    // Default: return connected integration slugs (scoped to this user's entity)
    const userId = auth.userId
    const res = await fetch(
      `https://backend.composio.dev/api/v1/connectedAccounts?entityId=${encodeURIComponent(userId)}&page=1&pageSize=100`,
      { headers: { 'x-api-key': apiKey } }
    )

    if (!res.ok) return NextResponse.json({ connected: [] })
    const data = await res.json() as { items?: Array<{ appName?: string }> }
    const connected: string[] = [
      ...new Set(((data.items ?? []) as Array<{ appName?: string }>)
        .map((item) => normalizeSlug(item.appName || ''))
        .filter(Boolean)),
    ]
    const items = (await Promise.all(connected.map((slug) => fetchAppRecord(apiKey, slug).catch(() => null))))
      .filter((item): item is NonNullable<Awaited<ReturnType<typeof fetchAppRecord>>> => item !== null)
      .map((item) => ({
        slug: item.slug,
        name: item.name,
        description: item.description,
        logoUrl: item.logoUrl,
      }))

    return NextResponse.json({ connected, items })
  } catch {
    return NextResponse.json({ connected: [] })
  }
}

// POST - initiate connection (returns redirect URL) or disconnect
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    const origin =
      request.headers.get('origin') ||
      (() => {
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
        const proto = request.headers.get('x-forwarded-proto') || 'https'
        return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || 'https://getoverlay.io')
      })()
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
      console.error('[Integrations] Failed to get/create auth config:', err)
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
  } catch {
    return NextResponse.json({ error: 'Failed to process integration request' }, { status: 500 })
  }
}
