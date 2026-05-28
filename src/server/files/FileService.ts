import 'server-only'

import { randomBytes, randomUUID } from 'node:crypto'
import mammoth from 'mammoth'
import { partedFileName, splitTextForConvexDocuments } from '@/shared/storage/convex-file-content'
import {
  DEFAULT_CONTEXT_CHARS,
  DEFAULT_MAX_MATCHES_PER_FILE,
  DEFAULT_MAX_TOTAL_SNIPPET_CHARS,
  MAX_FILE_IDS_PER_REQUEST,
  MAX_QUERY_CHARS,
  dedupeFileIdsPreserveOrder,
  findSubstringMatchesInText,
} from '@/shared/storage/file-text-search'
import { formatBytes } from '@/shared/storage/storage-limits'
import {
  deleteObject,
  deleteObjects,
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
  getMaxPresignedUploadBytes,
  getR2PresignTtlSeconds,
  headObject,
  keyForFile,
  uploadBuffer,
} from '@/server/storage/object-store'
import { checkGlobalR2Budget } from '@/server/storage/r2-budget'
import { isOwnedFileR2Key, isOwnedOutputR2Key } from '@/server/storage/storage-keys'
import { hashTextContent } from '@/server/storage/text-content-hash'
import type { FileRepository, FileUploadIntentRecord } from './FileRepository'

const BLOCKED_MIME_TYPES = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'application/javascript',
  'text/javascript',
])

const MAX_INGEST_BYTES = 12 * 1024 * 1024
const utf8Encoder = new TextEncoder()

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'html',
  'htm',
  'xml',
  'log',
  'ts',
  'tsx',
  'js',
  'jsx',
  'css',
  'yaml',
  'yml',
  'toml',
  'sh',
  'py',
  'go',
  'rs',
  'java',
  'c',
  'cpp',
  'h',
])

export class FileServiceError extends Error {
  constructor(
    readonly payload: Record<string, unknown>,
    readonly statusCode: number,
    message?: string,
  ) {
    super(message ?? String(payload.error ?? 'File service error'))
    this.name = 'FileServiceError'
  }
}

export type FileServiceStorage = {
  checkGlobalR2Budget(sizeBytes: number): Promise<void>
  deleteObject(key: string): Promise<void>
  deleteObjects(keys: string[]): Promise<void>
  generatePresignedDownloadUrl(key: string): Promise<string>
  generatePresignedUploadUrl(
    key: string,
    mimeType: string,
    sizeBytes: number,
    expiresIn: number,
  ): Promise<string>
  getMaxPresignedUploadBytes(): number
  getR2PresignTtlSeconds(): number
  headObject(key: string): Promise<{ sizeBytes: number; contentType: string | undefined } | null>
  keyForFile(userId: string, fileId: string, fileName: string): string
  uploadBuffer(key: string, body: Buffer | Uint8Array | string, mimeType: string): Promise<void>
}

export type FileServiceClock = {
  now(): number
  randomBytes(size: number): { toString(encoding: 'base64url'): string }
  randomUUID(): string
}

export type FileServiceDeps = {
  clock?: FileServiceClock
  repository: FileRepository
  storage?: FileServiceStorage
}

export type SearchTextMatchRow = {
  fileId: string
  fileName: string
  matchIndexInFile: number
  charStart: number
  charEnd: number
  snippet: string
}

export type ContentProxyResult =
  | { kind: 'json'; payload: Record<string, unknown>; status: number }
  | { kind: 'redirect'; url: string }
  | { kind: 'upstream'; url: string }

const defaultStorage: FileServiceStorage = {
  checkGlobalR2Budget,
  deleteObject,
  deleteObjects,
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
  getMaxPresignedUploadBytes,
  getR2PresignTtlSeconds,
  headObject,
  keyForFile,
  uploadBuffer,
}

const defaultClock: FileServiceClock = {
  now: () => Date.now(),
  randomBytes,
  randomUUID,
}

function serviceError(payload: Record<string, unknown>, statusCode: number): never {
  throw new FileServiceError(payload, statusCode)
}

