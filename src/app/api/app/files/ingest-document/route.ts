import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { hashTextContent, partedFileName, splitTextForConvexDocuments } from '@/lib/convex-file-content'
import type { Id } from '../../../../../../convex/_generated/dataModel'

export const runtime = 'nodejs'

const MAX_BYTES = 12 * 1024 * 1024

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

async function extractText(file: File, ext: string): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer())
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
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await request.formData()
    const raw = form.get('file')
    const projectIdRaw = form.get('projectId')
    const projectId =
      typeof projectIdRaw === 'string' && projectIdRaw.trim() ? projectIdRaw.trim() : undefined
    const parentIdRaw = form.get('parentId')
    const parentId =
      typeof parentIdRaw === 'string' && parentIdRaw.trim() ? parentIdRaw.trim() : undefined

    if (!projectId && parentId === undefined) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
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

    let text: string
    try {
      text = await extractText(raw, ext)
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
    const ids: string[] = []
    const total = parts.length
    for (let p = 0; p < parts.length; p++) {
      const partName = partedFileName(safeName, p + 1, total)
      const fid = await convex.mutation<Id<'files'>>('files:create', {
        userId: session.user.id,
        serverSecret,
        name: partName,
        type: 'file',
        content: parts[p],
        contentHash: hashTextContent(parts[p]!),
        projectId,
        parentId,
      })
      if (!fid) {
        return NextResponse.json({ error: 'Failed to save document part' }, { status: 500 })
      }
      ids.push(fid)
    }

    return NextResponse.json({ id: ids[0], ids, name: safeName, parts: total })
  } catch (error) {
    if (error instanceof Error && error.message.includes('storage_limit_exceeded')) {
      return NextResponse.json({ error: 'Overlay storage limit reached.' }, { status: 403 })
    }
    console.error('[ingest-document]', error)
    return NextResponse.json({ error: 'Failed to ingest document' }, { status: 500 })
  }
}
