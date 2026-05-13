'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, Music, FileQuestion, Download, Loader2, FileType } from 'lucide-react'
import { safeHttpUrl } from '@/lib/safe-url'

// ─── Type detection ───────────────────────────────────────────────────────────

export type FileViewerType =
  | 'text' | 'markdown' | 'csv'
  | 'image' | 'audio' | 'video' | 'pdf'
  | 'document'
  | 'binary'

export function getFileType(filename: string): FileViewerType {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['md', 'markdown'].includes(ext)) return 'markdown'
  if (['txt', 'log', 'sh', 'py', 'js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'xml', 'yaml', 'yml', 'toml', 'go', 'rs', 'java', 'c', 'cpp', 'h'].includes(ext)) return 'text'
  if (['csv'].includes(ext)) return 'csv'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext)) return 'image'
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'].includes(ext)) return 'audio'
  if (['mp4', 'mov', 'mkv', 'webm', 'avi', 'ogv', 'm4v'].includes(ext)) return 'video'
  if (['pdf'].includes(ext)) return 'pdf'
  if (['docx', 'doc'].includes(ext)) return 'document'
  return 'binary'
}

export function isEditableType(filename: string): boolean {
  const type = getFileType(filename)
  return type === 'text' || type === 'markdown'
}

export function isPreviewableType(filename: string): boolean {
  const type = getFileType(filename)
  return type !== 'binary'
}

/** Read a File object as the right content string (text or base64 data URL) */
export async function readFileAsContent(file: File): Promise<string> {
  const type = getFileType(file.name)
  if (type === 'text' || type === 'markdown' || type === 'csv') {
    return file.text()
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── CSV renderer ─────────────────────────────────────────────────────────────

/** RFC 4180-style: commas/newlines inside `"..."` stay in one cell. */
function parseCSV(raw: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQ = false
  const s = raw.replace(/^\uFEFF/, '')

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQ = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQ = true
    } else if (ch === ',') {
      row.push(cur)
      cur = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(cur)
      cur = ''
      if (row.some((c) => c.length > 0) || row.length > 1) {
        rows.push(row)
      }
      row = []
    } else {
      cur += ch
    }
  }
  row.push(cur)
  if (row.some((c) => c.length > 0) || row.length > 1) {
    rows.push(row)
  }
  return rows
}

const proseMarkdown =
  'prose prose-sm max-w-2xl text-[var(--foreground)] prose-headings:font-semibold prose-headings:text-[var(--foreground)] prose-p:text-[var(--foreground)] prose-li:text-[var(--foreground)] prose-strong:text-[var(--foreground)] prose-a:text-blue-600 dark:prose-a:text-sky-400 prose-code:rounded prose-code:bg-[var(--surface-subtle)] prose-code:px-1 prose-code:text-[var(--foreground)] prose-pre:bg-[var(--surface-subtle)] prose-pre:text-[var(--foreground)] prose-blockquote:border-[var(--border)] prose-blockquote:text-[var(--muted)]'

// ─── Async binary viewers ─────────────────────────────────────────────────────

