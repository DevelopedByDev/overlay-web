import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { createNote, deleteNote, listNotes, updateNote } from '@/lib/app-store'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const notes = await convex.query('notes:list', { userId: session.user.id })
    return NextResponse.json(notes || listNotes(session.user.id))
  } catch (error) {
    console.error('[Notes API] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { title, content, tags } = await request.json()
    const noteId = await convex.mutation<string>('notes:create', {
      userId: session.user.id,
      title: title || 'Untitled',
      content: content || '',
      tags: tags || [],
    })
    return NextResponse.json({
      id: noteId || createNote(session.user.id, title || 'Untitled', content || '', tags || []),
    })
  } catch (error) {
    console.error('[Notes API] POST error:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { noteId, title, content, tags } = await request.json()
    if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

    const updated = await convex.mutation('notes:update', { noteId, title, content, tags })
    if (!updated) {
      updateNote(noteId, { title, content, tags })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Notes API] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const noteId = searchParams.get('noteId')
    if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

    const removed = await convex.mutation('notes:remove', { noteId })
    if (!removed) {
      deleteNote(noteId)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Notes API] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
