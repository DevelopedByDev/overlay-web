import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { convex } from '@/lib/convex'
import { isKnownOutputType } from '@/lib/output-types'
import { deleteObject } from '@/lib/r2'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { isOwnedOutputR2Key } from '@/lib/storage-keys'

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) {
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
          userId: auth.userId,
          serverSecret,
        }, { throwOnError: true })
      : await convex.query('outputs:list', {
          userId: auth.userId,
          serverSecret,
          type: type ?? undefined,
          limit,
        }, { throwOnError: true })

    return NextResponse.json(outputs ?? [])
  } catch (error) {
    console.error('[Outputs API] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch outputs' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let body: { accessToken?: string; userId?: string } = {}
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        body = await request.json()
      } catch {
        body = {}
      }
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const outputId = request.nextUrl.searchParams.get('outputId')
    if (!outputId) return NextResponse.json({ error: 'outputId required' }, { status: 400 })

    const output = await convex.query<{ r2Key?: string; storageId?: string } | null>('outputs:get', {
      outputId,
      userId: auth.userId,
      serverSecret,
    }, { throwOnError: true })

    if (output?.r2Key) {
      if (!isOwnedOutputR2Key(auth.userId, output.r2Key)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      await deleteObject(output.r2Key)
      console.log(`[OutputsDelete] Deleted R2 object key=${output.r2Key} for outputId=${outputId}`)
    }

    await convex.mutation('outputs:remove', {
      outputId,
      userId: auth.userId,
      serverSecret,
    }, { throwOnError: true })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Outputs API] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete output' }, { status: 500 })
  }
}
