import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import {
  createAppFile,
  deleteAppFile,
  getAppFile,
  listAppFiles,
  updateAppFile,
} from '@/lib/app-api/file-service'

function storageErrorResponse(error: unknown, fallback = 'Failed to save file') {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('storage_limit_exceeded')) {
    return NextResponse.json({ error: 'Overlay storage limit reached.' }, { status: 403 })
  }
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const { searchParams } = request.nextUrl
    const fileId = searchParams.get('fileId')
    if (fileId) {
      const file = await getAppFile(auth.userId, serverSecret, fileId)
      if (!file || (file as { userId: string }).userId !== auth.userId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json(file)
    }
    const projectId = searchParams.get('projectId')
    return NextResponse.json(
      await listAppFiles(auth.userId, serverSecret, {
        ...(projectId !== null ? { projectId } : {}),
      }),
    )
  } catch {
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formDataContentType = request.headers.get('content-type') || ''
    const body = formDataContentType.includes('application/json') ? await request.json() : {}
    const auth = await resolveAuthenticatedAppUser(request, body as { accessToken?: string; userId?: string })
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const { name, type, parentId, content, storageId, r2Key, sizeBytes, projectId } = body as Record<string, unknown>
    if (typeof name !== 'string' || typeof type !== 'string') {
      return NextResponse.json({ error: 'name and type required' }, { status: 400 })
    }
    if (storageId) {
      return NextResponse.json(
        { error: 'Convex file storage is no longer supported. Upload to R2 and pass r2Key from the upload-url flow.' },
        { status: 400 },
      )
    }
    return NextResponse.json(
      await createAppFile({
        userId: auth.userId,
        serverSecret,
        name,
        type: type as 'file' | 'folder',
        ...(typeof parentId === 'string' ? { parentId } : {}),
        ...(typeof content === 'string' ? { content } : {}),
        ...(typeof r2Key === 'string' ? { r2Key } : {}),
        ...(typeof sizeBytes === 'number' ? { sizeBytes } : {}),
        ...(typeof projectId === 'string' ? { projectId } : {}),
      }),
    )
  } catch (error) {
    return storageErrorResponse(error, 'Failed to create file')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const { fileId, name, content } = body as Record<string, unknown>
    if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })
    return NextResponse.json(
      await updateAppFile({
        userId: auth.userId,
        serverSecret,
        fileId: String(fileId),
        ...(typeof name === 'string' ? { name } : {}),
        ...(content !== undefined ? { content } : {}),
      }),
    )
  } catch (error) {
    return storageErrorResponse(error, 'Failed to update file')
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
    const fileId = request.nextUrl.searchParams.get('fileId')
    if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })
    return NextResponse.json(await deleteAppFile(auth.userId, serverSecret, fileId))
  } catch {
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
