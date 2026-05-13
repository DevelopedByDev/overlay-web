import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { convex } from '@/lib/convex'
import { hashTextContent, partedFileName, splitTextForConvexDocuments } from '@/lib/convex-file-content'
import { deleteObjects, headObject } from '@/lib/r2'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { isOwnedFileR2Key, isOwnedOutputR2Key } from '@/lib/storage-keys'
import { checkGlobalR2Budget } from '@/lib/r2-budget'
import { expireR2UploadIntent, type R2UploadIntent } from '@/lib/r2-upload-intents'
import type { Id } from '../../../../../convex/_generated/dataModel'

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
      const file = await convex.query('files:get', {
        fileId,
        userId: auth.userId,
        serverSecret,
      })
      if (!file || (file as { userId: string }).userId !== auth.userId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json(file)
    }
    const projectId = searchParams.get('projectId')
    const kind = searchParams.get('kind')
    const parentId = searchParams.get('parentId')
    const conversationId = searchParams.get('conversationId')
    const outputType = searchParams.get('outputType') ?? searchParams.get('type')
    const args: Record<string, unknown> = {
      userId: auth.userId,
      serverSecret,
    }
    if (projectId !== null) args.projectId = projectId
    if (parentId !== null) args.parentId = parentId === 'null' ? null : parentId
    if (conversationId !== null) args.conversationId = conversationId
    if (outputType !== null) args.outputType = outputType
    if (kind === 'folder' || kind === 'note' || kind === 'upload' || kind === 'output') args.kind = kind
    const files = await convex.query('files:list', args)
    return NextResponse.json(files ?? [])
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
    const {
      name,
      type,
      kind,
      parentId,
      content,
      textContent,
      storageId,
      r2Key,
      sizeBytes,
      projectId,
      mimeType,
      extension,
      conversationId,
      turnId,
      modelId,
      prompt,
      outputType,
      legacyOutputId,
    } = body as Record<string, unknown>
    if (typeof name !== 'string') {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    if (storageId) {
      return NextResponse.json(
        { error: 'Convex file storage is no longer supported. Upload to R2 and pass r2Key from the upload-url flow.' },
        { status: 400 },
      )
    }

    const args: Record<string, unknown> = {
      userId: auth.userId,
      serverSecret,
      name,
    }
    if (typeof type === 'string') args.type = type
    if (kind === 'folder' || kind === 'note' || kind === 'upload' || kind === 'output') args.kind = kind
    if (parentId) args.parentId = parentId
    if (projectId) args.projectId = projectId
    if (typeof mimeType === 'string') args.mimeType = mimeType
    if (typeof extension === 'string') args.extension = extension
    if (typeof conversationId === 'string') args.conversationId = conversationId
    if (typeof turnId === 'string') args.turnId = turnId
    if (typeof modelId === 'string') args.modelId = modelId
    if (typeof prompt === 'string') args.prompt = prompt
    if (typeof outputType === 'string') args.outputType = outputType
    if (typeof legacyOutputId === 'string') args.legacyOutputId = legacyOutputId

    let id: unknown
    const ids: string[] = []

    if (r2Key) {
      if (
        typeof r2Key !== 'string' ||
        (kind === 'output'
          ? !isOwnedOutputR2Key(auth.userId, r2Key)
          : !isOwnedFileR2Key(auth.userId, r2Key))
      ) {
        return NextResponse.json({ error: 'Invalid storage key' }, { status: 400 })
      }
      const objectHead = await headObject(r2Key)
      if (!objectHead) {
        return NextResponse.json({ error: 'Uploaded object not found' }, { status: 400 })
      }
      const uploadIntent = kind === 'output'
        ? null
        : await convex.query<R2UploadIntent | null>('files:getUploadIntentByServer', {
          userId: auth.userId,
          serverSecret,
          r2Key,
          now: Date.now(),
        }, { throwOnError: true })
      if (kind !== 'output' && !uploadIntent) {
        await deleteObjects([r2Key]).catch(() => {})
        return NextResponse.json({ error: 'Upload authorization expired or was not found' }, { status: 400 })
      }
      const declaredSize = uploadIntent?.declaredSizeBytes ?? (typeof sizeBytes === 'number' ? Math.max(0, Math.round(sizeBytes)) : 0)
      const actualSize = Math.max(0, Math.round(objectHead.sizeBytes))
      if (declaredSize > 0 && actualSize > declaredSize) {
        await deleteObjects([r2Key]).catch(() => {})
        if (uploadIntent) {
          await expireR2UploadIntent({
            userId: auth.userId,
            serverSecret,
            intentId: uploadIntent._id,
          }).catch(() => {})
        }
        return NextResponse.json({ error: 'Uploaded object exceeds authorized size' }, { status: 413 })
      }
      await checkGlobalR2Budget(actualSize)
      if (kind === 'output') {
        id = await convex.mutation('files:create', {
          ...args,
          type: 'file',
          r2Key,
          sizeBytes: actualSize,
        }, { throwOnError: true })
      } else {
        const { type: _type, ...storageArgs } = args
        void _type
        try {
          id = await convex.mutation('files:createWithStorage', {
            ...storageArgs,
            r2Key,
            sizeBytes: actualSize,
          }, { throwOnError: true })
        } catch (error) {
          await deleteObjects([r2Key]).catch(() => {})
          if (uploadIntent) {
            await expireR2UploadIntent({
              userId: auth.userId,
              serverSecret,
              intentId: uploadIntent._id,
            }).catch(() => {})
          }
          throw error
        }
        if (!id) throw new Error('File create returned no id')
        if (uploadIntent) {
          await convex.mutation('files:finalizeUploadIntentByServer', {
            userId: auth.userId,
            serverSecret,
            r2Key,
            actualSizeBytes: actualSize,
            fileId: id as Id<'files'>,
            now: Date.now(),
          }, { throwOnError: true }).catch(async (error) => {
            console.warn('[FilesCreate] Uploaded file saved but upload intent finalization failed', error)
            await expireR2UploadIntent({
              userId: auth.userId,
              serverSecret,
              intentId: uploadIntent._id,
            }).catch(() => {})
          })
        }
      }
    } else if (kind !== 'note' && type === 'file' && typeof (textContent ?? content) === 'string' && String(textContent ?? content).length > 0) {
      const fullText = String(textContent ?? content)
      const parts = splitTextForConvexDocuments(fullText)
      const total = parts.length
      for (let p = 0; p < parts.length; p++) {
        const part = parts[p]!
        const partName = partedFileName(name, p + 1, total)
        const partId = await convex.mutation<string>('files:create', {
          ...args,
          name: partName,
          content: part,
          textContent: part,
          contentHash: hashTextContent(part),
        })
        if (!partId) {
          return NextResponse.json({ error: 'Failed to create file part' }, { status: 500 })
        }
        ids.push(partId)
      }
      id = ids[0]
    } else {
      if (typeof (textContent ?? content) === 'string' && String(textContent ?? content).length > 0) {
        const fullText = String(textContent ?? content)
        args.content = fullText
        args.textContent = fullText
        args.contentHash = hashTextContent(fullText)
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
    const body = await request.json()
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const { fileId, name, content, textContent, parentId, projectId } = body as Record<string, unknown>
    if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })
    const args: Record<string, unknown> = {
      fileId,
      userId: auth.userId,
      serverSecret,
    }
    if (name !== undefined) args.name = name
    if (parentId !== undefined) args.parentId = parentId || null
    if (projectId !== undefined) args.projectId = projectId || null
    if (typeof (textContent ?? content) === 'string') {
      const fullText = String(textContent ?? content)
      args.content = fullText
      args.textContent = fullText
      args.contentHash = hashTextContent(fullText)
    } else if ((textContent ?? content) !== undefined) {
      args.content = textContent ?? content
    }
    await convex.mutation('files:update', args)
    return NextResponse.json({ success: true })
  } catch (error) {
    return storageErrorResponse(error, 'Failed to update file')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let body: { accessToken?: string; userId?: string; fileId?: string } = {}
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
    const fileId = request.nextUrl.searchParams.get('fileId') || body.fileId
    if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })

    const r2Entries = await convex.query<Array<{ fileId: string; r2Key?: string; storageId?: string }>>(
      'files:getR2KeysForSubtree',
      { fileId, userId: auth.userId, serverSecret },
    )
    const r2Keys = (r2Entries ?? []).flatMap((entry) => {
      if (
        !entry.r2Key ||
        (!isOwnedFileR2Key(auth.userId, entry.r2Key) && !isOwnedOutputR2Key(auth.userId, entry.r2Key))
      ) {
        return []
      }
      return [entry.r2Key]
    })
    if (r2Keys.length > 0) {
      await deleteObjects(r2Keys)
      console.log(`[FilesDelete] Deleted ${r2Keys.length} R2 objects for fileId=${fileId}`)
    }
    await convex.mutation('files:remove', {
      fileId,
      userId: auth.userId,
      serverSecret,
      r2CleanupConfirmed: r2Keys.length > 0,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[FilesDelete] failed', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
