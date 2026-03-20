'use client'

import { useState, useEffect, useCallback } from 'react'
import { ImageIcon, Video, Download, RefreshCw, AlertCircle, Clock } from 'lucide-react'

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
      <div className="flex h-16 items-center justify-between border-b border-[#e5e5e5] px-6 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-[#0a0a0a]">Outputs</h1>
          <span className="text-xs text-[#aaa]">{filtered.length} items</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          <div className="flex items-center bg-[#f0f0f0] rounded-lg p-0.5">
            {(['all', 'image', 'video'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={`px-3 py-1 rounded-md text-xs transition-colors capitalize ${
                  filter === f
                    ? 'bg-white text-[#0a0a0a] shadow-sm font-medium'
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
            className="p-1.5 rounded-md text-[#888] hover:text-[#525252] hover:bg-[#f0f0f0] transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
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
          <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3 space-y-3">
            {filtered.map((output) => (
              <OutputCard
                key={output._id}
                output={output}
                onExpand={() => setLightbox(output)}
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
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={lightbox.url} controls className="max-h-[80vh] max-w-full" />
            )}
            <div className="p-4 space-y-1">
              <p className="text-sm text-[#0a0a0a] line-clamp-2">{lightbox.prompt}</p>
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
    </div>
  )
}

function OutputCard({ output, onExpand }: { output: Output; onExpand: () => void }) {
  const isCompleted = output.status === 'completed'
  const isFailed = output.status === 'failed'
  const isPending = output.status === 'pending'

  return (
    <div className="break-inside-avoid mb-3 rounded-xl overflow-hidden border border-[#e5e5e5] bg-white group cursor-pointer hover:shadow-md transition-shadow"
      onClick={isCompleted ? onExpand : undefined}>
      {/* Media area */}
      <div className="relative bg-[#f5f5f5]">
        {isCompleted && output.url && output.type === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={output.url} alt={output.prompt} className="w-full object-cover" />
        )}
        {isCompleted && output.url && output.type === 'video' && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={output.url} className="w-full object-cover" />
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
        <p className="text-xs text-[#525252] line-clamp-2 leading-relaxed">{output.prompt}</p>
        <p className="text-[10px] text-[#aaa] mt-1">{timeAgo(output.createdAt)}</p>
      </div>
    </div>
  )
}
