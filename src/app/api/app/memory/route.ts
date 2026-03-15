import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { addMemory, listMemories, removeMemory } from '@/lib/app-store'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const memories = await convex.query('memories:list', { userId: session.user.id })
    return NextResponse.json(memories || listMemories(session.user.id))
  } catch (error) {
    console.error('[Memory API] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { content, source } = await request.json()
    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

    const memoryId = await convex.mutation<string>('memories:add', {
      userId: session.user.id,
      content,
      source: source || 'manual',
    })
    return NextResponse.json({
      id: memoryId || addMemory(session.user.id, content, source || 'manual'),
    })
  } catch (error) {
    console.error('[Memory API] POST error:', error)
    return NextResponse.json({ error: 'Failed to add memory' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const memoryId = request.nextUrl.searchParams.get('memoryId')
    if (!memoryId) return NextResponse.json({ error: 'memoryId required' }, { status: 400 })

    await convex.mutation('memories:remove', { memoryId })
    removeMemory(memoryId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Memory API] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 })
  }
}
