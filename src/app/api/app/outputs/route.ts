import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'image' | 'video' | null
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const conversationId = searchParams.get('conversationId')

    const outputs = conversationId
      ? await convex.query('outputs:listByConversationId', {
          conversationId,
          userId: session.user.id,
          accessToken: session.accessToken,
        })
      : await convex.query('outputs:list', {
          userId: session.user.id,
          accessToken: session.accessToken,
          type: type ?? undefined,
          limit,
        })

    return NextResponse.json(outputs ?? [])
  } catch (error) {
    console.error('[Outputs API] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch outputs' }, { status: 500 })
  }
}
