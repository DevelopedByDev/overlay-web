import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import {
  connectAppIntegration,
  disconnectAppIntegration,
  listConnectedAppIntegrations,
  searchAppIntegrations,
} from '@/lib/app-api/integration-service'

// GET - list connected integrations, or search toolkits
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Search toolkits for the discovery dialog
    if (action === 'search') {
      return NextResponse.json(await searchAppIntegrations({
        userId: auth.userId,
        accessToken: auth.accessToken,
        query: searchParams.get('q') || '',
        cursor: searchParams.get('cursor') || '',
        limit: parseInt(searchParams.get('limit') || '12', 10),
      }))
    }

    return NextResponse.json(
      await listConnectedAppIntegrations(auth.userId, auth.accessToken),
    )
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

    if (action === 'disconnect') {
      return NextResponse.json(
        await disconnectAppIntegration({
          userId: auth.userId,
          accessToken: auth.accessToken,
          toolkit,
        }),
      )
    }

    const origin =
      request.headers.get('origin') ||
      (() => {
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
        const proto = request.headers.get('x-forwarded-proto') || 'https'
        return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || 'https://getoverlay.io')
      })()
    return NextResponse.json(
      await connectAppIntegration({
        userId: auth.userId,
        accessToken: auth.accessToken,
        toolkit,
        origin,
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process integration request'
    if (message === 'Composio not configured') {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    if (message.startsWith('Could not find auth config')) {
      return NextResponse.json({ error: message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Failed to process integration request' }, { status: 500 })
  }
}
