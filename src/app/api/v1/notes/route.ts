import { NextRequest, NextResponse } from 'next/server'
import { getOverlayServerContext } from '@/server/bootstrap'
import { NoteService, NoteServiceError } from '@/server/notes'
import type { CreateNoteRequest, UpdateNoteRequest } from '@overlay/app-core'

const ctx = getOverlayServerContext()
const noteService = new NoteService(ctx)

function readBooleanParam(value: string | null): boolean | undefined {
  if (value == null) return undefined
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return undefined
}

async function readJsonBody<T>(request: NextRequest, fallback: T): Promise<T> {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return fallback

  try {
    return (await request.json()) as T
  } catch {
    return fallback
  }
}

async function requireSession(request: NextRequest) {
  const session = await ctx.auth.getSession(request)
  if (!session) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as const
  }
  return { session } as const
}

function toErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof NoteServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  console.error(`[Notes v1 API] ${fallbackMessage}:`, error)
  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession(request)
    if ('response' in auth) return auth.response

    const noteId = request.nextUrl.searchParams.get('noteId')
    if (noteId) {
      const note = await noteService.getNote({
        noteId,
        userId: auth.session.user.id,
      })
      if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(note)
    }

    const notes = await noteService.listNotes({
      userId: auth.session.user.id,
      projectId: request.nextUrl.searchParams.get('projectId') ?? undefined,
      includeDeleted: readBooleanParam(request.nextUrl.searchParams.get('includeDeleted')),
    })
    return NextResponse.json(notes)
  } catch (error) {
    return toErrorResponse(error, 'Failed to fetch notes')
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession(request)
    if ('response' in auth) return auth.response

    const body = await readJsonBody<CreateNoteRequest>(request, {})
    const result = await noteService.createNote({
      title: body.title,
      content: body.content,
      projectId: body.projectId,
      userId: auth.session.user.id,
    })
    return NextResponse.json(result)
  } catch (error) {
    return toErrorResponse(error, 'Failed to create note')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSession(request)
    if ('response' in auth) return auth.response

    const body = await readJsonBody<Partial<UpdateNoteRequest>>(request, {})
    const result = await noteService.updateNote({
      noteId: body.noteId ?? '',
      title: body.title,
      content: body.content,
      projectId: body.projectId,
      userId: auth.session.user.id,
    })
    return NextResponse.json(result)
  } catch (error) {
    return toErrorResponse(error, 'Failed to update note')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSession(request)
    if ('response' in auth) return auth.response

    const result = await noteService.deleteNote({
      noteId: request.nextUrl.searchParams.get('noteId'),
      userId: auth.session.user.id,
    })
    return NextResponse.json(result)
  } catch (error) {
    return toErrorResponse(error, 'Failed to delete note')
  }
}
