import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'

const OUTPUT_TYPES = new Set(['image', 'video', 'audio', 'document', 'archive', 'code', 'text', 'other'])

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const serverSecret = getInternalApiSecret()

    const { searchParams } = new URL(request.url)
    const rawType = searchParams.get('type')
    const type = rawType && OUTPUT_TYPES.has(rawType) ? rawType : undefined
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const conversationId = searchParams.get('conversationId')

    const outputs = conversationId
      ? await convex.query('outputs:listByConversationId', {
          conversationId,
          userId: session.user.id,
          serverSecret,
        })
      : await convex.query('outputs:list', {
          userId: session.user.id,
          serverSecret,
          type: type ?? undefined,
          limit,
        })

    return NextResponse.json(outputs ?? [])
  } catch (error) {
    console.error('[Outputs API] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch outputs' }, { status: 500 })
  }
}
