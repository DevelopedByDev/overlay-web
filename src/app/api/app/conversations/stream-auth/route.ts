import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { isVerifiedChatStreamRelayRequest } from '@/lib/chat-stream-relay-auth'
import { convex } from '@/lib/convex'
import type { Id } from '../../../../../../convex/_generated/dataModel'

export async function POST(request: NextRequest) {
  try {
    if (!isVerifiedChatStreamRelayRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      conversationId?: string
      turnId?: string
      variantIndex?: number
      accessToken?: string
      userId?: string
    }

    const conversationId = body.conversationId?.trim()
    const turnId = body.turnId?.trim()
    if (!conversationId || !turnId) {
      return NextResponse.json(
        { error: 'conversationId and turnId are required' },
        { status: 400 },
      )
    }

    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serverSecret = getInternalApiSecret()
    const conversation = await convex.query<{ _id: string } | null>('conversations:get', {
      conversationId: conversationId as Id<'conversations'>,
      userId: auth.userId,
      serverSecret,
    })
    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      userId: auth.userId,
      conversationId,
      turnId,
      variantIndex: Number.isFinite(body.variantIndex) ? body.variantIndex : 0,
    })
  } catch (error) {
    console.error('[conversations/stream-auth]', error)
    return NextResponse.json({ error: 'Failed to authorize stream' }, { status: 500 })
  }
}
