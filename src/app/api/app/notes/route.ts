import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { convex } from '@/lib/convex'

type NoteDoc = {
  _id: string
  userId: string
  clientId?: string
  title: string
  icon?: string
  coverImage?: string
  coverPosition?: number
  content: string
  tags: string[]
  projectId?: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

function readBooleanParam(value: string | null): boolean | undefined {
  if (value == null) return undefined
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return undefined
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const updatedSinceParam = request.nextUrl.searchParams.get('updatedSince')
    const updatedSince = updatedSinceParam ? Number(updatedSinceParam) : undefined
    const includeDeleted = readBooleanParam(request.nextUrl.searchParams.get('includeDeleted'))

    const noteId = request.nextUrl.searchParams.get('noteId')
    if (noteId) {
      const note = await convex.query<NoteDoc | null>('notes:get', {
        noteId,
        userId: auth.userId,
        serverSecret,
      })
      if (!note || note.userId !== auth.userId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json(note)
    }

    const projectId = request.nextUrl.searchParams.get('projectId')
    if (projectId !== null) {
      const notes = await convex.query('notes:listByProject', {
        projectId,
        userId: auth.userId,
        serverSecret,
        ...(Number.isFinite(updatedSince) ? { updatedSince } : {}),
        ...(includeDeleted !== undefined ? { includeDeleted } : {}),
      })
      return NextResponse.json(notes || [])
    }

    const includeProjects = request.nextUrl.searchParams.get('scope') === 'all'
    if (includeProjects) {
      const notes = await convex.query('notes:listAll', {
        userId: auth.userId,
        serverSecret,
        ...(Number.isFinite(updatedSince) ? { updatedSince } : {}),
        ...(includeDeleted !== undefined ? { includeDeleted } : {}),
      })
      return NextResponse.json(notes || [])
    }

    const notes = await convex.query('notes:list', {
      userId: auth.userId,
      serverSecret,
      ...(Number.isFinite(updatedSince) ? { updatedSince } : {}),
      ...(includeDeleted !== undefined ? { includeDeleted } : {}),
    })
    return NextResponse.json(notes || [])
  } catch (error) {
    console.error('[Notes API] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title?: string
      content?: string
      tags?: string[]
      projectId?: string
      icon?: string
      coverImage?: string
      coverPosition?: number
      clientId?: string
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const noteId = await convex.mutation<string>('notes:create', {
      userId: auth.userId,
      serverSecret,
      clientId: body.clientId?.trim() || undefined,
      title: body.title || 'Untitled',
      content: body.content || '',
      tags: body.tags || [],
      projectId: body.projectId ?? undefined,
      icon: body.icon,
      coverImage: body.coverImage,
      coverPosition: body.coverPosition,
    })
    const note = await convex.query<NoteDoc | null>('notes:get', {
      noteId,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ id: noteId, note })
  } catch (error) {
    console.error('[Notes API] POST error:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      noteId?: string
      title?: string
      content?: string
      tags?: string[]
      projectId?: string
      icon?: string
      coverImage?: string
      coverPosition?: number
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    if (!body.noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

    const existing = await convex.query<NoteDoc | null>('notes:get', {
      noteId: body.noteId,
      userId: auth.userId,
      serverSecret,
    })
    if (!existing || existing.userId !== auth.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await convex.mutation('notes:update', {
      userId: auth.userId,
      serverSecret,
      noteId: body.noteId,
      title: body.title,
      content: body.content,
      tags: body.tags,
      projectId: body.projectId,
      icon: body.icon,
      coverImage: body.coverImage,
      coverPosition: body.coverPosition,
    })
    const note = await convex.query<NoteDoc | null>('notes:get', {
      noteId: body.noteId,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ success: true, note })
  } catch (error) {
    console.error('[Notes API] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let body: { accessToken?: string; userId?: string } = {}
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        body = await request.json()
      } catch {
        body = {}
      }
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const noteId = request.nextUrl.searchParams.get('noteId')
    if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

    const existing = await convex.query<NoteDoc | null>('notes:get', {
      noteId,
      userId: auth.userId,
      serverSecret,
    })
    if (!existing || existing.userId !== auth.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await convex.mutation('notes:remove', {
      noteId,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ success: true, noteId, deletedAt: Date.now() })
  } catch (error) {
    console.error('[Notes API] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
