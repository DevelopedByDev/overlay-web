import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getComputerServerSecret, requireComputerApiContext } from '@/lib/computer-api-route'

export async function GET(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth
  const serverSecret = getComputerServerSecret()

  try {
    const noteId = request.nextUrl.searchParams.get('noteId')
    if (noteId) {
      const note = await convex.query('notes:get', {
        noteId,
        userId: auth.userId,
        serverSecret,
      })
      if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(note)
    }

    const projectId = request.nextUrl.searchParams.get('projectId')
    if (projectId !== null) {
      return NextResponse.json(
        (await convex.query('notes:listByProject', {
          projectId,
          userId: auth.userId,
          serverSecret,
        })) ?? [],
      )
    }

    return NextResponse.json(
      (await convex.query('notes:list', {
        userId: auth.userId,
        serverSecret,
      })) ?? [],
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch notes'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth
  const serverSecret = getComputerServerSecret()

  try {
    const body = (await request.json()) as {
      title?: string
      content?: string
      tags?: string[]
      projectId?: string
    }
    const id = await convex.mutation('notes:create', {
      userId: auth.userId,
      serverSecret,
      title: body.title || 'Untitled',
      content: body.content || '',
      tags: body.tags || [],
      projectId: body.projectId ?? undefined,
    })
    return NextResponse.json({ id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create note'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth
  const serverSecret = getComputerServerSecret()

  try {
    const body = (await request.json()) as {
      noteId?: string
      title?: string
      content?: string
      tags?: string[]
    }
    if (!body.noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })
    await convex.mutation('notes:update', {
      userId: auth.userId,
      serverSecret,
      noteId: body.noteId,
      title: body.title,
      content: body.content,
      tags: body.tags,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update note'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth
  const serverSecret = getComputerServerSecret()

  try {
    const noteId = request.nextUrl.searchParams.get('noteId')
    if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })
    await convex.mutation('notes:remove', {
      noteId,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete note'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

