import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import { convex } from '@/server/database/convex'
import { getServerProviderKey } from '@/server/ai/provider-keys'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import { projectComposioEntityId } from '@/server/tools/composio-entity'
import { getBaseUrl } from '@/server/web/app-url'
import type { Id } from '../../../../../convex/_generated/dataModel'

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

type ConnectedAccountRecord = {
  id?: string
  appName?: string
}

type ComposioErrorKind = 'configuration' | 'provider'

type ProjectAccessResult =
  | { ok: true; entityId: string }
  | { ok: false; response: NextResponse }

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

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return ''
  }
}

function sanitizedErrorMessage(error: unknown): string {
  return errorMessage(error).replace(/\bak_[A-Za-z0-9_-]+\b/g, '[REDACTED]')
}

function classifyComposioError(error: unknown): ComposioErrorKind {
  const message = errorMessage(error)
  if (
    /\b401\b/.test(message) ||
    /invalid api key/i.test(message) ||
    /http_unauthorized/i.test(message)
  ) {
    return 'configuration'
  }
  return 'provider'
}

function composioFailureResponse(error: unknown, context: string): NextResponse {
  const kind = classifyComposioError(error)
  console.error(`[Integrations] Composio ${context} failed: ${sanitizedErrorMessage(error)}`)
  if (kind === 'configuration') {
    return integrationConnectionErrorResponse(
      'Composio API key is invalid or expired. Update COMPOSIO_API_KEY to connect integrations.',
    )
  }
  return integrationConnectionErrorResponse('Composio is temporarily unavailable. Try again in a moment.')
}

function integrationConnectionErrorResponse(error: string): NextResponse {
  return NextResponse.json({ success: false, error })
}

async function requireProjectComposioEntity(
  projectId: string | null | undefined,
  userId: string,
): Promise<ProjectAccessResult> {
  const trimmedProjectId = projectId?.trim()
  if (!trimmedProjectId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'projectId required' }, { status: 400 }),
    }
  }

  try {
    const project = await convex.query<{ _id: string } | null>('projects/projects:get', {
      projectId: trimmedProjectId as Id<'projects'>,
      userId,
      serverSecret: getInternalApiSecret(),
    })
    if (!project) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
      }
    }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
    }
  }

  return {
    ok: true,
    entityId: projectComposioEntityId(userId, trimmedProjectId),
  }
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

async function listConnectedAccounts(apiKey: string, entityId: string): Promise<ConnectedAccountRecord[]> {
  const res = await fetch(
    `https://backend.composio.dev/api/v1/connectedAccounts?entityId=${encodeURIComponent(entityId)}&page=1&pageSize=100`,
    { headers: { 'x-api-key': apiKey } },
  )
  if (!res.ok) return []
  const data = await res.json() as { items?: ConnectedAccountRecord[] }
  return data.items ?? []
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
    } catch {
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
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = await getComposioApiKey(auth.accessToken)
    if (!apiKey) return NextResponse.json({ connected: [] })

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const projectId = searchParams.get('projectId')

    // Search toolkits for the discovery dialog
    if (action === 'search') {
      const q = searchParams.get('q') || ''
      const cursor = searchParams.get('cursor') || ''
      const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50)

      const connectedMap = new Map<string, string>()
      if (projectId) {
        const projectAccess = await requireProjectComposioEntity(projectId, auth.userId)
        if (!projectAccess.ok) return projectAccess.response
        for (const acc of await listConnectedAccounts(apiKey, projectAccess.entityId)) {
          if (acc.appName && acc.id) connectedMap.set(normalizeSlug(acc.appName), acc.id)
        }
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

    // Default: return connected integration slugs scoped to this project entity.
    const projectAccess = await requireProjectComposioEntity(projectId, auth.userId)
    if (!projectAccess.ok) return projectAccess.response

    const accounts = await listConnectedAccounts(apiKey, projectAccess.entityId)
    const connected: string[] = [
      ...new Set(accounts
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
    let body: { accessToken?: string; userId?: string; action?: string; toolkit?: string; projectId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, toolkit, projectId } = body
    const toolkitSlug = normalizeSlug(toolkit ?? '')
    if (!toolkitSlug) return NextResponse.json({ error: 'toolkit required' }, { status: 400 })

    const projectAccess = await requireProjectComposioEntity(projectId, auth.userId)
    if (!projectAccess.ok) return projectAccess.response

    const apiKey = await getComposioApiKey(auth.accessToken)
    if (!apiKey) return integrationConnectionErrorResponse('Composio is not configured.')

    const composio = await loadComposioSDK(apiKey)

    if (action === 'disconnect') {
      // Find all connected accounts for this project entity + toolkit and delete them all.
      try {
        const accounts = await composio.connectedAccounts.list({
          userIds: [projectAccess.entityId],
          toolkitSlugs: [toolkitSlug],
        })
        const deleteRequests: Array<Promise<unknown>> = []
        for (const acc of accounts.items ?? []) {
          if (acc && typeof acc === 'object' && 'id' in acc && typeof acc.id === 'string') {
            deleteRequests.push(composio.connectedAccounts.delete(acc.id))
          }
        }
        await Promise.all(deleteRequests)
        return NextResponse.json({ success: true })
      } catch (error) {
        return composioFailureResponse(error, `disconnect ${toolkitSlug}`)
      }
    }

    // action === 'connect' — get OAuth redirect URL via Composio SDK
    // Derive origin from the request so the callback works on any domain (www, non-www, localhost)
    const origin = resolveComposioCallbackOrigin(request)
    const callbackUrl = `${origin}/auth/composio/callback`

    // Get an auth config for this toolkit; create a Composio-managed one if none exists
    let authConfigId: string
    try {
      const authConfigs = await composio.authConfigs.list({ toolkit: toolkitSlug })
      const firstConfig = (authConfigs.items ?? authConfigs)?.[0]
      if (firstConfig?.id) {
        authConfigId = firstConfig.id
      } else {
        // Auto-create a Composio-managed auth config for this toolkit
        const created = await composio.authConfigs.create(toolkitSlug, {
          type: 'use_composio_managed_auth',
        })
        authConfigId = created.id
      }
    } catch (err) {
      return composioFailureResponse(err, `auth config lookup for ${toolkitSlug}`)
    }

    let connectionRequest: {
      id?: string | null
      connectionId?: string | null
      redirectUrl?: string | null
      status?: string | null
    }
    try {
      connectionRequest = await composio.connectedAccounts.link(
        projectAccess.entityId,
        authConfigId,
        { callbackUrl }
      )
    } catch (error) {
      return composioFailureResponse(error, `connect link for ${toolkitSlug}`)
    }

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
  } catch (error) {
    console.error('[Integrations] Failed to process integration request:', error)
    return NextResponse.json({ error: 'Failed to process integration request' }, { status: 500 })
  }
}
