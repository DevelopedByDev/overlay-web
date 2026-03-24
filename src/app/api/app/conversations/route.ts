import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import type { Id } from '../../../../../convex/_generated/dataModel'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const conversationId = searchParams.get('conversationId')
    const includeMessages = searchParams.get('messages') === 'true'
    const projectId = searchParams.get('projectId')

    if (conversationId && !includeMessages) {
      const conv = await convex.query<{
        _id: string
        title: string
        lastModified: number
        lastMode: 'ask' | 'act'
        askModelIds: string[]
        actModelId: string
        projectId?: string
      } | null>('conversations:get', { conversationId: conversationId as Id<'conversations'> })
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
            | { type: string; text?: string; url?: string; mediaType?: string }
            | {
                type: 'tool-invocation'
                toolInvocation: { toolCallId?: string; toolName: string; state?: string }
              }
          >
          modelId?: string
          variantIndex?: number
          replyToTurnId?: string
          replySnippet?: string
        }>
      >('conversations:getMessages', { conversationId: conversationId as Id<'conversations'> })

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
                const p = part as { type: string; text?: string; url?: string; mediaType?: string }
                return {
                  type: p.type as 'text' | 'file',
                  text: p.text,
                  url: p.url,
                  mediaType: p.mediaType,
                }
              })
            : [{ type: 'text' as const, text: message.content }],
          model: message.modelId,
          ...(message.replyToTurnId ? { replyToTurnId: message.replyToTurnId } : {}),
          ...(message.replySnippet ? { replySnippet: message.replySnippet } : {}),
        })),
      })
    }

    if (projectId) {
      const list = await convex.query<
        Array<{
          _id: string
          title: string
          lastModified: number
          lastMode: 'ask' | 'act'
          askModelIds: string[]
          actModelId: string
        }>
      >('conversations:listByProject', { projectId })
      return NextResponse.json(list || [])
    }

    const list = await convex.query<
      Array<{
        _id: string
        title: string
        lastModified: number
        lastMode: 'ask' | 'act'
        askModelIds: string[]
        actModelId: string
      }>
    >('conversations:list', { userId: session.user.id })

    return NextResponse.json(list || [])
  } catch {
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json() as {
      title?: string
      projectId?: string
      askModelIds?: string[]
      actModelId?: string
      lastMode?: 'ask' | 'act'
    }
    const id = await convex.mutation<Id<'conversations'>>('conversations:create', {
      userId: session.user.id,
      title: body.title || 'New Chat',
      projectId: body.projectId ?? undefined,
      askModelIds: body.askModelIds,
      actModelId: body.actModelId,
      lastMode: body.lastMode,
    })
    return NextResponse.json({ id })
  } catch {
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      conversationId?: string
      title?: string
      askModelIds?: string[]
      actModelId?: string
      lastMode?: 'ask' | 'act'
    }
    if (!body.conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
    }

    await convex.mutation('conversations:update', {
      conversationId: body.conversationId as Id<'conversations'>,
      title: body.title,
      askModelIds: body.askModelIds,
      actModelId: body.actModelId,
      lastMode: body.lastMode,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[conversations PATCH]', error)
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const conversationId = request.nextUrl.searchParams.get('conversationId')
    if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

    await convex.mutation('conversations:remove', {
      conversationId: conversationId as Id<'conversations'>,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }
}
