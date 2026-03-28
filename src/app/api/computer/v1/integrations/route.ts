import { NextRequest, NextResponse } from 'next/server'
import { getServerProviderKey } from '@/lib/server-provider-keys'
import { requireComputerApiContext } from '@/lib/computer-api-route'

export async function GET(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  try {
    const apiKey = (await getServerProviderKey('composio')) ?? process.env.COMPOSIO_API_KEY ?? null
    if (!apiKey) {
      return NextResponse.json({ connected: [] })
    }

    const response = await fetch(
      `https://backend.composio.dev/api/v1/connectedAccounts?entityId=${encodeURIComponent(auth.userId)}&page=1&pageSize=100`,
      {
        headers: { 'x-api-key': apiKey },
      },
    )

    if (!response.ok) {
      return NextResponse.json({ connected: [] })
    }

    const data = await response.json() as {
      items?: Array<{
        id?: string
        appName?: string
        status?: string
      }>
    }

    const connected = (data.items ?? [])
      .filter((item) => item.appName)
      .map((item) => ({
        slug: item.appName!.toLowerCase(),
        connectedAccountId: item.id ?? null,
        status: item.status ?? null,
      }))

    return NextResponse.json({ connected })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch integrations'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
