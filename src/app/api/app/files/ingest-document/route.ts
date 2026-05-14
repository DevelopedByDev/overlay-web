import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { convex } from '@/lib/convex'
import { hashTextContent, partedFileName, splitTextForConvexDocuments } from '@/lib/convex-file-content'
import { deleteObject, keyForFile, uploadBuffer } from '@/lib/r2'
import { checkGlobalR2Budget, R2GlobalBudgetError } from '@/lib/r2-budget'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'
import { formatBytes } from '@/lib/storage-limits'
import type { Id } from '../../../../../../convex/_generated/dataModel'

export const runtime = 'nodejs'

const MAX_BYTES = 12 * 1024 * 1024
const utf8Encoder = new TextEncoder()

interface Entitlements {
  overlayStorageBytesUsed: number
  overlayStorageBytesLimit: number
}

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

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

function utf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).length
}

async function cleanupUploadedDocument(r2Key: string | null) {
  if (!r2Key) return
  await deleteObject(r2Key).catch((error) => {
    console.warn(`[ingest-document] failed to delete orphaned R2 object key=${r2Key}`, error)
  })
}

/** Reject junk query params so Convex `db.get` never sees malformed ids. */
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

/**
 * Use `lib/pdf-parse.js` only — the package root `index.js` runs a debug harness when `module.parent`
 * is missing (common under Next/webpack), which tries to read a non-existent test file and throws ENOENT.
 */
async function parsePdfBuffer(buf: Buffer): Promise<string> {
  const mod = await import('pdf-parse/lib/pdf-parse.js')
  const parsePdf = mod.default
  const data = await parsePdf(buf)
  return (data.text ?? '').trim()
}

