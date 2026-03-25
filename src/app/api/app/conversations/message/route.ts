import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import {
  buildPersistedMessageContent,
  sanitizeMessagePartsForPersistence,
} from '@/lib/chat-message-persistence'
import type { Id } from '../../../../../../convex/_generated/dataModel'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      conversationId?: string
      turnId?: string
      mode?: 'ask' | 'act'
      role?: 'user' | 'assistant'
      content?: string
      parts?: Array<{ type: string; text?: string; url?: string; mediaType?: string }>
      attachmentNames?: string[]
      model?: string
      modelId?: string
      contentType?: 'text' | 'image' | 'video'
      variantIndex?: number
      replyToTurnId?: string
      replySnippet?: string
    }

    const normalizedParts = sanitizeMessagePartsForPersistence(body.parts, {
      attachmentNames: body.attachmentNames,
    })
    const normalizedContent = buildPersistedMessageContent(body.content, body.parts, {
      attachmentNames: body.attachmentNames,
    })

    const turnId = body.turnId?.trim()
    if (!body.conversationId || !body.role || !normalizedContent || !turnId) {
      return NextResponse.json(
        { error: 'conversationId, turnId, role, and content or attachment are required' },
        { status: 400 },
      )
    }

    const mode = body.mode ?? 'ask'
    const contentType = body.contentType ?? 'text'
    const modelId = body.modelId ?? body.model
    const serverSecret = getInternalApiSecret()

    await convex.mutation(
      'conversations:addMessage',
      {
        conversationId: body.conversationId as Id<'conversations'>,
        userId: session.user.id,
        serverSecret,
        turnId,
        role: body.role,
        mode,
        content: normalizedContent,
        contentType,
        parts: normalizedParts,
        modelId,
        variantIndex: body.variantIndex,
        ...(body.replyToTurnId?.trim()
          ? { replyToTurnId: body.replyToTurnId.trim(), replySnippet: body.replySnippet?.trim() }
          : {}),
      },
      { throwOnError: true },
    )

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[conversations/message POST]', e)
    const msg = e instanceof Error ? e.message : 'Failed to save message'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { conversationId?: string; turnId?: string }
    const conversationId = body.conversationId?.trim()
    const turnId = body.turnId?.trim()
    if (!conversationId || !turnId) {
      return NextResponse.json({ error: 'conversationId and turnId are required' }, { status: 400 })
    }

    try {
      const serverSecret = getInternalApiSecret()
      await convex.mutation(
        'conversations:deleteTurn',
        {
          conversationId: conversationId as Id<'conversations'>,
          userId: session.user.id,
          serverSecret,
          turnId,
        },
        { throwOnError: true },
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'Unauthorized' || msg.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
      if (msg.includes('Could not find public function')) {
        return NextResponse.json(
          {
            error:
              'Delete is unavailable until Convex is deployed with deleteTurn. Run `npx convex deploy` (or `npx convex dev`) for this project.',
          },
          { status: 503 },
        )
      }
      console.error('[conversations/message DELETE]', err)
      return NextResponse.json({ error: msg || 'Failed to delete turn' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[conversations/message DELETE]', e)
    return NextResponse.json({ error: 'Failed to delete turn' }, { status: 500 })
  }
}
