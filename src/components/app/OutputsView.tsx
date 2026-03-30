'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

export default function OutputsView() {
  const [outputs, setOutputs] = useState<Output[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<Output | null>(null)
  const [detailsOutput, setDetailsOutput] = useState<Output | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(outputId: string) {
    setDeletingId(outputId)
    try {
      await fetch(`/api/app/outputs?outputId=${encodeURIComponent(outputId)}`, { method: 'DELETE' })
      setOutputs((prev) => prev.filter((o) => o._id !== outputId))
      if (lightbox?._id === outputId) setLightbox(null)
      if (detailsOutput?._id === outputId) setDetailsOutput(null)
    } finally {
      setDeletingId(null)
    }
  }

  const load = useCallback(async (type?: FilterType) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '100' })
      const nextFilter = type ?? filter
      if (nextFilter === 'image' || nextFilter === 'video') {
        params.set('type', nextFilter)
      }
      const res = await fetch(`/api/app/outputs?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      setOutputs(await res.json())
    } catch {
      setError('Failed to load outputs.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  function handleFilterChange(nextFilter: FilterType) {
    setFilter(nextFilter)
    void load(nextFilter)
  }

  const filtered = outputs.filter((output) => {
    if (filter === 'all') return true
    if (filter === 'files') return !isMediaOutputType(output.type)
    return output.type === filter
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex min-h-16 shrink-0 flex-col gap-3 border-b border-[#e5e5e5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-0">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-base font-medium text-[#0a0a0a] sm:text-sm">Outputs</h1>
          <span className="shrink-0 text-xs text-[#aaa]">{filtered.length} items</span>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <div className="flex min-w-0 flex-1 items-center justify-center rounded-lg bg-[#f0f0f0] p-0.5 sm:flex-initial sm:justify-start">
            {(['all', 'image', 'video', 'files'] as FilterType[]).map((entry) => (
              <button
                key={entry}
                onClick={() => handleFilterChange(entry)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs capitalize transition-colors sm:flex-none sm:py-1 ${
                  filter === entry
                    ? 'bg-white font-medium text-[#0a0a0a] shadow-sm'
                    : 'text-[#888] hover:text-[#525252]'
                }`}
              >
                {entry}
              </button>
            ))}
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="shrink-0 rounded-md p-1.5 text-[#888] transition-colors hover:bg-[#f0f0f0] hover:text-[#525252] disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
        {loading && outputs.length === 0 && (
          <div className="flex items-center justify-center h-48 text-[#aaa] text-sm gap-2">
            <RefreshCw size={14} className="animate-spin" />
            Loading outputs...
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
              <Video size={32} className="text-[#d0d0d0]" />
            ) : filter === 'files' ? (
              <FileText size={32} className="text-[#d0d0d0]" />
            ) : (
              <ImageIcon size={32} className="text-[#d0d0d0]" />
            )}
            <p className="text-sm text-[#888]">No {filter === 'all' ? '' : `${filter} `}outputs yet</p>
            <p className="text-xs text-[#aaa]">Generated media and sandbox artifacts will appear here</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="mx-auto w-full max-w-[1440px] columns-1 [column-gap:1rem] sm:columns-2 lg:columns-3 xl:columns-4">
            {filtered.map((output) => (
              <OutputCard
                key={output._id}
                output={output}
                onExpand={() => setLightbox(output)}
                onDetails={() => setDetailsOutput(output)}
                onDelete={() => handleDelete(output._id)}
                isDeleting={deletingId === output._id}
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
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
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
                <p className="min-w-0 flex-1 line-clamp-2 text-sm text-[#0a0a0a]">{outputLabel(lightbox)}</p>
                <button
                  type="button"
                  onClick={() => setDetailsOutput(lightbox)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#e5e5e5] px-2 py-1 text-[11px] font-medium text-[#525252] transition-colors hover:bg-[#f5f5f5] hover:text-[#0a0a0a]"
                >
                  <Info size={12} />
                  Details
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#888]">
                <span>{lightbox.fileName || lightbox.modelId}</span>
                <span><Clock size={10} className="mr-0.5 inline" />{timeAgo(lightbox.createdAt)}</span>
                {lightbox.url && (
                  <a
                    href={lightbox.url}
                    download={defaultDownloadName(lightbox)}
                    className="flex items-center gap-1 transition-colors hover:text-[#525252]"
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
            className="h-full w-full max-w-md overflow-y-auto border-l border-[#e5e5e5] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e5e5e5] px-5 py-4">
              <div>
                <h2 className="text-sm font-medium text-[#0a0a0a]">Output details</h2>
                <p className="mt-0.5 text-xs text-[#888]">
                  {detailsOutput.source === 'sandbox' ? 'Sandbox artifact' : `${detailsOutput.type} generation`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOutput(null)}
                className="rounded-md p-1.5 text-[#888] transition-colors hover:bg-[#f5f5f5] hover:text-[#0a0a0a]"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-5 px-5 py-5">
              <section className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#9a9a9a]">Prompt</p>
                <p className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-3 text-sm leading-relaxed text-[#0a0a0a]">
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
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#9a9a9a]">Error</p>
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
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#0a0a0a] px-3 py-2 text-xs font-medium text-[#fafafa] transition-colors hover:bg-[#222]"
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
    <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#9a9a9a]">{label}</p>
      <p className="mt-1 break-words text-sm leading-relaxed text-[#0a0a0a]">{value}</p>
    </div>
  )
}

function OutputCard({ output, onExpand, onDetails, onDelete, isDeleting }: { output: Output; onExpand: () => void; onDetails: () => void; onDelete: () => void; isDeleting: boolean }) {
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
      className="group mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl border border-[#e5e5e5] bg-white transition-shadow hover:shadow-md"
      style={{ breakInside: 'avoid' }}
      onClick={isCompleted && isMedia ? onExpand : undefined}
    >
      <div className="relative bg-[#f5f5f5]">
        {isCompleted && output.url && output.type === 'image' && shouldLoadMedia && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={output.url} alt={outputLabel(output)} loading="lazy" className="block h-auto max-h-[22rem] w-full rounded-t-xl object-cover" />
        )}
        {isCompleted && output.url && output.type === 'video' && shouldLoadMedia && (
          <video src={output.url} className="block h-auto max-h-[22rem] w-full rounded-t-xl object-cover" muted playsInline preload="metadata" />
        )}
        {isCompleted && !isMedia && (
          <div className="flex h-36 flex-col items-center justify-center gap-3">
            <OutputTypeIcon type={output.type} size={34} className="text-[#b0b0b0]" />
            <span className="text-xs uppercase tracking-[0.12em] text-[#9a9a9a]">{output.type}</span>
          </div>
        )}
        {(isPending || (isCompleted && isMedia && output.url && !shouldLoadMedia)) && (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e0e0e0] border-t-[#525252]" />
          </div>
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
              className="rounded-full bg-white/90 p-2 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
            >
              <Download size={14} className="text-[#0a0a0a]" />
            </a>
          </div>
        )}
        <div className="absolute left-2 top-2">
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
            <p className="line-clamp-2 text-xs leading-relaxed text-[#525252]">{outputLabel(output)}</p>
            {!isMedia && <p className="mt-1 line-clamp-2 text-[11px] text-[#888]">{output.prompt}</p>}
            <p className="mt-1 text-[10px] text-[#aaa]">
              {timeAgo(output.createdAt)}
              {output.sizeBytes ? ` • ${formatBytes(output.sizeBytes)}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDetails() }}
              className="inline-flex items-center gap-1 rounded-md border border-[#e5e5e5] px-2 py-1 text-[11px] font-medium text-[#525252] transition-colors hover:bg-[#f5f5f5] hover:text-[#0a0a0a]"
            >
              <Info size={12} />
              Details
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="inline-flex items-center justify-center rounded-md border border-[#e5e5e5] p-1 text-[#888] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
            >
              {isDeleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
