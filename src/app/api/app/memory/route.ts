import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { addMemory, listMemories, removeMemory } from '@/lib/app-store'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { expandMemoriesForSidebarList } from '@/lib/memory-display-segments'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const fromConvex = await convex.query('memories:list', {
      userId: session.user.id,
      serverSecret,
    })
    const raw = Array.isArray(fromConvex) ? fromConvex : listMemories(session.user.id)
    return NextResponse.json(expandMemoriesForSidebarList(raw))
  } catch (error) {
    console.error('[Memory API] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      content?: string
      source?: string
      accessToken?: string
      userId?: string
    }

    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    if (!body.content) return NextResponse.json({ error: 'content required' }, { status: 400 })

    const raw = body.source ?? 'manual'
    const source =
      raw === 'chat' || raw === 'note' || raw === 'manual' ? raw : 'manual'

    const memoryId = await convex.mutation<string>('memories:add', {
      userId: auth.userId,
      serverSecret,
      content: body.content,
      source,
    })
    const id = memoryId || addMemory(auth.userId, body.content, source)

    return NextResponse.json({ id, ids: [id], count: 1 })
  } catch (error) {
    console.error('[Memory API] POST error:', error)
    return NextResponse.json({ error: 'Failed to add memory' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      memoryId?: string
      content?: string
      accessToken?: string
      userId?: string
    }

    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    if (!body.memoryId?.trim() || body.content === undefined || body.content === '') {
      return NextResponse.json({ error: 'memoryId and content required' }, { status: 400 })
    }

    await convex.mutation('memories:update', {
      userId: auth.userId,
      serverSecret,
      memoryId: body.memoryId.trim(),
      content: body.content,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Memory API] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update memory' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let body: { memoryId?: string; accessToken?: string; userId?: string } = {}
    try {
      body = (await request.json()) as typeof body
    } catch {
      // Browser sends query params only
    }

    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const memoryId = body.memoryId ?? request.nextUrl.searchParams.get('memoryId')
    if (!memoryId) return NextResponse.json({ error: 'memoryId required' }, { status: 400 })

    await convex.mutation('memories:remove', {
      memoryId,
      userId: auth.userId,
      serverSecret,
    })
    removeMemory(memoryId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Memory API] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 })
  }
}
