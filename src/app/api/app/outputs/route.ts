import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { isKnownOutputType } from '@/lib/output-types'
import { deleteObject } from '@/lib/r2'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const serverSecret = getInternalApiSecret()

    const { searchParams } = new URL(request.url)
    const rawType = searchParams.get('type')
    const type = rawType && isKnownOutputType(rawType) ? rawType : null
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

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const outputId = request.nextUrl.searchParams.get('outputId')
    if (!outputId) return NextResponse.json({ error: 'outputId required' }, { status: 400 })

    const output = await convex.query<{ r2Key?: string; storageId?: string } | null>('outputs:get', {
      outputId,
      userId: session.user.id,
      serverSecret,
    })

    if (output?.r2Key) {
      await deleteObject(output.r2Key)
      console.log(`[OutputsDelete] Deleted R2 object key=${output.r2Key} for outputId=${outputId}`)
    }

    await convex.mutation('outputs:remove', {
      outputId,
      userId: session.user.id,
      serverSecret,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete output' }, { status: 500 })
  }
}
