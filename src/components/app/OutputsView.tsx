'use client'

import { useState, useEffect, useCallback } from 'react'
import { ImageIcon, Video, Download, RefreshCw, AlertCircle, Clock, Info, X } from 'lucide-react'

interface Output {
  _id: string
  type: 'image' | 'video'
  status: 'pending' | 'completed' | 'failed'
  prompt: string
  modelId: string
  url?: string
  errorMessage?: string
  createdAt: number
  completedAt?: number
}

type FilterType = 'all' | 'image' | 'video'

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function OutputsView() {
  const [outputs, setOutputs] = useState<Output[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<Output | null>(null)
  const [detailsOutput, setDetailsOutput] = useState<Output | null>(null)

  const load = useCallback(async (type?: FilterType) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '100' })
      const t = type ?? filter
      if (t !== 'all') params.set('type', t)
      const res = await fetch(`/api/app/outputs?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      setOutputs(await res.json())
    } catch {
      setError('Failed to load outputs.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  function handleFilterChange(f: FilterType) {
    setFilter(f)
    void load(f)
  }

  const filtered = outputs.filter((o) => filter === 'all' || o.type === filter)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex min-h-16 shrink-0 flex-col gap-3 border-b border-[#e5e5e5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-0">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-base font-medium text-[#0a0a0a] sm:text-sm">Outputs</h1>
          <span className="shrink-0 text-xs text-[#aaa]">{filtered.length} items</span>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          {/* Filter tabs */}
          <div className="flex min-w-0 flex-1 items-center justify-center rounded-lg bg-[#f0f0f0] p-0.5 sm:flex-initial sm:justify-start">
            {(['all', 'image', 'video'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs capitalize transition-colors sm:flex-none sm:py-1 ${
                  filter === f
                    ? 'bg-white font-medium text-[#0a0a0a] shadow-sm'
                    : 'text-[#888] hover:text-[#525252]'
                }`}
              >
                {f}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
        {loading && outputs.length === 0 && (
          <div className="flex items-center justify-center h-48 text-[#aaa] text-sm gap-2">
            <RefreshCw size={14} className="animate-spin" />
            Loading outputs…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
            {filter === 'video'
              ? <Video size={32} className="text-[#d0d0d0]" />
              : <ImageIcon size={32} className="text-[#d0d0d0]" />}
            <p className="text-sm text-[#888]">No {filter === 'all' ? '' : filter + ' '}outputs yet</p>
            <p className="text-xs text-[#aaa]">Use the Image or Video mode in chat to generate content</p>
          </div>
        )}

        {/* Pinterest-style masonry grid */}
        {filtered.length > 0 && (
          <div className="mx-auto w-full max-w-[1440px] columns-1 [column-gap:1rem] sm:columns-2 lg:columns-3 xl:columns-4">
            {filtered.map((output) => (
              <OutputCard
                key={output._id}
                output={output}
                onExpand={() => setLightbox(output)}
                onDetails={() => setDetailsOutput(output)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.type === 'image' && lightbox.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.url} alt={lightbox.prompt} className="max-h-[80vh] object-contain" />
            )}
            {lightbox.type === 'video' && lightbox.url && (
              <video src={lightbox.url} controls className="max-h-[80vh] max-w-full" />
            )}
            <div className="p-4 space-y-1">
              <div className="flex items-start gap-3">
                <p className="min-w-0 flex-1 text-sm text-[#0a0a0a] line-clamp-2">{lightbox.prompt}</p>
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
                <span>{lightbox.modelId}</span>
                <span><Clock size={10} className="inline mr-0.5" />{timeAgo(lightbox.createdAt)}</span>
                {lightbox.url && (
                  <a
                    href={lightbox.url}
                    download={lightbox.type === 'image' ? 'generated.png' : 'generated.mp4'}
                    className="flex items-center gap-1 hover:text-[#525252] transition-colors"
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
                <p className="mt-0.5 text-xs text-[#888]">{detailsOutput.type} generation</p>
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
                <DetailItem label="Model" value={detailsOutput.modelId} />
                <DetailItem label="Status" value={detailsOutput.status} />
                <DetailItem label="Type" value={detailsOutput.type} />
                <DetailItem label="Created" value={new Date(detailsOutput.createdAt).toLocaleString()} />
                <DetailItem label="Completed" value={detailsOutput.completedAt ? new Date(detailsOutput.completedAt).toLocaleString() : 'Not completed'} />
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
                    download={detailsOutput.type === 'image' ? 'generated.png' : 'generated.mp4'}
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

function OutputCard({ output, onExpand, onDetails }: { output: Output; onExpand: () => void; onDetails: () => void }) {
  const isCompleted = output.status === 'completed'
  const isFailed = output.status === 'failed'
  const isPending = output.status === 'pending'

  return (
    <div
      className="mb-4 block w-full break-inside-avoid rounded-xl overflow-hidden border border-[#e5e5e5] bg-white group cursor-pointer hover:shadow-md transition-shadow"
      style={{ breakInside: 'avoid' }}
      onClick={isCompleted ? onExpand : undefined}>
      {/* Media area */}
      <div className="relative bg-[#f5f5f5]">
        {isCompleted && output.url && output.type === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={output.url} alt={output.prompt} className="block w-full h-auto max-h-[22rem] rounded-t-xl object-cover" />
        )}
        {isCompleted && output.url && output.type === 'video' && (
          <video src={output.url} className="block w-full h-auto max-h-[22rem] rounded-t-xl object-cover" muted playsInline preload="metadata" />
        )}
        {isPending && (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 rounded-full border-2 border-[#e0e0e0] border-t-[#525252] animate-spin" />
          </div>
        )}
        {isFailed && (
          <div className="flex flex-col items-center justify-center h-32 gap-1.5 text-red-400">
            <AlertCircle size={20} />
            <span className="text-xs">Failed</span>
          </div>
        )}
        {/* Hover overlay */}
        {isCompleted && output.url && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <a
              href={output.url}
              download={output.type === 'image' ? 'generated.png' : 'generated.mp4'}
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white/90 rounded-full hover:bg-white"
            >
              <Download size={14} className="text-[#0a0a0a]" />
            </a>
          </div>
        )}
        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
            output.type === 'image' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
          }`}>
            {output.type === 'image' ? <ImageIcon size={9} /> : <Video size={9} />}
            {output.type}
          </span>
        </div>
      </div>
      {/* Caption */}
      <div className="px-3 py-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[#525252] line-clamp-2 leading-relaxed">{output.prompt}</p>
            <p className="mt-1 text-[10px] text-[#aaa]">{timeAgo(output.createdAt)}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDetails()
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#e5e5e5] px-2 py-1 text-[11px] font-medium text-[#525252] transition-colors hover:bg-[#f5f5f5] hover:text-[#0a0a0a]"
          >
            <Info size={12} />
            Details
          </button>
        </div>
      </div>
    </div>
  )
}
