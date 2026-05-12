import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { convex } from '@/lib/convex'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { z } from '@/lib/api-schemas'

const AppConversationsStopRequestSchema = z.object({
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
  accessToken: z.string().optional(),
  userId: z.string().optional(),
}).openapi('AppConversationsStopRequest')
const AppConversationsStopResponseSchema = z.unknown().openapi('AppConversationsStopResponse')
void AppConversationsStopRequestSchema
void AppConversationsStopResponseSchema


export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      conversationId?: string
      messageId?: string
      accessToken?: string
      userId?: string
    }

    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = body.conversationId?.trim()
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 },
      )
    }

    const serverSecret = getInternalApiSecret()
    const result = await convex.mutation('conversations:stopGeneratingMessage', {
      conversationId: conversationId as Id<'conversations'>,
      ...(body.messageId ? { messageId: body.messageId as Id<'conversationMessages'> } : {}),
      serverSecret,
    }) as { stoppedCount: number }

    return NextResponse.json({ success: true, stoppedCount: result.stoppedCount })
  } catch (e) {
    console.error('[conversations/stop POST]', e)
    const msg = e instanceof Error ? e.message : 'Failed to stop generating message'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
