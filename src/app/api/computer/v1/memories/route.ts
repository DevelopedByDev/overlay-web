import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getComputerServerSecret, requireComputerApiContext } from '@/lib/computer-api-route'

export async function GET(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  try {
    return NextResponse.json(
      (await convex.query('memories:list', {
        userId: auth.userId,
        serverSecret: getComputerServerSecret(),
      })) ?? [],
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch memories'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = (await request.json()) as { content?: string; source?: 'chat' | 'note' | 'manual' }
    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'content required' }, { status: 400 })
    }
    const source =
      body.source === 'chat' || body.source === 'note' || body.source === 'manual'
        ? body.source
        : 'manual'
    const id = await convex.mutation('memories:add', {
      userId: auth.userId,
      serverSecret: getComputerServerSecret(),
      content: body.content.trim(),
      source,
    })
    return NextResponse.json({ id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create memory'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = (await request.json()) as { memoryId?: string; content?: string }
    if (!body.memoryId || !body.content?.trim()) {
      return NextResponse.json({ error: 'memoryId and content required' }, { status: 400 })
    }
    await convex.mutation('memories:update', {
      userId: auth.userId,
      serverSecret: getComputerServerSecret(),
      memoryId: body.memoryId,
      content: body.content.trim(),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update memory'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  try {
    const memoryId = request.nextUrl.searchParams.get('memoryId')
    if (!memoryId) return NextResponse.json({ error: 'memoryId required' }, { status: 400 })
    await convex.mutation('memories:remove', {
      memoryId,
      userId: auth.userId,
      serverSecret: getComputerServerSecret(),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete memory'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

