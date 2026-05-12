import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { convex } from '@/lib/convex'
import { addMemory, listMemories, removeMemory } from '@/lib/app-store'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { memoriesToClientListRows, segmentMemoryForIngestion } from '@/lib/memory-display-segments'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'
import { z } from '@/lib/api-schemas'

const AppMemoryRequestSchema = z.object({
  memoryId: z.string().optional(),
  content: z.string().optional(),
  source: z.enum(['chat', 'note', 'manual']).optional(),
  clientId: z.string().optional(),
  type: z.enum(['preference', 'fact', 'project', 'decision', 'agent']).optional(),
  importance: z.number().optional(),
  projectId: z.string().optional(),
  conversationId: z.string().optional(),
  noteId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  actor: z.enum(['user', 'agent']).optional(),
  accessToken: z.string().optional(),
  userId: z.string().optional(),
}).passthrough().openapi('AppMemoryRequest')
const AppMemoryResponseSchema = z.unknown().openapi('AppMemoryResponse')
void AppMemoryRequestSchema
void AppMemoryResponseSchema


type MemoryDoc = {
  _id: string
  userId: string
  clientId?: string
  content: string
  source: 'chat' | 'note' | 'manual'
  type?: 'preference' | 'fact' | 'project' | 'decision' | 'agent'
  importance?: number
  projectId?: string
  conversationId?: string
  noteId?: string
  messageId?: string
  turnId?: string
  tags?: string[]
  actor?: 'user' | 'agent'
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

const MAX_MEMORY_CONTENT_CHARS = 20_000
const MAX_MEMORY_CHUNKS = 20

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
    const memoryId = request.nextUrl.searchParams.get('memoryId')
    const raw = readBooleanParam(request.nextUrl.searchParams.get('raw')) === true
    const updatedSinceParam = request.nextUrl.searchParams.get('updatedSince')
    const updatedSince = updatedSinceParam ? Number(updatedSinceParam) : undefined
    const includeDeleted = readBooleanParam(request.nextUrl.searchParams.get('includeDeleted'))
    const projectId = request.nextUrl.searchParams.get('projectId') ?? undefined
    const conversationId = request.nextUrl.searchParams.get('conversationId') ?? undefined
    const noteId = request.nextUrl.searchParams.get('noteId') ?? undefined

    if (memoryId) {
      const memory = await convex.query<MemoryDoc[]>('memories:list', {
        userId: auth.userId,
        serverSecret,
        includeDeleted: true,
      })
      const match = (memory || []).find((item) => item._id === memoryId)
      if (!match || (!raw && match.deletedAt)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json(match)
    }

    const fromConvex = await convex.query<MemoryDoc[]>('memories:list', {
      userId: auth.userId,
      serverSecret,
      ...(Number.isFinite(updatedSince) ? { updatedSince } : {}),
      ...(includeDeleted !== undefined ? { includeDeleted } : {}),
      ...(projectId ? { projectId } : {}),
      ...(conversationId ? { conversationId } : {}),
      ...(noteId ? { noteId } : {}),
    })
    const fallback = listMemories(auth.userId).map((memory) => ({
      _id: memory._id,
      userId: auth.userId,
      content: memory.content,
      source: memory.source,
      createdAt: memory.createdAt,
      updatedAt: memory.createdAt,
    }))
    const rows = Array.isArray(fromConvex) ? fromConvex : fallback
    return NextResponse.json(raw ? rows : memoriesToClientListRows(rows))
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
      clientId?: string
      type?: 'preference' | 'fact' | 'project' | 'decision' | 'agent'
      importance?: number
      projectId?: string
      conversationId?: string
      noteId?: string
      messageId?: string
      turnId?: string
      tags?: string[]
      actor?: 'user' | 'agent'
      accessToken?: string
      userId?: string
    }

    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'memory:write:ip', key: getClientIp(request), limit: 60, windowMs: 10 * 60_000 },
      { bucket: 'memory:write:user', key: auth.userId, limit: 30, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse
    const serverSecret = getInternalApiSecret()

    const trimmed = (body.content ?? '').trim()
    if (!trimmed) return NextResponse.json({ error: 'content required' }, { status: 400 })
    if (trimmed.length > MAX_MEMORY_CONTENT_CHARS) {
      return NextResponse.json({ error: `content cannot exceed ${MAX_MEMORY_CONTENT_CHARS} characters` }, { status: 413 })
    }

    const raw = body.source ?? 'manual'
    const source =
      raw === 'chat' || raw === 'note' || raw === 'manual' ? raw : 'manual'

    const chunks = segmentMemoryForIngestion(trimmed)
    if (chunks.length > MAX_MEMORY_CHUNKS) {
      return NextResponse.json({ error: `memory content produced too many chunks` }, { status: 413 })
    }
    const clientIdSingle = chunks.length === 1 ? body.clientId?.trim() || undefined : undefined

    const ids: string[] = []
    for (const chunk of chunks) {
      const memoryId = await convex.mutation<string>('memories:add', {
        userId: auth.userId,
        serverSecret,
        clientId: clientIdSingle,
        content: chunk,
        source,
        type: body.type,
        importance: body.importance,
        projectId: body.projectId ?? undefined,
        conversationId: body.conversationId ?? undefined,
        noteId: body.noteId ?? undefined,
        messageId: body.messageId ?? undefined,
        turnId: body.turnId ?? undefined,
        tags: body.tags,
        actor: body.actor,
      })
      const id = memoryId || addMemory(auth.userId, chunk, source)
      ids.push(id)
    }

    const memory = await convex.query<MemoryDoc[]>('memories:list', {
      userId: auth.userId,
      serverSecret,
      includeDeleted: true,
    })
    const firstId = ids[0]!
    return NextResponse.json({
      id: firstId,
      ids,
      count: ids.length,
      memory: (memory || []).find((item) => item._id === firstId),
    })
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
      source?: 'chat' | 'note' | 'manual'
      type?: 'preference' | 'fact' | 'project' | 'decision' | 'agent'
      importance?: number
      projectId?: string
      conversationId?: string
      noteId?: string
      messageId?: string
      turnId?: string
      tags?: string[]
      actor?: 'user' | 'agent'
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
      memoryId: body.memoryId.trim() as Id<'memories'>,
      content: body.content,
      source: body.source,
      type: body.type,
      importance: body.importance,
      projectId: body.projectId,
      conversationId: body.conversationId,
      noteId: body.noteId,
      messageId: body.messageId,
      turnId: body.turnId,
      tags: body.tags,
      actor: body.actor,
    })
    const memory = await convex.query<MemoryDoc[]>('memories:list', {
      userId: auth.userId,
      serverSecret,
      includeDeleted: true,
    })
    return NextResponse.json({
      success: true,
      memory: (memory || []).find((item) => item._id === body.memoryId?.trim()),
    })
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
      memoryId: memoryId as Id<'memories'>,
      userId: auth.userId,
      serverSecret,
    })
    removeMemory(memoryId)
    return NextResponse.json({ success: true, memoryId, deletedAt: Date.now() })
  } catch (error) {
    console.error('[Memory API] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 })
  }
}
