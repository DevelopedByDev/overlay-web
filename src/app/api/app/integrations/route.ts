import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import { getBaseUrl } from '@/server/web/app-url'
import {
  connectedAccountSlug,
  firstNonEmptyString,
  getComposioApiKey,
  listConnectedAccounts,
  loadComposioSDK,
  normalizeComposioSlug,
  requireProjectComposioEntity,
  type ComposioAppRecord,
} from '@/server/tools/composio-server'

type ComposioErrorKind = 'configuration' | 'provider'

const normalizeSlug = normalizeComposioSlug

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

type ToolkitGetResponse = {
  slug?: string
  name?: string
  meta?: {
    description?: string
    logo?: string
  } | null
}

// Composio's v1 `/api/v1/apps/<slug>` endpoint is being retired alongside the
// v1 `connectedAccounts` surface (see comment in listConnectedAccounts). Fetch
// toolkit metadata through the v3 SDK so connected toolkits surface reliably
// in callers like the @-mention picker.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAppRecord(composio: any, slug: string) {
  try {
    const result = (await composio.toolkits.get(slug)) as ToolkitGetResponse
    const resolvedSlug = normalizeSlug(firstNonEmptyString(result.slug, slug) ?? '')
    if (!resolvedSlug) return null
    return {
      slug: resolvedSlug,
      name: firstNonEmptyString(result.name) ?? fallbackDisplayName(resolvedSlug),
      description: firstNonEmptyString(result.meta?.description) ?? '',
      logoUrl: firstNonEmptyString(result.meta?.logo),
    }
  } catch {
    return null
  }
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
        const composio = await loadComposioSDK(apiKey)
        for (const acc of await listConnectedAccounts(composio, projectAccess.entityId)) {
          const slug = connectedAccountSlug(acc)
          if (slug && acc.id) connectedMap.set(normalizeSlug(slug), acc.id)
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

    const composio = await loadComposioSDK(apiKey)
    const accounts = await listConnectedAccounts(composio, projectAccess.entityId)
    // Diagnostic: distinguishes "Composio reports no connections" (eventual
    // consistency) from "Composio reports the connection but our normalization
    // drops it." Helps debug "Connect succeeded but UI didn't flip from Connect
    // to Disconnect" symptoms.
    console.log(
      `[Integrations] GET listed accounts for ${projectAccess.entityId.slice(-8)}:`,
      {
        rawCount: accounts.length,
        rawSlugs: accounts.map((item) => connectedAccountSlug(item) ?? '(missing)'),
      },
    )
    const connected: string[] = [
      ...new Set(accounts
        .map((item) => normalizeSlug(connectedAccountSlug(item) || ''))
        .filter(Boolean)),
    ]
    const items = (await Promise.all(connected.map((slug) => fetchAppRecord(composio, slug).catch(() => null))))
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

    // Diagnostic: capture what Composio's link API returns so we can tell why
    // a connect attempt produces no OAuth redirect. Logs the full shape because
    // util.inspect collapses nested fields otherwise.
    console.log(
      `[Integrations] connect link result for ${toolkitSlug}:`,
      JSON.stringify(
        {
          authConfigId,
          entityIdSuffix: projectAccess.entityId.slice(-8),
          id: connectionRequest.id,
          connectionId: connectionRequest.connectionId,
          status: connectionRequest.status,
          hasRedirectUrl: typeof connectionRequest.redirectUrl === 'string' && connectionRequest.redirectUrl.length > 0,
          redirectUrlSample: typeof connectionRequest.redirectUrl === 'string'
            ? `${connectionRequest.redirectUrl.slice(0, 80)}${connectionRequest.redirectUrl.length > 80 ? '…' : ''}`
            : connectionRequest.redirectUrl,
        },
        null,
        2,
      ),
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
  } catch (error) {
    console.error('[Integrations] Failed to process integration request:', error)
    return NextResponse.json({ error: 'Failed to process integration request' }, { status: 500 })
  }
}
