import { validateApiBoundary } from '../../_utils/boundary'
import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import { convex } from '@/server/database/convex'
import type { Id } from '../../../../../../convex/_generated/dataModel'

function buildShareUrl(request: NextRequest, token: string): string {
  const origin =
    request.headers.get('origin') ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}`
  return `${origin.replace(/\/$/, '')}/share/c/${token}`
}

export async function PATCH(request: NextRequest) {
  const boundaryError = await validateApiBoundary(request)
  if (boundaryError) return boundaryError
  try {
    const body = (await request.json().catch(() => ({}))) as {
      conversationId?: string
      visibility?: 'private' | 'public'
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!body.conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
    }
    if (body.visibility !== 'private' && body.visibility !== 'public') {
      return NextResponse.json({ error: 'visibility must be "private" or "public"' }, { status: 400 })
    }
    const serverSecret = getInternalApiSecret()
    const result = await convex.mutation<{ token: string | null; visibility: 'private' | 'public' }>(
      'chat/conversations:setShare',
      {
        conversationId: body.conversationId as Id<'conversations'>,
        userId: auth.userId,
        serverSecret,
        visibility: body.visibility,
      },
    )
    if (!result) {
      return NextResponse.json({ error: 'Failed to update share visibility' }, { status: 500 })
    }
    return NextResponse.json({
      visibility: result.visibility,
      token: result.token,
      url: result.token ? buildShareUrl(request, result.token) : null,
    })
  } catch (error) {
    console.error('[conversations/share PATCH]', error)
    return NextResponse.json({ error: 'Failed to update share visibility' }, { status: 500 })
  }
}
