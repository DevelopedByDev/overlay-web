import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { convex } from '@/lib/convex'
import type { Id } from '../../../../../../convex/_generated/dataModel'

function buildShareUrl(request: NextRequest, token: string): string {
  const origin =
    request.headers.get('origin') ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}`
  return `${origin.replace(/\/$/, '')}/share/f/${token}`
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      fileId?: string
      visibility?: 'private' | 'public'
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!body.fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 })
    }
    if (body.visibility !== 'private' && body.visibility !== 'public') {
      return NextResponse.json({ error: 'visibility must be "private" or "public"' }, { status: 400 })
    }
    const serverSecret = getInternalApiSecret()
    const result = await convex.mutation<{ token: string | null; visibility: 'private' | 'public' }>(
      'files:setShare',
      {
        fileId: body.fileId as Id<'files'>,
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
    console.error('[files/share PATCH]', error)
    return NextResponse.json({ error: 'Failed to update share visibility' }, { status: 500 })
  }
}
