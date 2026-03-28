import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getComputerServerSecret, requireComputerApiContext } from '@/lib/computer-api-route'
import { classifyOutputType, guessMimeType } from '@/lib/output-utils'

const OUTPUT_TYPES = new Set(['image', 'video', 'audio', 'document', 'archive', 'code', 'text', 'other'])

export async function GET(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth
  const serverSecret = getComputerServerSecret()

  try {
    const rawType = request.nextUrl.searchParams.get('type')
    const type = rawType && OUTPUT_TYPES.has(rawType) ? rawType : undefined
    const limit = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10)
    const conversationId = request.nextUrl.searchParams.get('conversationId')

    const outputs = conversationId
      ? await convex.query('outputs:listByConversationId', {
          conversationId,
          userId: auth.userId,
          serverSecret,
        })
      : await convex.query('outputs:list', {
          userId: auth.userId,
          serverSecret,
          type,
          limit,
        })

    return NextResponse.json(outputs ?? [])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch outputs'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth
  const serverSecret = getComputerServerSecret()

  try {
    const body = (await request.json()) as {
      type?: string
      status?: 'pending' | 'completed' | 'failed'
      prompt?: string
      modelId?: string
      storageId?: string
      url?: string
      fileName?: string
      mimeType?: string
      sizeBytes?: number
      metadata?: Record<string, unknown>
      conversationId?: string
      turnId?: string
      errorMessage?: string
    }

    const fileName = body.fileName?.trim() || undefined
    const mimeType = guessMimeType(fileName || '', body.mimeType)
    const normalizedType = classifyOutputType(fileName, body.mimeType ?? mimeType)
    const type = body.type && OUTPUT_TYPES.has(body.type) ? body.type : normalizedType

    const id = await convex.mutation('outputs:create', {
      userId: auth.userId,
      serverSecret,
      type,
      status: body.status ?? 'completed',
      prompt: body.prompt?.trim() || fileName || 'Computer output',
      modelId: body.modelId?.trim() || 'openclaw/computer',
      source: 'computer',
      storageId: body.storageId,
      url: body.url,
      fileName,
      mimeType,
      sizeBytes: typeof body.sizeBytes === 'number' ? body.sizeBytes : undefined,
      metadata: body.metadata,
      conversationId: body.conversationId,
      turnId: body.turnId,
      errorMessage: body.errorMessage,
    })

    return NextResponse.json({ id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create output'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
