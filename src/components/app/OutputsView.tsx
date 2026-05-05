'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ImageIcon,
  Video,
  Download,
  RefreshCw,
  AlertCircle,
  Clock,
  Info,
  X,
  FileText,
  Archive,
  Code2,
  Music2,
  FileIcon,
  Trash2,
} from 'lucide-react'
import {
  defaultDownloadName,
  isMediaOutputType,
  type OutputSource,
  type OutputType,
} from '@/lib/output-types'
import { OutputCardSkeleton, OutputListRowSkeleton } from '@/components/ui/Skeleton'

interface Output {
  _id: string
  type: OutputType
  source?: OutputSource
  status: 'pending' | 'completed' | 'failed'
  prompt: string
  modelId: string
  url?: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
  metadata?: Record<string, unknown>
  errorMessage?: string
  createdAt: number
  completedAt?: number
}

interface CanonicalOutputFile {
  _id: string
  kind?: 'output'
  name?: string
  outputType?: string
  prompt?: string
  modelId?: string
  downloadUrl?: string
  mimeType?: string
  sizeBytes?: number
  createdAt?: number
  updatedAt?: number
  indexStatus?: string
}

function canonicalFileToOutput(file: CanonicalOutputFile): Output {
  const type = (file.outputType || 'document') as OutputType
  return {
    _id: file._id,
    type,
    status: 'completed',
    prompt: file.prompt || file.name || 'Generated output',
    modelId: file.modelId || '',
    url: file.downloadUrl,
    fileName: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    metadata: {},
    createdAt: file.createdAt ?? file.updatedAt ?? Date.now(),
    completedAt: file.updatedAt ?? file.createdAt ?? Date.now(),
  }
}

