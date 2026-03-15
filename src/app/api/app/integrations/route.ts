import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'

interface APIKeyResponse {
  key: string | null
}

async function getComposioApiKey(accessToken: string): Promise<string | null> {
  try {
    const result = await convex.action<APIKeyResponse>('keys:getAPIKey', {
      provider: 'composio',
      accessToken,
    })
    return result?.key ?? process.env.COMPOSIO_API_KEY ?? null
  } catch {
    return process.env.COMPOSIO_API_KEY ?? null
  }
}

// GET - list connected integrations, or search toolkits
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = await getComposioApiKey(session.accessToken)
    if (!apiKey) return NextResponse.json({ connected: [] })

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Search toolkits for the discovery dialog
    if (action === 'search') {
      const q = searchParams.get('q') || ''
      const cursor = searchParams.get('cursor') || ''
      const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50)

      // Fetch connected accounts to annotate results
      const connectedRes = await fetch(
        'https://backend.composio.dev/api/v1/connectedAccounts?page=1&pageSize=100',
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
      const rawItems: Array<{ key?: string; name?: string; description?: string; logo?: string }> =
        Array.isArray(data) ? data : (data.items || [])

      let items = rawItems.map((app) => {
        const slug = (app.key || '').toLowerCase()
        const connectedId = connectedMap.get(slug) ?? null
        return {
          slug,
          name: app.name || slug,
          description: app.description || '',
          logoUrl: app.logo || null,
          isConnected: connectedId !== null,
          connectedAccountId: connectedId,
        }
      })

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

    // Default: return connected integration slugs
    const res = await fetch('https://backend.composio.dev/api/v1/connectedAccounts?page=1&pageSize=100', {
      headers: { 'x-api-key': apiKey },
    })

    if (!res.ok) return NextResponse.json({ connected: [] })
    const data = await res.json()
    const connected: string[] = (data.items || []).map(
      (item: { appName: string }) => item.appName?.toLowerCase()
    ).filter(Boolean)

    return NextResponse.json({ connected: [...new Set(connected)] })
  } catch {
    return NextResponse.json({ connected: [] })
  }
}

// POST - initiate connection (returns redirect URL) or disconnect
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, toolkit } = await request.json()
    if (!toolkit) return NextResponse.json({ error: 'toolkit required' }, { status: 400 })

    const apiKey = await getComposioApiKey(session.accessToken)
    if (!apiKey) return NextResponse.json({ error: 'Composio not configured' }, { status: 503 })

    if (action === 'disconnect') {
      // Find connected account and delete it
      const listRes = await fetch(
        `https://backend.composio.dev/api/v1/connectedAccounts?appName=${toolkit}&page=1&pageSize=10`,
        { headers: { 'x-api-key': apiKey } }
      )
      if (listRes.ok) {
        const listData = await listRes.json()
        const account = listData.items?.[0]
        if (account?.id) {
          await fetch(`https://backend.composio.dev/api/v1/connectedAccounts/${account.id}`, {
            method: 'DELETE',
            headers: { 'x-api-key': apiKey },
          })
        }
      }
      return NextResponse.json({ success: true })
    }

    // action === 'connect' — get OAuth redirect URL
    const res = await fetch('https://backend.composio.dev/api/v1/connectedAccounts', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appName: toolkit,
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'https://getoverlay.io'}/app/integrations`,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: err.message || 'Failed to initiate connection' }, { status: res.status })
    }

    const data = await res.json()
    // Only return redirectUrl if it's an actual URL, not a connection ID
    const redirectUrl = typeof data.redirectUrl === 'string' && data.redirectUrl.startsWith('http')
      ? data.redirectUrl
      : null
    return NextResponse.json({
      redirectUrl,
      connectionId: data.connectionId || data.id || null,
      status: data.status || null,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to process integration request' }, { status: 500 })
  }
}
