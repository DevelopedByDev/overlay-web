import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { isKnownOutputType } from '@/lib/output-types'
import { deleteObject } from '@/lib/r2'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { isOwnedOutputR2Key } from '@/lib/storage-keys'
import { convex } from '@/lib/convex'

type OutputFile = {
  _id: string
  userId: string
  kind?: string
  name: string
  r2Key?: string | null
  mimeType?: string
  sizeBytes?: number
  prompt?: string
  modelId?: string
  outputType?: string
  conversationId?: string
  turnId?: string
  createdAt: number
  updatedAt: number
  legacyOutputId?: string
}

function asOutput(file: OutputFile) {
  const type = file.outputType ?? 'other'
  return {
    _id: file._id,
    fileId: file._id,
    legacyOutputId: file.legacyOutputId,
    userId: file.userId,
    type,
    source: type === 'image' ? 'image_generation' : type === 'video' ? 'video_generation' : 'sandbox',
    status: 'completed',
    prompt: file.prompt ?? file.name,
    modelId: file.modelId ?? '',
    r2Key: file.r2Key ?? undefined,
    url: `/api/app/files/${file._id}/content`,
    fileName: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    conversationId: file.conversationId,
    turnId: file.turnId,
    createdAt: file.createdAt,
    completedAt: file.updatedAt,
  }
}

async function getCanonicalOutput(args: {
  outputId: string
  userId: string
  serverSecret: string
}): Promise<OutputFile | null> {
  const direct = await convex.query<OutputFile | null>('files:get', {
    fileId: args.outputId,
    userId: args.userId,
    serverSecret: args.serverSecret,
  }).catch(() => null)
  if (direct?.kind === 'output') return direct
  const migrated = await convex.query<OutputFile | null>('files:getByLegacyOutputId', {
    outputId: args.outputId,
    userId: args.userId,
    serverSecret: args.serverSecret,
  }).catch(() => null)
  return migrated?.kind === 'output' ? migrated : null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const { searchParams } = new URL(request.url)
    const rawType = searchParams.get('type')
    const type = rawType && isKnownOutputType(rawType) ? rawType : null
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const conversationId = searchParams.get('conversationId')

    const files = await convex.query<OutputFile[]>('files:list', {
      userId: auth.userId,
      serverSecret,
      kind: 'output',
    })
    const outputs = (files ?? [])
      .filter((file) => !conversationId || file.conversationId === conversationId)
      .filter((file) => !type || file.outputType === type)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Number.isFinite(limit) ? limit : 50)
      .map(asOutput)

    return NextResponse.json(outputs)
  } catch (error) {
    console.error('[Outputs API] compatibility error:', error)
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

    const output = await getCanonicalOutput({ outputId, userId: auth.userId, serverSecret })
    if (!output) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (output.r2Key) {
      if (!isOwnedOutputR2Key(auth.userId, output.r2Key)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      await deleteObject(output.r2Key)
    }
    await convex.mutation('files:remove', {
      fileId: output._id,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Outputs API] compatibility delete error:', error)
    return NextResponse.json({ error: 'Failed to delete output' }, { status: 500 })
  }
}
