import { NextRequest, NextResponse } from 'next/server'
import { createComputerControlClient } from '@/lib/computer-control-client'
import { getComputerServerSecret, requireComputerApiContext } from '@/lib/computer-api-route'

export async function GET(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  const client = createComputerControlClient({
    userId: auth.userId,
    serverSecret: getComputerServerSecret(),
  })

  try {
    const name = request.nextUrl.searchParams.get('name')?.trim()
    if (name) {
      return NextResponse.json(await client.readWorkspaceFile({ computerId: auth.computerId, name }))
    }
    return NextResponse.json(await client.listWorkspaceFiles(auth.computerId))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch workspace files'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  const client = createComputerControlClient({
    userId: auth.userId,
    serverSecret: getComputerServerSecret(),
  })

  try {
    const body = (await request.json()) as { name?: string; content?: string }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }

    return NextResponse.json(await client.writeWorkspaceFile({
      computerId: auth.computerId,
      name: body.name.trim(),
      content: body.content ?? '',
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to write workspace file'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