async function extractTextFromBuffer(buf: Buffer, file: File, ext: string): Promise<string> {
  if (buf.length > MAX_BYTES) {
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

export async function POST(request: NextRequest) {
  let uploadedR2Key: string | null = null
  let uploadedR2RetainedByFileRecord = false
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'files:ingest-document:ip', key: getClientIp(request), limit: 40, windowMs: 60 * 60_000 },
      { bucket: 'files:ingest-document:user', key: auth.userId, limit: 20, windowMs: 60 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    let form: FormData
    try {
      form = await request.formData()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('Failed to parse body as FormData') || msg.includes('exceeded') || msg.includes('payload')) {
        return NextResponse.json(
          { error: 'File too large. Maximum upload size is 12 MB.' },
          { status: 413 },
        )
      }
      throw e
    }

    const raw = form.get('file')
    const projectId = sanitizeConvexIdParam(
      typeof form.get('projectId') === 'string' ? (form.get('projectId') as string) : undefined,
    )
    const parentId = sanitizeConvexIdParam(
      typeof form.get('parentId') === 'string' ? (form.get('parentId') as string) : undefined,
    )

    const serverSecret = getInternalApiSecret()

    if (!(raw instanceof File) || !raw.name?.trim()) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }

    const safeName = raw.name.replace(/[/\\]/g, '').slice(0, 240)
    const ext = extOf(safeName)

    if (raw.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 12MB)' }, { status: 413 })
    }

    if (!isPdf(raw, ext) && !isDocx(raw, ext) && !isTextLike(raw, ext)) {
      return NextResponse.json(
        {
          error:
            'Unsupported format. Use PDF, Word (.docx), or text-based files (txt, md, csv, json, html, common code extensions).',
        },
        { status: 415 },
      )
    }

    const buf = Buffer.from(await raw.arrayBuffer())

    let text: string
    try {
      text = await extractTextFromBuffer(buf, raw, ext)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'FILE_TOO_LARGE') {
        return NextResponse.json({ error: 'File too large (max 12MB)' }, { status: 413 })
      }
      console.error('[ingest-document] extract:', e)
      return NextResponse.json({ error: 'Could not read document' }, { status: 400 })
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'No extractable text in file' }, { status: 400 })
    }

    const parts = splitTextForConvexDocuments(text)
    if (parts.length === 0) {
      return NextResponse.json({ error: 'No extractable text in file' }, { status: 400 })
    }

    const requiredStorageBytes = parts.reduce(
      (sum, part, index) => sum + (index === 0 ? Math.max(utf8ByteLength(part), buf.byteLength) : utf8ByteLength(part)),
      0,
    )
    const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
      userId: auth.userId,
      serverSecret,
    }, { throwOnError: true })
    if (!entitlements) {
      return NextResponse.json({ error: 'Could not verify subscription.' }, { status: 401 })
    }
    if (entitlements.overlayStorageBytesUsed + requiredStorageBytes > entitlements.overlayStorageBytesLimit) {
      const remainingBytes = Math.max(0, entitlements.overlayStorageBytesLimit - entitlements.overlayStorageBytesUsed)
      return NextResponse.json({
        error: 'Overlay storage limit reached.',
        message: `Not enough Overlay storage remaining. ${formatBytes(remainingBytes)} available, ${formatBytes(requiredStorageBytes)} needed.`,
      }, { status: 403 })
    }

    await checkGlobalR2Budget(buf.byteLength)

    const uploadKeyId = randomUUID()
    const r2Key = keyForFile(auth.userId, uploadKeyId, safeName)
    const mimeType = raw.type?.trim() || 'application/octet-stream'
    uploadedR2Key = r2Key
    await uploadBuffer(r2Key, buf, mimeType)

    const ids: string[] = []
    const total = parts.length
    for (let p = 0; p < parts.length; p++) {
      const partName = partedFileName(safeName, p + 1, total)
      let fid: Id<'files'>
      try {
        const created = await convex.mutation<Id<'files'>>(
          'files:create',
          {
            userId: auth.userId,
            serverSecret,
            name: partName,
            type: 'file',
            content: parts[p],
            contentHash: hashTextContent(parts[p]!),
            projectId,
            parentId,
            ...(p === 0
              ? {
                  r2Key,
                  sizeBytesOverride: Math.max(0, Math.round(buf.byteLength)),
                }
              : {}),
          },
          { throwOnError: true },
        )
        if (!created) {
          await cleanupUploadedDocument(uploadedR2RetainedByFileRecord ? null : uploadedR2Key)
          return NextResponse.json({ error: 'Could not save indexed document.' }, { status: 500 })
        }
        fid = created
        if (p === 0) {
          uploadedR2RetainedByFileRecord = true
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[ingest-document] files:create:', e)
        await cleanupUploadedDocument(uploadedR2RetainedByFileRecord ? null : uploadedR2Key)
        if (/unauthorized/i.test(msg)) {
          return NextResponse.json(
            {
              error:
                'Cannot attach this document to the selected project. Check project access or open chat without an invalid project link.',
            },
            { status: 403 },
          )
        }
        if (/storage|quota|limit exceeded/i.test(msg)) {
          return NextResponse.json({ error: 'Overlay storage limit reached.' }, { status: 403 })
        }
        if (/Value is too large|maximum size/i.test(msg)) {
          return NextResponse.json(
            { error: 'Document section is too large to index. Try splitting it into smaller text files.' },
            { status: 413 },
          )
        }
        return NextResponse.json({ error: 'Could not save indexed document. Try again.' }, { status: 500 })
      }
      ids.push(fid)
    }

    return NextResponse.json({ id: ids[0], ids, name: safeName, parts: total })
  } catch (error) {
    await cleanupUploadedDocument(uploadedR2RetainedByFileRecord ? null : uploadedR2Key)
    if (error instanceof R2GlobalBudgetError) {
      return NextResponse.json({ error: 'Overlay storage limit reached.' }, { status: 403 })
    }
    if (error instanceof Error && error.message.includes('storage_limit_exceeded')) {
      return NextResponse.json({ error: 'Overlay storage limit reached.' }, { status: 403 })
    }
    if (error instanceof Error && error.message.includes('INTERNAL_API_SECRET')) {
      console.error('[ingest-document] missing INTERNAL_API_SECRET')
      return NextResponse.json({ error: 'Server configuration error (auth secret).' }, { status: 503 })
    }
    if (error instanceof Error && error.message.includes('[R2]')) {
      console.error('[ingest-document] R2 misconfiguration:', error.message)
      return NextResponse.json({ error: 'File storage is not available.' }, { status: 503 })
    }
    console.error('[ingest-document]', error)
    return NextResponse.json({ error: 'Failed to ingest document' }, { status: 500 })
  }
}
