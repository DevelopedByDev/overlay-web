import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getComputerServerSecret, requireComputerApiContext } from '@/lib/computer-api-route'
import { partedFileName, splitTextForConvexDocuments } from '@/lib/convex-file-content'

export async function GET(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth
  const serverSecret = getComputerServerSecret()

  try {
    const fileId = request.nextUrl.searchParams.get('fileId')
    if (fileId) {
      const file = await convex.query('files:get', {
        fileId,
        userId: auth.userId,
        serverSecret,
      })
      if (!file) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json(file)
    }

    const projectId = request.nextUrl.searchParams.get('projectId')
    const args: Record<string, unknown> = {
      userId: auth.userId,
      serverSecret,
    }
    if (projectId !== null) args.projectId = projectId
    return NextResponse.json((await convex.query('files:list', args)) ?? [])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch files'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth
  const serverSecret = getComputerServerSecret()

  try {
    const body = (await request.json()) as {
      name?: string
      type?: 'file' | 'folder'
      parentId?: string
      content?: string
      storageId?: string
      projectId?: string
    }
    if (!body.name?.trim() || !body.type) {
      return NextResponse.json({ error: 'name and type required' }, { status: 400 })
    }

    const args: Record<string, unknown> = {
      userId: auth.userId,
      serverSecret,
      name: body.name.trim(),
      type: body.type,
    }
    if (body.parentId) args.parentId = body.parentId
    if (body.projectId) args.projectId = body.projectId

    if (body.storageId) {
      const id = await convex.mutation('files:createWithStorage', {
        userId: auth.userId,
        serverSecret,
        name: body.name.trim(),
        parentId: body.parentId,
        projectId: body.projectId,
        storageId: body.storageId,
      })
      return NextResponse.json({ id })
    }

    if (body.type === 'file' && typeof body.content === 'string' && body.content.length > 0) {
      const parts = splitTextForConvexDocuments(body.content)
      const ids: string[] = []
      for (let index = 0; index < parts.length; index += 1) {
        const id = await convex.mutation<string>('files:create', {
          ...args,
          name: partedFileName(body.name.trim(), index + 1, parts.length),
          content: parts[index],
        })
        if (!id) {
          return NextResponse.json({ error: 'Failed to create file part' }, { status: 500 })
        }
        ids.push(id)
      }
      return NextResponse.json({ id: ids[0], ids, parts: ids.length })
    }

    const id = await convex.mutation('files:create', {
      ...args,
      content: body.content,
    })
    return NextResponse.json({ id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create file'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth
  const serverSecret = getComputerServerSecret()

  try {
    const body = (await request.json()) as { fileId?: string; name?: string; content?: string }
    if (!body.fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 })
    }
    await convex.mutation('files:update', {
      fileId: body.fileId,
      userId: auth.userId,
      serverSecret,
      name: body.name,
      content: body.content,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update file'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth
  const serverSecret = getComputerServerSecret()

  try {
    const fileId = request.nextUrl.searchParams.get('fileId')
    if (!fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 })
    }
    await convex.mutation('files:remove', {
      fileId,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete file'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
