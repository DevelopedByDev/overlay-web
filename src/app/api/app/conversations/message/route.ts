import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
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
      model?: string
      modelId?: string
      contentType?: 'text' | 'image' | 'video'
      variantIndex?: number
    }

    const normalizedParts = body.parts?.filter((part) => part.type === 'text' || part.type === 'file')
    const normalizedContent = body.content?.trim() ||
      (normalizedParts?.some((part) => part.type === 'file') ? '[Image attachment]' : '')

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

    await convex.mutation('conversations:addMessage', {
      conversationId: body.conversationId as Id<'conversations'>,
      userId: session.user.id,
      turnId,
      role: body.role,
      mode,
      content: normalizedContent,
      contentType,
      parts: normalizedParts,
      modelId,
      variantIndex: body.variantIndex,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }
}
