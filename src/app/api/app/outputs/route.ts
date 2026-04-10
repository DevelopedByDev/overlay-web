import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { isKnownOutputType } from '@/lib/output-types'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { deleteAppOutput, listAppOutputs } from '@/lib/app-api/output-service'

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

    return NextResponse.json(
      await listAppOutputs(auth.userId, serverSecret, {
        ...(conversationId ? { conversationId } : {}),
        ...(type ? { type } : {}),
        limit,
      }),
    )
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
    return NextResponse.json(
      await deleteAppOutput(auth.userId, serverSecret, outputId),
    )
  } catch (error) {
    console.error('[Outputs API] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete output' }, { status: 500 })
  }
}
