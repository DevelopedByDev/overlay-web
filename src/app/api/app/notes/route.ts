import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { convex } from '@/lib/convex'
import { hashTextContent } from '@/lib/convex-file-content'

type CanonicalFile = {
  _id: string
  userId: string
  name: string
  kind?: string
  content?: string
  textContent?: string
  projectId?: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
  legacyNoteId?: string
}

function asNote(file: CanonicalFile) {
  return {
    _id: file._id,
    userId: file.userId,
    title: file.name || 'Untitled',
    content: file.textContent ?? file.content ?? '',
    tags: [],
    projectId: file.projectId,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    deletedAt: file.deletedAt,
    legacyNoteId: file.legacyNoteId,
  }
}

function readBooleanParam(value: string | null): boolean | undefined {
  if (value == null) return undefined
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return undefined
}

async function getCanonicalNote(args: {
  noteId: string
  userId: string
  serverSecret: string
}): Promise<CanonicalFile | null> {
  const direct = await convex.query<CanonicalFile | null>('files:get', {
    fileId: args.noteId,
    userId: args.userId,
    serverSecret: args.serverSecret,
  }).catch(() => null)
  if (direct?.kind === 'note') return direct

  const migrated = await convex.query<CanonicalFile | null>('files:getByLegacyNoteId', {
    noteId: args.noteId,
    userId: args.userId,
    serverSecret: args.serverSecret,
  }).catch(() => null)
  return migrated?.kind === 'note' ? migrated : null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const includeDeleted = readBooleanParam(request.nextUrl.searchParams.get('includeDeleted'))

    const noteId = request.nextUrl.searchParams.get('noteId')
    if (noteId) {
      const note = await getCanonicalNote({ noteId, userId: auth.userId, serverSecret })
      if (!note || note.userId !== auth.userId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json(asNote(note))
    }

    const projectId = request.nextUrl.searchParams.get('projectId')
    const files = await convex.query<CanonicalFile[]>('files:list', {
      userId: auth.userId,
      serverSecret,
      kind: 'note',
      ...(projectId !== null ? { projectId } : {}),
      ...(includeDeleted !== undefined ? { includeDeleted } : {}),
    })
    return NextResponse.json((files ?? []).map(asNote))
  } catch (error) {
    console.error('[Notes API] GET compatibility error:', error)
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
      clientId?: string
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const content = body.content || ''

    const fileId = await convex.mutation<string>('files:create', {
      userId: auth.userId,
      serverSecret,
      name: body.title || 'Untitled',
      kind: 'note',
      type: 'file',
      content,
      contentHash: content ? hashTextContent(content) : undefined,
      projectId: body.projectId ?? undefined,
    })
    const file = await convex.query<CanonicalFile | null>('files:get', {
      fileId,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ id: fileId, note: file ? asNote(file) : null })
  } catch (error) {
    console.error('[Notes API] POST compatibility error:', error)
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
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    if (!body.noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })
    const existing = await getCanonicalNote({ noteId: body.noteId, userId: auth.userId, serverSecret })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const content = body.content

    await convex.mutation('files:update', {
      userId: auth.userId,
      serverSecret,
      fileId: existing._id,
      name: body.title,
      ...(content !== undefined
        ? { content, contentHash: hashTextContent(content) }
        : {}),
      projectId: body.projectId,
    })
    const file = await convex.query<CanonicalFile | null>('files:get', {
      fileId: existing._id,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ success: true, note: file ? asNote(file) : null })
  } catch (error) {
    console.error('[Notes API] PATCH compatibility error:', error)
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
    const existing = await getCanonicalNote({ noteId, userId: auth.userId, serverSecret })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await convex.mutation('files:remove', {
      fileId: existing._id,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ success: true, noteId: existing._id, deletedAt: Date.now() })
  } catch (error) {
    console.error('[Notes API] DELETE compatibility error:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
