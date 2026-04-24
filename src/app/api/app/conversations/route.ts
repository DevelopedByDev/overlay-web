import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { DEFAULT_MODEL_ID, FREE_TIER_DEFAULT_MODEL_ID } from '@/lib/models'
import { convex } from '@/lib/convex'
import type { Id } from '../../../../../convex/_generated/dataModel'

type ConversationDoc = {
  _id: string
  userId: string
  clientId?: string
  title: string
  lastModified: number
  createdAt: number
  updatedAt: number
  deletedAt?: number
  lastMode: 'ask' | 'act'
  askModelIds: string[]
  actModelId: string
  projectId?: string
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

    const { searchParams } = request.nextUrl
    const conversationId = searchParams.get('conversationId')
    const includeMessages = searchParams.get('messages') === 'true'
    const projectId = searchParams.get('projectId')
    const updatedSinceParam = searchParams.get('updatedSince')
    const updatedSince = updatedSinceParam ? Number(updatedSinceParam) : undefined
    const includeDeleted = readBooleanParam(searchParams.get('includeDeleted'))

    if (conversationId && !includeMessages) {
      const conv = await convex.query<ConversationDoc | null>('conversations:get', {
        conversationId: conversationId as Id<'conversations'>,
        userId: auth.userId,
        serverSecret,
      })
      if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(conv)
    }

    if (conversationId && includeMessages) {
      const messages = await convex.query<
        Array<{
          _id: string
          turnId: string
          role: 'user' | 'assistant'
          mode: 'ask' | 'act'
          content: string
          contentType: 'text' | 'image' | 'video'
          parts?: Array<
            | { type: string; text?: string; url?: string; mediaType?: string; fileName?: string; state?: string }
            | {
                type: 'tool-invocation'
                toolInvocation: {
                  toolCallId?: string
                  toolName: string
                  state?: string
                  toolInput?: Record<string, unknown>
                  toolOutput?: unknown
                }
              }
          >
          modelId?: string
          variantIndex?: number
          replyToTurnId?: string
          replySnippet?: string
          routedModelId?: string
        }>
      >('conversations:getMessages', {
        conversationId: conversationId as Id<'conversations'>,
        userId: auth.userId,
        serverSecret,
      })

      return NextResponse.json({
        messages: (messages || []).map((message) => ({
          id: message._id,
          turnId: message.turnId,
          mode: message.mode,
          contentType: message.contentType,
          variantIndex: message.variantIndex,
          role: message.role,
          parts: message.parts?.length
            ? message.parts.map((part) => {
                if (part.type === 'tool-invocation' && 'toolInvocation' in part && part.toolInvocation) {
                  return {
                    type: 'tool-invocation' as const,
                    toolInvocation: part.toolInvocation,
                  }
                }
                const p = part as {
                  type: string
                  text?: string
                  url?: string
                  mediaType?: string
                  fileName?: string
                  state?: string
                }
                return {
                  type: p.type,
                  text: p.text,
                  url: p.url,
                  mediaType: p.mediaType,
                  fileName: p.fileName,
                  state: p.state,
                }
              })
            : [{ type: 'text' as const, text: message.content }],
          model: message.modelId,
          ...(message.replyToTurnId ? { replyToTurnId: message.replyToTurnId } : {}),
          ...(message.replySnippet ? { replySnippet: message.replySnippet } : {}),
          ...(message.routedModelId ? { routedModelId: message.routedModelId } : {}),
        })),
      })
    }

    if (projectId) {
      const list = await convex.query<ConversationDoc[]>('conversations:listByProject', {
        projectId,
        userId: auth.userId,
        serverSecret,
        ...(Number.isFinite(updatedSince) ? { updatedSince } : {}),
        ...(includeDeleted !== undefined ? { includeDeleted } : {}),
      })
      return NextResponse.json(list || [])
    }

    const list = await convex.query<ConversationDoc[]>('conversations:list', {
      userId: auth.userId,
      serverSecret,
      ...(Number.isFinite(updatedSince) ? { updatedSince } : {}),
      ...(includeDeleted !== undefined ? { includeDeleted } : {}),
    })

    return NextResponse.json(list || [])
  } catch {
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      title?: string
      projectId?: string
      askModelIds?: string[]
      actModelId?: string
      lastMode?: 'ask' | 'act'
      clientId?: string
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const entitlements = await convex.query<{ tier: 'free' | 'pro' | 'max' } | null>(
      'usage:getEntitlementsByServer',
      {
        userId: auth.userId,
        serverSecret,
      },
      { throwOnError: true },
    )
    const isFreeTier = entitlements?.tier === 'free'
    const id = await convex.mutation<Id<'conversations'>>('conversations:create', {
      userId: auth.userId,
      serverSecret,
      clientId: body.clientId?.trim() || undefined,
      title: body.title || 'New Chat',
      projectId: body.projectId ?? undefined,
      askModelIds: isFreeTier ? [FREE_TIER_DEFAULT_MODEL_ID] : body.askModelIds,
      actModelId: isFreeTier ? FREE_TIER_DEFAULT_MODEL_ID : (body.actModelId ?? body.askModelIds?.[0] ?? DEFAULT_MODEL_ID),
      lastMode: body.lastMode,
    })
    const conversation = await convex.query<ConversationDoc | null>('conversations:get', {
      conversationId: id,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ id, conversation })
  } catch {
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as {
      conversationId?: string
      title?: string
      projectId?: string
      askModelIds?: string[]
      actModelId?: string
      lastMode?: 'ask' | 'act'
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    if (!body.conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
    }

    await convex.mutation('conversations:update', {
      conversationId: body.conversationId as Id<'conversations'>,
      userId: auth.userId,
      serverSecret,
      title: body.title,
      projectId: body.projectId,
      askModelIds: body.askModelIds,
      actModelId: body.actModelId,
      lastMode: body.lastMode,
    })
    const conversation = await convex.query<ConversationDoc | null>('conversations:get', {
      conversationId: body.conversationId as Id<'conversations'>,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ success: true, conversation })
  } catch (error) {
    console.error('[conversations PATCH]', error)
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 })
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

    const conversationId = request.nextUrl.searchParams.get('conversationId')
    if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

    await convex.mutation('conversations:remove', {
      conversationId: conversationId as Id<'conversations'>,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ success: true, conversationId, deletedAt: Date.now() })
  } catch {
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }
}