function DocumentViewer({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load (${r.status})`)
        return r.arrayBuffer()
      })
      .then(async (buf) => {
        const mammoth = await import('mammoth')
        const DOMPurify = (await import('dompurify')).default
        const result = await mammoth.convertToHtml({ arrayBuffer: buf })
        if (!cancelled) {
          setHtml(DOMPurify.sanitize(result.value, {
            USE_PROFILES: { html: true },
            FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
          }))
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [url])

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-[var(--muted)]">
        <Loader2 size={24} className="animate-spin" />
        <p className="text-xs">Loading document…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-[var(--muted)]">
        <FileType size={28} />
        <p className="text-sm font-medium text-[var(--foreground)]">Could not load document</p>
        <p className="text-xs text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div
        className="prose prose-sm max-w-3xl text-[var(--foreground)] prose-headings:font-semibold prose-headings:text-[var(--foreground)] prose-p:text-[var(--foreground)] prose-li:text-[var(--foreground)] prose-strong:text-[var(--foreground)] prose-a:text-blue-600 dark:prose-a:text-sky-400 prose-code:rounded prose-code:bg-[var(--surface-subtle)] prose-code:px-1 prose-code:text-[var(--foreground)] prose-pre:bg-[var(--surface-subtle)] prose-pre:text-[var(--foreground)] prose-blockquote:border-[var(--border)] prose-blockquote:text-[var(--muted)]"
        dangerouslySetInnerHTML={{ __html: html ?? '' }}
      />
    </div>
  )
}

// ─── FileViewer ───────────────────────────────────────────────────────────────

export function FileViewer({ name, content, url }: { name: string; content: string; url?: string }) {
  const type = getFileType(name)

  if (type === 'markdown') {
    return (
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className={proseMarkdown}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    )
  }

  if (type === 'text') {
    return (
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <pre className="text-sm leading-relaxed font-mono whitespace-pre-wrap text-[var(--foreground)]">
          {content}
        </pre>
      </div>
    )
  }

  if (type === 'csv') {
    const rows = parseCSV(content)
    const headers = rows[0] ?? []
    const body = rows.slice(1)
    return (
      <div className="flex-1 overflow-auto px-4 py-4">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="whitespace-nowrap border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-left font-medium text-[var(--foreground)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? '' : 'bg-[var(--surface-subtle)]/50'}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="max-w-md whitespace-pre-wrap break-words border border-[var(--border)] px-3 py-1.5 align-top text-[var(--muted)]"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (type === 'image') {
    return (
      <div className="flex flex-1 items-center justify-center overflow-auto bg-[var(--surface-subtle)] p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={content} alt={name} className="max-h-full max-w-full rounded-lg object-contain shadow-sm" />
      </div>
    )
  }

  if (type === 'audio') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-subtle)]">
          <Music size={28} className="text-[var(--muted)]" />
        </div>
        <p className="text-sm font-medium text-[var(--foreground)]">{name}</p>
        <audio controls src={content} className="w-full max-w-lg" />
      </div>
    )
  }

  if (type === 'video') {
    return (
      <div className="flex flex-1 items-center justify-center overflow-hidden bg-black p-4">
        <video controls src={content} className="max-h-full max-w-full" />
      </div>
    )
  }

  if (type === 'pdf') {
    const c = (content.trim() || url || '').trim()
    const isIframeSrc =
      c.startsWith('http://') ||
      c.startsWith('https://') ||
      c.startsWith('data:') ||
      c.startsWith('blob:') ||
      c.startsWith('/api/')
    if (isIframeSrc) {
      return (
        <div className="flex-1 overflow-hidden">
          <iframe src={c} className="h-full w-full border-none" title={name} />
        </div>
      )
    }
    return (
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <p className="mb-4 max-w-2xl text-xs text-[var(--muted)]">
          This PDF is stored as extracted text for search and the notebook (not the original layout).
        </p>
        <pre className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
          {content}
        </pre>
      </div>
    )
  }

  if (type === 'document' && url) {
    return <DocumentViewer url={url} />
  }

  // binary fallback
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const labels: Record<string, string> = {
    docx: 'Word Document', doc: 'Word Document',
    xlsx: 'Excel Spreadsheet', xls: 'Excel Spreadsheet',
    pptx: 'PowerPoint Presentation', ppt: 'PowerPoint Presentation',
    epub: 'EPUB Book',
    zip: 'ZIP Archive', gz: 'GZip Archive', tar: 'TAR Archive',
  }
  const downloadUrl = safeHttpUrl(url) || (content.startsWith('/api/') ? content : undefined)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-[var(--muted)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-subtle)]">
        {labels[ext] ? (
          <FileText size={28} className="text-[var(--muted)]" />
        ) : (
          <FileQuestion size={28} className="text-[var(--muted)]" />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--foreground)]">{name}</p>
        <p className="mt-1 text-xs text-[var(--muted-light)]">{labels[ext] ?? 'Binary file'} — preview not available</p>
      </div>
      {downloadUrl && (
        <a
          href={downloadUrl}
          download={name}
          className="flex items-center gap-1.5 rounded-md bg-[var(--foreground)] px-3 py-1.5 text-xs text-[var(--background)] transition-opacity hover:opacity-90"
        >
          <Download size={12} />
          Download
        </a>
      )}
    </div>
  )
}

// ─── Standalone file viewer with header (for project/knowledge views) ─────────

export function FileViewerPanel({
  name,
  content,
  url,
  isSaving,
  isEditable,
  onContentChange,
  headerRight,
}: {
  name: string
  content: string
  url?: string
  isSaving?: boolean
  isEditable?: boolean
  onContentChange?: (val: string) => void
  headerRight?: React.ReactNode
}) {
  const type = getFileType(name)
  const editable = isEditable && (type === 'text' || type === 'markdown') && onContentChange

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-6">
        <span className="truncate text-sm font-medium text-[var(--foreground)]">{name}</span>
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--muted-light)]">Saving...</span>
          )}
          {headerRight}
        </div>
      </div>
      {editable ? (
        <>
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="Start typing..."
            className="min-h-0 flex-1 resize-none bg-[var(--background)] px-8 py-6 font-mono text-sm leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-light)]"
          />
          <div className="shrink-0 border-t border-[var(--border)] px-8 py-2 text-[11px] text-[var(--muted-light)]">
            Reference in chat with{' '}
            <code className="rounded bg-[var(--surface-subtle)] px-1 py-0.5 font-mono text-[var(--foreground)]">
              @{name}
            </code>
          </div>
        </>
      ) : (
        <FileViewer name={name} content={content} url={url} />
      )}
    </div>
  )
}