function normalizeMimeType(value: string | null | undefined): string {
  return (value ?? 'application/octet-stream').toLowerCase().split(';')[0]!.trim()
}

function assertAllowedMimeType(mimeType: string): void {
  if (BLOCKED_MIME_TYPES.has(mimeType)) {
    serviceError({ error: `File type not allowed: ${mimeType}` }, 415)
  }
}

function normalizedPositiveBytes(value: unknown, messages: {
  missing: string
  nonPositive?: string
}): number {
  const sizeBytes =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.round(value)
      : typeof value === 'string' && value.trim() && Number.isFinite(Number(value))
        ? Math.round(Number(value))
        : 0
  if (sizeBytes <= 0) {
    serviceError({ error: messages.nonPositive ?? messages.missing }, 400)
  }
  return sizeBytes
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

function utf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).length
}

function sanitizeConvexIdParam(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined
  const s = value.trim()
  if (!/^[a-z0-9]+$/i.test(s) || s.length < 16 || s.length > 64) return undefined
  return s
}

function isPdf(file: File, ext: string): boolean {
  return ext === 'pdf' || file.type === 'application/pdf'
}

function isDocx(file: File, ext: string): boolean {
  return (
    ext === 'docx' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
}

function isTextLike(file: File, ext: string): boolean {
  return TEXT_EXTENSIONS.has(ext) || (!!file.type && file.type.startsWith('text/'))
}

function isBinaryProxyContent(content: string): boolean {
  return content.startsWith('/api/v1/files/')
}

async function parsePdfBuffer(buf: Buffer): Promise<string> {
  const mod = await import('pdf-parse/lib/pdf-parse.js')
  const parsePdf = mod.default
  const data = await parsePdf(buf)
  return (data.text ?? '').trim()
}

async function extractTextFromBuffer(buf: Buffer, file: File, ext: string): Promise<string> {
  if (buf.length > MAX_INGEST_BYTES) {
    throw new Error('FILE_TOO_LARGE')
  }
  if (isPdf(file, ext)) {
    return parsePdfBuffer(buf)
  }
  if (isDocx(file, ext)) {
    const { value } = await mammoth.extractRawText({ buffer: buf })
    return (value ?? '').trim()
  }
  return buf.toString('utf-8').trim()
}

export class FileService {
  private readonly clock: FileServiceClock
  private readonly storage: FileServiceStorage

  constructor(private readonly deps: FileServiceDeps) {
    this.clock = deps.clock ?? defaultClock
    this.storage = deps.storage ?? defaultStorage
  }

  async getOrListFiles(args: {
    conversationId?: string | null
    fileId?: string | null
    kind?: string | null
    outputType?: string | null
    parentId?: string | null
    projectId?: string | null
    userId: string
  }): Promise<unknown> {
    if (args.fileId) {
      const file = await this.deps.repository.getFile({
        fileId: args.fileId,
        userId: args.userId,
      })
      if (!file || file.userId !== args.userId) {
        serviceError({ error: 'Not found' }, 404)
      }
      return file
    }

    const listArgs: Record<string, unknown> & { userId: string } = {
      userId: args.userId,
    }
    if (args.projectId !== null && args.projectId !== undefined) listArgs.projectId = args.projectId
    if (args.parentId !== null && args.parentId !== undefined) {
      listArgs.parentId = args.parentId === 'null' ? null : args.parentId
    }
    if (args.conversationId !== null && args.conversationId !== undefined) {
      listArgs.conversationId = args.conversationId
    }
    if (args.outputType !== null && args.outputType !== undefined) listArgs.outputType = args.outputType
    if (args.kind === 'folder' || args.kind === 'note' || args.kind === 'upload' || args.kind === 'output') {
      listArgs.kind = args.kind
    }
    return await this.deps.repository.listFiles(listArgs)
  }

  async createFile(args: {
    body: Record<string, unknown>
    userId: string
  }): Promise<{ id: unknown; ids?: string[]; parts?: number }> {
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
    } = args.body
    if (typeof name !== 'string') {
      serviceError({ error: 'name required' }, 400)
    }
    if (storageId) {
      serviceError(
        { error: 'Convex file storage is no longer supported. Upload to R2 and pass r2Key from the upload-url flow.' },
        400,
      )
    }

    const fileArgs: Record<string, unknown> & { userId: string; name: string } = {
      userId: args.userId,
      name,
    }
    if (typeof type === 'string') fileArgs.type = type
    if (kind === 'folder' || kind === 'note' || kind === 'upload' || kind === 'output') fileArgs.kind = kind
    if (parentId) fileArgs.parentId = parentId
    if (projectId) fileArgs.projectId = projectId
    if (typeof mimeType === 'string') fileArgs.mimeType = mimeType
    if (typeof extension === 'string') fileArgs.extension = extension
    if (typeof conversationId === 'string') fileArgs.conversationId = conversationId
    if (typeof turnId === 'string') fileArgs.turnId = turnId
    if (typeof modelId === 'string') fileArgs.modelId = modelId
    if (typeof prompt === 'string') fileArgs.prompt = prompt
    if (typeof outputType === 'string') fileArgs.outputType = outputType
    if (typeof legacyOutputId === 'string') fileArgs.legacyOutputId = legacyOutputId

    let id: unknown
    const ids: string[] = []

    if (r2Key) {
      id = await this.createFileFromR2Object({
        declaredSizeBytes: sizeBytes,
        fileArgs,
        kind,
        r2Key,
        userId: args.userId,
      })
    } else if (
      kind !== 'note' &&
      type === 'file' &&
      typeof (textContent ?? content) === 'string' &&
      String(textContent ?? content).length > 0
    ) {
      const fullText = String(textContent ?? content)
      const parts = splitTextForConvexDocuments(fullText)
      const total = parts.length
      for (let p = 0; p < parts.length; p++) {
        const part = parts[p]!
        const partName = partedFileName(name, p + 1, total)
        const partId = await this.deps.repository.createFile({
          ...fileArgs,
          name: partName,
          content: part,
          contentHash: hashTextContent(part),
        })
        if (!partId) {
          serviceError({ error: 'Failed to create file part' }, 500)
        }
        ids.push(partId)
      }
      id = ids[0]
    } else {
      if (typeof (textContent ?? content) === 'string' && String(textContent ?? content).length > 0) {
        const fullText = String(textContent ?? content)
        fileArgs.content = fullText
        fileArgs.contentHash = hashTextContent(fullText)
      }
      id = await this.deps.repository.createFile(fileArgs)
    }

    return {
      id,
      ids: ids.length ? ids : undefined,
      parts: ids.length || undefined,
    }
  }

  async updateFile(args: {
    body: Record<string, unknown>
    userId: string
  }): Promise<{ success: true }> {
    const { fileId, name, content, textContent, parentId, projectId } = args.body
    if (!fileId) serviceError({ error: 'fileId required' }, 400)
    const updateArgs: Record<string, unknown> & { fileId: string; userId: string } = {
      fileId: String(fileId),
      userId: args.userId,
    }
    if (name !== undefined) updateArgs.name = name
    if (parentId !== undefined) updateArgs.parentId = parentId || null
    if (projectId !== undefined) updateArgs.projectId = projectId || null
    if (typeof (textContent ?? content) === 'string') {
      const fullText = String(textContent ?? content)
      updateArgs.content = fullText
      updateArgs.contentHash = hashTextContent(fullText)
    } else if ((textContent ?? content) !== undefined) {
      updateArgs.content = textContent ?? content
    }
    await this.deps.repository.updateFile(updateArgs)
    return { success: true }
  }

  async deleteFile(args: {
    fileId?: string | null
    userId: string
  }): Promise<{ success: true }> {
    if (!args.fileId) serviceError({ error: 'fileId required' }, 400)
    const r2Entries = await this.deps.repository.getR2KeysForSubtree({
      fileId: args.fileId,
      userId: args.userId,
    })
    const r2Keys = (r2Entries ?? []).flatMap((entry) => {
      if (
        !entry.r2Key ||
        (!isOwnedFileR2Key(args.userId, entry.r2Key) && !isOwnedOutputR2Key(args.userId, entry.r2Key))
      ) {
        return []
      }
      return [entry.r2Key]
    })
    if (r2Keys.length > 0) {
      await this.storage.deleteObjects(r2Keys)
    }
    await this.deps.repository.removeFile({
      fileId: args.fileId,
      userId: args.userId,
      r2CleanupConfirmed: r2Keys.length > 0,
    })
    return { success: true }
  }

  async createUploadUrl(args: {
    mimeType?: string
    name?: string
    sizeBytes?: number
    userId: string
  }): Promise<{ uploadUrl: string; r2Key: string; expiresIn: number; maxSizeBytes: number }> {
    const normalizedSizeBytes = normalizedPositiveBytes(args.sizeBytes, {
      missing: 'sizeBytes is required',
    })
    await this.assertPresignedUploadAllowed({
      notEnoughStoragePayload: (remainingBytes) => ({
        error: 'Overlay storage limit reached.',
        message: `Not enough Overlay storage remaining. ${formatBytes(remainingBytes)} available, ${formatBytes(normalizedSizeBytes)} needed.`,
      }),
      sizeBytes: normalizedSizeBytes,
      userId: args.userId,
    })
    const resolvedMime = normalizeMimeType(args.mimeType)
    assertAllowedMimeType(resolvedMime)

    const fileName = args.name ?? `upload-${this.clock.now()}`
    const fileIdPlaceholder = `tmp-${this.clock.now()}-${this.clock.randomBytes(9).toString('base64url')}`
    const r2Key = this.storage.keyForFile(args.userId, fileIdPlaceholder, fileName)
    const expiresIn = this.storage.getR2PresignTtlSeconds()
    await this.deps.repository.cleanupExpiredUploadIntents({ userId: args.userId }).catch((error) => {
      console.warn('[FilesUploadUrl] Failed to clean expired upload intents', error)
    })
    await this.deps.repository.createUploadIntent({
      userId: args.userId,
      r2Key,
      declaredSizeBytes: normalizedSizeBytes,
      mimeType: resolvedMime,
      expiresAt: this.clock.now() + expiresIn * 1000,
    })
    const uploadUrl = await this.storage.generatePresignedUploadUrl(
      r2Key,
      resolvedMime,
      normalizedSizeBytes,
      expiresIn,
    )
    return { uploadUrl, r2Key, expiresIn, maxSizeBytes: normalizedSizeBytes }
  }

  async createPresignedUpload(args: {
    mimeType?: string | null
    name?: string | null
    sizeBytesRaw?: string | null
    userId: string
  }): Promise<{ r2Key: string; presignedUrl: string; expiresIn: number; maxSizeBytes: number }> {
    const mimeType = normalizeMimeType(args.mimeType)
    assertAllowedMimeType(mimeType)
    if (!args.name) serviceError({ error: 'name required' }, 400)
    if (!args.sizeBytesRaw || isNaN(Number(args.sizeBytesRaw))) {
      serviceError({ error: 'sizeBytes required' }, 400)
    }
    const sizeBytes = normalizedPositiveBytes(args.sizeBytesRaw, {
      missing: 'sizeBytes required',
      nonPositive: 'sizeBytes must be greater than 0',
    })
    await this.assertPresignedUploadAllowed({
      notEnoughStoragePayload: () => ({
        error: 'storage_limit_exceeded',
        message: 'Not enough Overlay storage remaining.',
      }),
      sizeBytes,
      userId: args.userId,
    })

    const fileIdPlaceholder = `tmp-${this.clock.now()}-${this.clock.randomBytes(9).toString('base64url')}`
    const r2Key = this.storage.keyForFile(args.userId, fileIdPlaceholder, args.name)
    const expiresIn = this.storage.getR2PresignTtlSeconds()
    await this.deps.repository.cleanupExpiredUploadIntents({ userId: args.userId }).catch((error) => {
      console.warn('[FilesPresign] Failed to clean expired upload intents', error)
    })
    await this.deps.repository.createUploadIntent({
      userId: args.userId,
      r2Key,
      declaredSizeBytes: sizeBytes,
      mimeType,
      expiresAt: this.clock.now() + expiresIn * 1000,
    })
    const presignedUrl = await this.storage.generatePresignedUploadUrl(r2Key, mimeType, sizeBytes, expiresIn)
    return { r2Key, presignedUrl, expiresIn, maxSizeBytes: sizeBytes }
  }

  async getContentProxy(args: {
    fileId: string
    userId: string
  }): Promise<ContentProxyResult> {
    const proxyTarget = await this.deps.repository.getStorageUrlForProxy(args)
    if (!proxyTarget) {
      return { kind: 'json', payload: { error: 'Not found' }, status: 404 }
    }

    if (proxyTarget.r2Key) {
      if (
        !isOwnedFileR2Key(args.userId, proxyTarget.r2Key) &&
        !isOwnedOutputR2Key(args.userId, proxyTarget.r2Key)
      ) {
        return { kind: 'json', payload: { error: 'Not found' }, status: 404 }
      }
      await this.deps.repository.recordFileBandwidth({
        userId: args.userId,
        bytes: proxyTarget.sizeBytes ?? 0,
      }).catch((error) => console.warn('[files/content] bandwidth accounting failed', error))
      const url = await this.storage.generatePresignedDownloadUrl(proxyTarget.r2Key)
      return { kind: 'redirect', url }
    }

    if (proxyTarget.url) {
      return { kind: 'upstream', url: proxyTarget.url }
    }

    return { kind: 'json', payload: { error: 'Not found' }, status: 404 }
  }

  async searchText(args: {
    accessToken?: string
    body: Record<string, unknown>
    userId: string
  }): Promise<{ success: true; matches: SearchTextMatchRow[]; truncated: boolean }> {
    const rawIds = Array.isArray(args.body.fileIds) ? args.body.fileIds : []
    const fileIds = dedupeFileIdsPreserveOrder(rawIds.map((id) => String(id)))
    if (fileIds.length === 0) {
      serviceError({ error: 'fileIds is required' }, 400)
    }
    if (fileIds.length > MAX_FILE_IDS_PER_REQUEST) {
      serviceError({ error: `At most ${MAX_FILE_IDS_PER_REQUEST} file ids per request` }, 400)
    }

    const query = typeof args.body.query === 'string' ? args.body.query.trim() : ''
    if (!query) {
      serviceError({ error: 'query is required' }, 400)
    }
    if (query.length > MAX_QUERY_CHARS) {
      serviceError({ error: `query too long (max ${MAX_QUERY_CHARS} characters)` }, 400)
    }

    const contextChars =
      typeof args.body.contextChars === 'number' &&
      args.body.contextChars >= 0 &&
      args.body.contextChars <= 2000
        ? Math.floor(args.body.contextChars)
        : DEFAULT_CONTEXT_CHARS
    const maxMatchesPerFile =
      typeof args.body.maxMatchesPerFile === 'number' &&
      args.body.maxMatchesPerFile >= 1 &&
      args.body.maxMatchesPerFile <= 200
        ? Math.floor(args.body.maxMatchesPerFile)
        : DEFAULT_MAX_MATCHES_PER_FILE
    const maxTotalSnippetChars =
      typeof args.body.maxTotalSnippetChars === 'number' &&
      args.body.maxTotalSnippetChars >= 1000 &&
      args.body.maxTotalSnippetChars <= 500_000
        ? Math.floor(args.body.maxTotalSnippetChars)
        : DEFAULT_MAX_TOTAL_SNIPPET_CHARS

    const matches: SearchTextMatchRow[] = []
    let truncated = false
    let remainingSnippetBudget = maxTotalSnippetChars

    for (const fileId of fileIds) {
      if (remainingSnippetBudget <= 0) {
        truncated = true
        break
      }
      const fileRow = await this.deps.repository.getFile({
        fileId,
        userId: args.userId,
        accessToken: args.accessToken,
      })

      if (!fileRow || fileRow.userId !== args.userId) {
        serviceError({ error: 'Invalid or inaccessible file id', fileId }, 403)
      }

      const content = fileRow.content ?? ''
      if (!content.trim() || isBinaryProxyContent(content)) {
        continue
      }

      const { matches: found, truncated: fileTrunc, snippetCharsUsed } = findSubstringMatchesInText({
        fullText: content,
        query,
        contextChars,
        maxMatches: maxMatchesPerFile,
        maxTotalSnippetChars: remainingSnippetBudget,
      })

      remainingSnippetBudget -= snippetCharsUsed
      if (fileTrunc) truncated = true
      if (remainingSnippetBudget <= 0 && found.length > 0) truncated = true

      found.forEach((m, i) => {
        matches.push({
          fileId,
          fileName: fileRow.name,
          matchIndexInFile: i,
          charStart: m.charStart,
          charEnd: m.charEnd,
          snippet: m.snippet,
        })
      })

      if (remainingSnippetBudget <= 0) break
    }

    return { success: true, matches, truncated }
  }

  async setShare(args: {
    fileId?: string
    origin: string
    userId: string
    visibility?: 'private' | 'public'
  }): Promise<{ visibility: 'private' | 'public'; token: string | null; url: string | null }> {
    if (!args.fileId) {
      serviceError({ error: 'fileId required' }, 400)
    }
    if (args.visibility !== 'private' && args.visibility !== 'public') {
      serviceError({ error: 'visibility must be "private" or "public"' }, 400)
    }
    const result = await this.deps.repository.setShare({
      fileId: args.fileId,
      userId: args.userId,
      visibility: args.visibility,
    })
    if (!result) {
      serviceError({ error: 'Failed to update share visibility' }, 500)
    }
    const base = args.origin.replace(/\/$/, '')
    return {
      visibility: result.visibility,
      token: result.token,
      url: result.token ? `${base}/share/f/${result.token}` : null,
    }
  }

  async ingestDocument(args: {
    file: File | null
    parentId?: string
    projectId?: string
    userId: string
  }): Promise<{ id: string | undefined; ids: string[]; name: string; parts: number }> {
    let uploadedR2Key: string | null = null
    let uploadedR2RetainedByFileRecord = false
    try {
      if (!(args.file instanceof File) || !args.file.name?.trim()) {
        serviceError({ error: 'file required' }, 400)
      }

      const safeName = args.file.name.replace(/[/\\]/g, '').slice(0, 240)
      const ext = extOf(safeName)

      if (args.file.size > MAX_INGEST_BYTES) {
        serviceError({ error: 'File too large (max 12MB)' }, 413)
      }

      if (!isPdf(args.file, ext) && !isDocx(args.file, ext) && !isTextLike(args.file, ext)) {
        serviceError(
          {
            error:
              'Unsupported format. Use PDF, Word (.docx), or text-based files (txt, md, csv, json, html, common code extensions).',
          },
          415,
        )
      }

      const buf = Buffer.from(await args.file.arrayBuffer())

      let text: string
      try {
        text = await extractTextFromBuffer(buf, args.file, ext)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg === 'FILE_TOO_LARGE') {
          serviceError({ error: 'File too large (max 12MB)' }, 413)
        }
        console.error('[ingest-document] extract:', error)
        serviceError({ error: 'Could not read document' }, 400)
      }

      if (!text.trim()) {
        serviceError({ error: 'No extractable text in file' }, 400)
      }

      const parts = splitTextForConvexDocuments(text)
      if (parts.length === 0) {
        serviceError({ error: 'No extractable text in file' }, 400)
      }

      const requiredStorageBytes = parts.reduce(
        (sum, part, index) => sum + (index === 0 ? Math.max(utf8ByteLength(part), buf.byteLength) : utf8ByteLength(part)),
        0,
      )
      await this.assertStorageEntitlements({
        notEnoughStoragePayload: (remainingBytes) => ({
          error: 'Overlay storage limit reached.',
          message: `Not enough Overlay storage remaining. ${formatBytes(remainingBytes)} available, ${formatBytes(requiredStorageBytes)} needed.`,
        }),
        sizeBytes: requiredStorageBytes,
        userId: args.userId,
      })

      await this.storage.checkGlobalR2Budget(buf.byteLength)

      const uploadKeyId = this.clock.randomUUID()
      const r2Key = this.storage.keyForFile(args.userId, uploadKeyId, safeName)
      const mimeType = args.file.type?.trim() || 'application/octet-stream'
      uploadedR2Key = r2Key
      await this.storage.uploadBuffer(r2Key, buf, mimeType)

      const ids: string[] = []
      const total = parts.length
      for (let p = 0; p < parts.length; p++) {
        const partName = partedFileName(safeName, p + 1, total)
        try {
          const created = await this.deps.repository.createFile({
            userId: args.userId,
            name: partName,
            type: 'file',
            content: parts[p],
            contentHash: hashTextContent(parts[p]!),
            projectId: sanitizeConvexIdParam(args.projectId),
            parentId: sanitizeConvexIdParam(args.parentId),
            ...(p === 0
              ? {
                  r2Key,
                  sizeBytesOverride: Math.max(0, Math.round(buf.byteLength)),
                }
              : {}),
          })
          if (!created) {
            await this.cleanupUploadedDocument(uploadedR2RetainedByFileRecord ? null : uploadedR2Key)
            serviceError({ error: 'Could not save indexed document.' }, 500)
          }
          if (p === 0) {
            uploadedR2RetainedByFileRecord = true
          }
          ids.push(created)
        } catch (error) {
          await this.cleanupUploadedDocument(uploadedR2RetainedByFileRecord ? null : uploadedR2Key)
          this.throwIngestCreateError(error)
        }
      }

      return { id: ids[0], ids, name: safeName, parts: total }
    } catch (error) {
      await this.cleanupUploadedDocument(uploadedR2RetainedByFileRecord ? null : uploadedR2Key)
      throw error
    }
  }

  private async createFileFromR2Object(args: {
    declaredSizeBytes: unknown
    fileArgs: Record<string, unknown> & { userId: string; name: string }
    kind: unknown
    r2Key: unknown
    userId: string
  }): Promise<unknown> {
    const r2Key = args.r2Key
    if (
      typeof r2Key !== 'string' ||
      (args.kind === 'output'
        ? !isOwnedOutputR2Key(args.userId, r2Key)
        : !isOwnedFileR2Key(args.userId, r2Key))
    ) {
      serviceError({ error: 'Invalid storage key' }, 400)
    }
    const objectHead = await this.storage.headObject(r2Key)
    if (!objectHead) {
      serviceError({ error: 'Uploaded object not found' }, 400)
    }
    const uploadIntent = args.kind === 'output'
      ? null
      : await this.deps.repository.getUploadIntent({
          userId: args.userId,
          r2Key,
          now: this.clock.now(),
        })
    if (args.kind !== 'output' && !uploadIntent) {
      await this.storage.deleteObjects([r2Key]).catch(() => {})
      serviceError({ error: 'Upload authorization expired or was not found' }, 400)
    }
    const declaredSize =
      uploadIntent?.declaredSizeBytes ??
      (typeof args.declaredSizeBytes === 'number' ? Math.max(0, Math.round(args.declaredSizeBytes)) : 0)
    const actualSize = Math.max(0, Math.round(objectHead.sizeBytes))
    if (declaredSize > 0 && actualSize > declaredSize) {
      await this.storage.deleteObjects([r2Key]).catch(() => {})
      await this.expireUploadIntentBestEffort(args.userId, uploadIntent)
      serviceError({ error: 'Uploaded object exceeds authorized size' }, 413)
    }
    await this.storage.checkGlobalR2Budget(actualSize)
    if (args.kind === 'output') {
      return await this.deps.repository.createFile({
        ...args.fileArgs,
        type: 'file',
        r2Key,
        sizeBytes: actualSize,
      })
    }

    const { type: _type, ...storageArgs } = args.fileArgs
    void _type
    let id: string | null
    try {
      id = await this.deps.repository.createFileWithStorage({
        ...storageArgs,
        r2Key,
        sizeBytes: actualSize,
      })
    } catch (error) {
      await this.storage.deleteObjects([r2Key]).catch(() => {})
      await this.expireUploadIntentBestEffort(args.userId, uploadIntent)
      throw error
    }
    if (!id) throw new Error('File create returned no id')
    if (uploadIntent) {
      await this.deps.repository.finalizeUploadIntent({
        userId: args.userId,
        r2Key,
        actualSizeBytes: actualSize,
        fileId: id,
        now: this.clock.now(),
      }).catch(async (error) => {
        console.warn('[FilesCreate] Uploaded file saved but upload intent finalization failed', error)
        await this.expireUploadIntentBestEffort(args.userId, uploadIntent)
      })
    }
    return id
  }

  private async assertPresignedUploadAllowed(args: {
    notEnoughStoragePayload: (remainingBytes: number) => Record<string, unknown>
    sizeBytes: number
    userId: string
  }): Promise<void> {
    const maxPresignedUploadBytes = this.storage.getMaxPresignedUploadBytes()
    if (args.sizeBytes > maxPresignedUploadBytes) {
      serviceError({
        error: 'File is too large for direct upload.',
        message: `Direct uploads are limited to ${formatBytes(maxPresignedUploadBytes)} per file.`,
      }, 413)
    }
    await this.assertStorageEntitlements(args)
    await this.storage.checkGlobalR2Budget(args.sizeBytes)
  }

  private async assertStorageEntitlements(args: {
    notEnoughStoragePayload: (remainingBytes: number) => Record<string, unknown>
    sizeBytes: number
    userId: string
  }): Promise<void> {
    const entitlements = await this.deps.repository.getStorageEntitlements({ userId: args.userId })
    if (!entitlements) {
      serviceError({ error: 'Could not verify subscription.' }, 401)
    }
    if (entitlements.overlayStorageBytesUsed + args.sizeBytes > entitlements.overlayStorageBytesLimit) {
      const remainingBytes = Math.max(0, entitlements.overlayStorageBytesLimit - entitlements.overlayStorageBytesUsed)
      serviceError(args.notEnoughStoragePayload(remainingBytes), 403)
    }
  }

  private async cleanupUploadedDocument(r2Key: string | null): Promise<void> {
    if (!r2Key) return
    await this.storage.deleteObject(r2Key).catch((error) => {
      console.warn(`[ingest-document] failed to delete orphaned R2 object key=${r2Key}`, error)
    })
  }

  private async expireUploadIntentBestEffort(
    userId: string,
    uploadIntent: FileUploadIntentRecord | null | undefined,
  ): Promise<void> {
    if (!uploadIntent) return
    await this.deps.repository.expireUploadIntent({
      userId,
      intentId: uploadIntent._id,
      now: this.clock.now(),
    }).catch(() => {})
  }

  private throwIngestCreateError(error: unknown): never {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[ingest-document] files:create:', error)
    if (/unauthorized/i.test(msg)) {
      serviceError(
        {
          error:
            'Cannot attach this document to the selected project. Check project access or open chat without an invalid project link.',
        },
        403,
      )
    }
    if (/storage|quota|limit exceeded/i.test(msg)) {
      serviceError({ error: 'Overlay storage limit reached.' }, 403)
    }
    if (/Value is too large|maximum size/i.test(msg)) {
      serviceError(
        { error: 'Document section is too large to index. Try splitting it into smaller text files.' },
        413,
      )
    }
    serviceError({ error: 'Could not save indexed document. Try again.' }, 500)
  }
}