type FilterType = 'all' | 'image' | 'video' | 'files'

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatBytes(value?: number): string {
  if (!value || value <= 0) return 'Unknown size'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function outputLabel(output: Output): string {
  return output.fileName?.trim() || output.prompt || 'Generated output'
}

function OutputTypeIcon({
  type,
  size,
  className,
}: {
  type: OutputType
  size: number
  className?: string
}) {
  if (type === 'audio') return <Music2 size={size} className={className} />
  if (type === 'archive') return <Archive size={size} className={className} />
  if (type === 'code') return <Code2 size={size} className={className} />
  if (type === 'document' || type === 'text') return <FileText size={size} className={className} />
  if (type === 'image') return <ImageIcon size={size} className={className} />
  if (type === 'video') return <Video size={size} className={className} />
  return <FileIcon size={size} className={className} />
}

function OutputListRow({
  output,
  onExpand,
  onDetails,
  onDelete,
  isDeleting,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: {
  output: Output
  onExpand: () => void
  onDetails: () => void
  onDelete: () => void
  isDeleting: boolean
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}) {
  const isCompleted = output.status === 'completed'
  const isFailed = output.status === 'failed'
  const isPending = output.status === 'pending'
  const isMedia = isMediaOutputType(output.type)

  return (
    <div
      role={selectionMode ? 'button' : undefined}
      tabIndex={selectionMode ? 0 : undefined}
      onClick={() => selectionMode && onToggleSelect?.()}
      onKeyDown={
        selectionMode
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggleSelect?.()
              }
            }
          : undefined
      }
      className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
        selectionMode
          ? `cursor-pointer rounded-lg border border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-muted)] ${
              selected ? 'border-[var(--border)] bg-[var(--surface-muted)]' : ''
            }`
          : 'rounded-lg border border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-muted)]'
      }`}
    >
      {selectionMode ? (
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border)] ${
            selected ? 'border-[var(--foreground)] bg-[var(--foreground)]' : 'bg-[var(--surface-elevated)]'
          }`}
          aria-hidden
        >
          {selected ? <span className="text-[10px] leading-none text-[var(--background)]">✓</span> : null}
        </span>
      ) : null}
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-muted)]">
        {isCompleted && output.url && output.type === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={output.url} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        {isCompleted && output.url && output.type === 'video' && (
          <video src={output.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
        )}
        {isCompleted && !isMedia && (
          <div className="flex h-full w-full items-center justify-center">
            <OutputTypeIcon type={output.type} size={20} className="text-[var(--muted-light)]" />
          </div>
        )}
        {(isPending || (isCompleted && isMedia && !output.url)) && isMedia && (
          <div
            className="media-gen-mesh absolute inset-0 z-[1] rounded-lg border border-[var(--border)] !min-h-0 !min-w-0"
            aria-hidden
          />
        )}
        {(isPending || (isCompleted && isMedia && !output.url)) && !isMedia && (
          <div className="relative z-[1] flex h-full w-full items-center justify-center">
            <div className="ui-skeleton-mesh h-8 w-8 !min-h-0 rounded-md" aria-hidden />
          </div>
        )}
        {isFailed && (
          <div className="flex h-full w-full items-center justify-center text-red-400">
            <AlertCircle size={16} />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (selectionMode) {
            onToggleSelect?.()
            return
          }
          if (isCompleted && isMedia) onExpand()
        }}
        className="min-w-0 flex-1 text-left"
      >
        <p className="line-clamp-1 text-sm text-[var(--foreground)]">{outputLabel(output)}</p>
        <p className="mt-0.5 text-[11px] text-[var(--muted-light)]">
          <span className="inline-flex items-center gap-1">
            <OutputTypeIcon type={output.type} size={10} />
            {output.type}
          </span>
          <span className="mx-1.5">·</span>
          {timeAgo(output.createdAt)}
          {output.sizeBytes ? ` · ${formatBytes(output.sizeBytes)}` : ''}
        </p>
      </button>
      {!selectionMode ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDetails()
            }}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
          >
            <Info size={12} />
            Details
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="inline-flex items-center justify-center rounded-md border border-[var(--border)] p-1 text-[var(--muted)] transition-colors hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
          >
            {isDeleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function OutputsView({
  embedded = false,
  layout = 'cards',
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}: {
  /** When true, hide the page title row (parent provides chrome). */
  embedded?: boolean
  /** List vs masonry cards — typically from URL `layout` on Knowledge. */
  layout?: 'list' | 'cards'
  /** Bulk selection (Knowledge header). */
  selectionMode?: boolean
  selectedIds?: ReadonlySet<string>
  onToggleSelect?: (outputId: string) => void
}) {
  const searchParams = useSearchParams()
  const v = embedded ? searchParams?.get('out') : searchParams?.get('view')
  const filter: FilterType = v === 'image' || v === 'video' || v === 'files' ? v : 'all'

  const [outputs, setOutputs] = useState<Output[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<Output | null>(null)
  const [detailsOutput, setDetailsOutput] = useState<Output | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(outputId: string) {
    setDeletingId(outputId)
    try {
      await fetch(`/api/app/files?fileId=${encodeURIComponent(outputId)}`, { method: 'DELETE' })
      setOutputs((prev) => prev.filter((o) => o._id !== outputId))
      if (lightbox?._id === outputId) setLightbox(null)
      if (detailsOutput?._id === outputId) setDetailsOutput(null)
    } finally {
      setDeletingId(null)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (filter === 'image' || filter === 'video') {
        params.set('kind', 'output')
      } else {
        params.set('kind', 'output')
      }
      const res = await fetch(`/api/app/files?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const rows = (await res.json()) as CanonicalOutputFile[]
      setOutputs(rows.map(canonicalFileToOutput))
    } catch {
      setError('Failed to load outputs.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = outputs.filter((output) => {
    if (filter === 'all') return true
    if (filter === 'files') return !isMediaOutputType(output.type)
    return output.type === filter
  })

  return (
    <div className={`flex flex-col min-h-0 flex-1 ${embedded ? '' : 'h-full'}`}>
      {!embedded && (
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium text-[var(--foreground)]">Outputs</h1>
            <span className="text-xs text-[var(--muted-light)]">{filtered.length} items</span>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${embedded ? 'px-0 py-0' : 'px-4 py-5 sm:px-6 sm:py-6'}`}>
        {loading && outputs.length === 0 && (
          <div className="mx-auto w-full max-w-3xl py-2">
            {layout === 'list' ? (
              <div className="space-y-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <OutputListRowSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="mx-auto w-full max-w-[1440px] columns-1 [column-gap:1rem] sm:columns-2 lg:columns-3 xl:columns-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <OutputCardSkeleton key={i} />
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            {filter === 'video' ? (
              <Video size={32} className="text-[var(--muted-light)]" />
            ) : filter === 'files' ? (
              <FileText size={32} className="text-[var(--muted-light)]" />
            ) : (
              <ImageIcon size={32} className="text-[var(--muted-light)]" />
            )}
            <p className="text-sm text-[var(--muted)]">No {filter === 'all' ? '' : `${filter} `}outputs yet</p>
            <p className="text-xs text-[var(--muted-light)]">Generated media and sandbox artifacts will appear here</p>
          </div>
        )}

        {filtered.length > 0 && layout === 'list' && (
          <div className="mx-auto w-full max-w-3xl space-y-0.5">
            {filtered.map((output) => (
              <OutputListRow
                key={output._id}
                output={output}
                onExpand={() => setLightbox(output)}
                onDetails={() => setDetailsOutput(output)}
                onDelete={() => handleDelete(output._id)}
                isDeleting={deletingId === output._id}
                selectionMode={selectionMode}
                selected={Boolean(selectedIds?.has(output._id))}
                onToggleSelect={onToggleSelect ? () => onToggleSelect(output._id) : undefined}
              />
            ))}
          </div>
        )}

        {filtered.length > 0 && layout === 'cards' && (
          <div className="mx-auto w-full max-w-[1440px] columns-1 [column-gap:1rem] sm:columns-2 lg:columns-3 xl:columns-4">
            {filtered.map((output) => (
              <OutputCard
                key={output._id}
                output={output}
                onExpand={() => setLightbox(output)}
                onDetails={() => setDetailsOutput(output)}
                onDelete={() => handleDelete(output._id)}
                isDeleting={deletingId === output._id}
                selectionMode={selectionMode}
                selected={Boolean(selectedIds?.has(output._id))}
                onToggleSelect={onToggleSelect ? () => onToggleSelect(output._id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {lightbox && isMediaOutputType(lightbox.type) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.type === 'image' && lightbox.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.url} alt={outputLabel(lightbox)} className="max-h-[80vh] object-contain" />
            )}
            {lightbox.type === 'video' && lightbox.url && (
              <video src={lightbox.url} controls className="max-h-[80vh] max-w-full" />
            )}
            <div className="space-y-1 p-4">
              <div className="flex items-start gap-3">
                <p className="min-w-0 flex-1 line-clamp-2 text-sm text-[var(--foreground)]">{outputLabel(lightbox)}</p>
                <button
                  type="button"
                  onClick={() => setDetailsOutput(lightbox)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
                >
                  <Info size={12} />
                  Details
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                <span>{lightbox.fileName || lightbox.modelId}</span>
                <span><Clock size={10} className="mr-0.5 inline" />{timeAgo(lightbox.createdAt)}</span>
                {lightbox.url && (
                  <a
                    href={lightbox.url}
                    download={defaultDownloadName(lightbox)}
                    className="flex items-center gap-1 transition-colors hover:text-[var(--foreground)]"
                  >
                    <Download size={10} /> Download
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {detailsOutput && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/25" onClick={() => setDetailsOutput(null)}>
          <div
            className="h-full w-full max-w-md overflow-y-auto border-l border-[var(--border)] bg-[var(--surface-elevated)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div>
                <h2 className="text-sm font-medium text-[var(--foreground)]">Output details</h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {detailsOutput.source === 'sandbox' ? 'Sandbox artifact' : `${detailsOutput.type} generation`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOutput(null)}
                className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-5 px-5 py-5">
              <section className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Prompt</p>
                <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-sm leading-relaxed text-[var(--foreground)]">
                  {detailsOutput.prompt}
                </p>
              </section>
              <section className="grid grid-cols-2 gap-3">
                <DetailItem label="File name" value={detailsOutput.fileName || 'Not set'} />
                <DetailItem label="Model" value={detailsOutput.modelId} />
                <DetailItem label="Status" value={detailsOutput.status} />
                <DetailItem label="Type" value={detailsOutput.type} />
                <DetailItem label="MIME type" value={detailsOutput.mimeType || 'Unknown'} />
                <DetailItem label="Size" value={formatBytes(detailsOutput.sizeBytes)} />
                <DetailItem label="Created" value={new Date(detailsOutput.createdAt).toLocaleString()} />
                <DetailItem
                  label="Completed"
                  value={detailsOutput.completedAt ? new Date(detailsOutput.completedAt).toLocaleString() : 'Not completed'}
                />
                <DetailItem label="Output ID" value={detailsOutput._id} />
              </section>
              {detailsOutput.errorMessage && (
                <section className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Error</p>
                  <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-sm leading-relaxed text-red-600">
                    {detailsOutput.errorMessage}
                  </p>
                </section>
              )}
              {detailsOutput.url && (
                <div className="flex items-center justify-end">
                  <a
                    href={detailsOutput.url}
                    download={defaultDownloadName(detailsOutput)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
                  >
                    <Download size={12} />
                    Download
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">{label}</p>
      <p className="mt-1 break-words text-sm leading-relaxed text-[var(--foreground)]">{value}</p>
    </div>
  )
}

function OutputCard({
  output,
  onExpand,
  onDetails,
  onDelete,
  isDeleting,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: {
  output: Output
  onExpand: () => void
  onDetails: () => void
  onDelete: () => void
  isDeleting: boolean
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}) {
  const isCompleted = output.status === 'completed'
  const isFailed = output.status === 'failed'
  const isPending = output.status === 'pending'
  const isMedia = isMediaOutputType(output.type)
  const [shouldLoadMedia, setShouldLoadMedia] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = cardRef.current
    if (!node || shouldLoadMedia || !isCompleted || !isMedia || !output.url) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
          setShouldLoadMedia(true)
          observer.disconnect()
        }
      },
      { rootMargin: '240px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [isCompleted, isMedia, output.url, shouldLoadMedia])

  return (
    <div
      ref={cardRef}
      className={`group mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl border bg-[var(--surface-elevated)] transition-shadow hover:shadow-md ${
        selected ? 'border-[var(--foreground)] ring-1 ring-[var(--foreground)]/20' : 'border-[var(--border)]'
      }`}
      style={{ breakInside: 'avoid' }}
      role={selectionMode ? 'button' : undefined}
      tabIndex={selectionMode ? 0 : undefined}
      onClick={() => {
        if (selectionMode) {
          onToggleSelect?.()
          return
        }
        if (isCompleted && isMedia) onExpand()
      }}
      onKeyDown={
        selectionMode
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggleSelect?.()
              }
            }
          : undefined
      }
    >
      <div className="relative bg-[var(--surface-muted)]">
        {isCompleted && output.url && output.type === 'image' && shouldLoadMedia && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={output.url} alt={outputLabel(output)} loading="lazy" className="block h-auto max-h-[22rem] w-full rounded-t-xl object-cover" />
        )}
        {isCompleted && output.url && output.type === 'video' && shouldLoadMedia && (
          <video src={output.url} className="block h-auto max-h-[22rem] w-full rounded-t-xl object-cover" muted playsInline preload="metadata" />
        )}
        {isCompleted && !isMedia && !isPending && (
          <div className="flex h-36 flex-col items-center justify-center gap-3">
            <OutputTypeIcon type={output.type} size={34} className="text-[var(--muted-light)]" />
            <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted-light)]">{output.type}</span>
          </div>
        )}
        {isPending && isMedia && (
          <div
            className={`media-gen-mesh w-full rounded-t-xl border border-[var(--border)] ${
              output.type === 'video' ? 'min-h-[12rem]' : 'min-h-[9rem]'
            }`}
            aria-hidden
          />
        )}
        {isPending && !isMedia && (
          <div className="flex h-36 flex-col items-center justify-center gap-3 px-4">
            <div className="ui-skeleton-mesh h-20 w-20 rounded-xl" aria-hidden />
            <div className="ui-skeleton-line h-2.5 w-24 rounded" />
          </div>
        )}
        {isCompleted && isMedia && output.url && !shouldLoadMedia && !isPending && (
          <div
            className={`media-gen-mesh w-full rounded-t-xl border border-[var(--border)] ${
              output.type === 'video' ? 'min-h-[12rem]' : 'min-h-[9rem]'
            }`}
            aria-hidden
          />
        )}
        {isFailed && (
          <div className="flex h-32 flex-col items-center justify-center gap-1.5 text-red-400">
            <AlertCircle size={20} />
            <span className="text-xs">Failed</span>
          </div>
        )}
        {isCompleted && output.url && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
            <a
              href={output.url}
              download={defaultDownloadName(output)}
              onClick={(e) => e.stopPropagation()}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-2 opacity-0 transition-opacity hover:bg-[var(--surface-elevated)] group-hover:opacity-100"
            >
              <Download size={14} className="text-[var(--foreground)]" />
            </a>
          </div>
        )}
        {selectionMode ? (
          <div className="absolute left-2 top-2 z-20">
            <span
              className={`flex h-4 w-4 items-center justify-center rounded border border-[var(--border)] ${
                selected ? 'border-[var(--foreground)] bg-[var(--foreground)]' : 'bg-[var(--surface-elevated)]'
              }`}
              aria-hidden
            >
              {selected ? <span className="text-[10px] leading-none text-[var(--background)]">✓</span> : null}
            </span>
          </div>
        ) : null}
        <div className={`absolute top-2 ${selectionMode ? 'left-8' : 'left-2'}`}>
          <span className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            output.type === 'image'
              ? 'bg-purple-100 text-purple-600'
              : output.type === 'video'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-zinc-100 text-zinc-600'
          }`}>
            <OutputTypeIcon type={output.type} size={9} />
            {output.type}
          </span>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xs leading-relaxed text-[var(--foreground)]">{outputLabel(output)}</p>
            {!isMedia && <p className="mt-1 line-clamp-2 text-[11px] text-[var(--muted)]">{output.prompt}</p>}
            <p className="mt-1 text-[10px] text-[var(--muted-light)]">
              {timeAgo(output.createdAt)}
              {output.sizeBytes ? ` • ${formatBytes(output.sizeBytes)}` : ''}
            </p>
          </div>
          {!selectionMode ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDetails() }}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
              >
                <Info size={12} />
                Details
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="inline-flex items-center justify-center rounded-md border border-[var(--border)] p-1 text-[var(--muted)] transition-colors hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
              >
                {isDeleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
