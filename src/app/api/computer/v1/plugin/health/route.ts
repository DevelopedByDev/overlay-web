import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getComputerServerSecret, requireComputerApiContext } from '@/lib/computer-api-route'

type PluginHealthBody = {
  status?: 'unknown' | 'installing' | 'installed' | 'missing' | 'error'
  installedVersion?: string
  message?: string
}

export async function POST(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = (await request.json()) as PluginHealthBody
    if (!body.status) {
      return NextResponse.json({ error: 'status required' }, { status: 400 })
    }

    const result = await convex.mutation('computers:reportOverlayPluginHealth', {
      computerId: auth.computerId,
      serverSecret: getComputerServerSecret(),
      status: body.status,
      installedVersion: body.installedVersion?.trim() || undefined,
      message: body.message?.trim() || undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to report plugin health'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
