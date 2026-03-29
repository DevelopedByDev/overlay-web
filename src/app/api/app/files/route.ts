import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { hashTextContent, partedFileName, splitTextForConvexDocuments } from '@/lib/convex-file-content'

function storageErrorResponse(error: unknown, fallback = 'Failed to save file') {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('storage_limit_exceeded')) {
    return NextResponse.json({ error: 'Overlay storage limit reached.' }, { status: 403 })
  }
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const { searchParams } = request.nextUrl
    const fileId = searchParams.get('fileId')
    if (fileId) {
      const file = await convex.query('files:get', {
        fileId,
        userId: session.user.id,
        serverSecret,
      })
      if (!file || (file as { userId: string }).userId !== session.user.id) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json(file)
    }
    const projectId = searchParams.get('projectId')
    const args: Record<string, unknown> = {
      userId: session.user.id,
      serverSecret,
    }
    if (projectId !== null) args.projectId = projectId
    const files = await convex.query('files:list', args)
    return NextResponse.json(files ?? [])
  } catch {
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const { name, type, parentId, content, storageId, sizeBytes, projectId } = await request.json()
    if (!name || !type) return NextResponse.json({ error: 'name and type required' }, { status: 400 })

    const args: Record<string, unknown> = {
      userId: session.user.id,
      serverSecret,
      name,
      type,
    }
    if (parentId) args.parentId = parentId
    if (projectId) args.projectId = projectId

    let id: unknown
    const ids: string[] = []

    if (storageId) {
      // Binary file uploaded directly to Convex storage (type is always 'file')
      const { type: _type, ...storageArgs } = args
      void _type
      id = await convex.mutation('files:createWithStorage', {
        ...storageArgs,
        storageId,
        sizeBytes: typeof sizeBytes === 'number' ? Math.max(0, Math.round(sizeBytes)) : 0,
      })
    } else if (type === 'file' && typeof content === 'string' && content.length > 0) {
      const parts = splitTextForConvexDocuments(content)
      const total = parts.length
      for (let p = 0; p < parts.length; p++) {
        const part = parts[p]!
        const partName = partedFileName(name, p + 1, total)
        const partId = await convex.mutation<string>('files:create', {
          ...args,
          name: partName,
          content: part,
          contentHash: hashTextContent(part),
        })
        if (!partId) {
          return NextResponse.json({ error: 'Failed to create file part' }, { status: 500 })
        }
        ids.push(partId)
      }
      id = ids[0]
    } else {
      if (content) {
        args.content = content
        args.contentHash = hashTextContent(content)
      }
      id = await convex.mutation('files:create', args)
    }

    return NextResponse.json({ id, ids: ids.length ? ids : undefined, parts: ids.length || undefined })
  } catch (error) {
    return storageErrorResponse(error, 'Failed to create file')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const { fileId, name, content } = await request.json()
    if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })
    const args: Record<string, unknown> = {
      fileId,
      userId: session.user.id,
      serverSecret,
    }
    if (name !== undefined) args.name = name
    if (content !== undefined) {
      args.content = content
      args.contentHash = hashTextContent(content)
    }
    await convex.mutation('files:update', args)
    return NextResponse.json({ success: true })
  } catch (error) {
    return storageErrorResponse(error, 'Failed to update file')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const fileId = request.nextUrl.searchParams.get('fileId')
    if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })
    await convex.mutation('files:remove', {
      fileId,
      userId: session.user.id,
      serverSecret,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
