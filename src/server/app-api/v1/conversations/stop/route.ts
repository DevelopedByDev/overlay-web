import { logger } from '@/server/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { getInternalApiSecret } from '@/server/shared/internal-api-secret'
import { isVerifiedChatStreamRelayRequest } from '@/server/chat/chat-stream-relay-auth'
import { convex } from '@/server/database/convex'
import type { Id } from '../../../../../../convex/_generated/dataModel'

export async function POST(request: NextRequest, context: AppApiRouteContext) {
  try {
    const body = await request.json() as {
      conversationId?: string
      messageId?: string
      partialContent?: string
      partialParts?: Array<Record<string, unknown>>
      accessToken?: string
      userId?: string
    }

    const { auth } = context

    const conversationId = body.conversationId?.trim()
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 },
      )
    }

    const serverSecret = getInternalApiSecret()
    const relayStop = isVerifiedChatStreamRelayRequest(request)
    const result = await convex.mutation('chat/conversations:stopGeneratingMessage', {
      conversationId: conversationId as Id<'conversations'>,
      ...(body.messageId ? { messageId: body.messageId as Id<'conversationMessages'> } : {}),
      ...(relayStop && typeof body.partialContent === 'string' ? { partialContent: body.partialContent } : {}),
      ...(relayStop && Array.isArray(body.partialParts) ? { partialParts: body.partialParts as never } : {}),
      userId: auth.userId,
      serverSecret,
    }) as { stoppedCount: number }

    return NextResponse.json({ success: true, stoppedCount: result.stoppedCount })
  } catch (e) {
    logger.error('[conversations/stop POST]', e)
    const msg = e instanceof Error ? e.message : 'Failed to stop generating message'
    if (msg === 'Unauthorized') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
