'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import {
  faviconUrl,
  prettyUrlPath,
  safeHttpUrl,
  webSourceDisplayKey,
  type WebSourceItem,
} from '@overlay/chat-core'

export function SourcesPanel({
  open,
  onClose,
  sources,
  variant = 'inline',
}: {
  open: boolean
  onClose: () => void
  sources: WebSourceItem[]
  variant?: 'inline' | 'shell'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const shellPanel = variant === 'shell'

  return (
    <aside
      aria-label="Sources"
      aria-hidden={!open}
      className={
        shellPanel
          ? 'flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--background)]'
          : `hidden h-full shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--background)] transition-[width] duration-200 md:flex ${
              open ? 'w-[min(40vw,380px)]' : 'w-0 border-l-0'
            }`
      }
    >
      <div className={shellPanel ? 'flex h-full min-h-0 w-full flex-col' : 'flex h-full w-[min(40vw,380px)] flex-col'}>
        <div className="flex h-16 min-h-16 max-h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
          <h2 className="text-sm font-medium text-[var(--foreground)]">Sources</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <ul className="flex flex-col gap-1">
            {sources.flatMap((source, idx) => {
              const safeUrl = safeHttpUrl(source.url)
              if (!safeUrl) return []
              const site = webSourceDisplayKey(source.url)
              const fav = faviconUrl(source.url)
              const titleCandidate = source.title?.trim() || ''
              let host = ''
              try {
                host = new URL(source.url).hostname.replace(/^www\./i, '')
              } catch {
                host = site
              }
              const isTitleJustHost =
                !titleCandidate ||
                titleCandidate.toLowerCase() === host.toLowerCase() ||
                titleCandidate.toLowerCase() === site.toLowerCase()
              const displayTitle = isTitleJustHost ? host : titleCandidate
              const subtext =
                source.snippet?.trim() ||
                (isTitleJustHost ? prettyUrlPath(source.url) : host)
              return (
                <li key={`${source.url}-${idx}`}>
                  <a
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-lg px-2 py-2 transition-colors hover:bg-[var(--surface-subtle)]"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--surface-elevated)] ring-1 ring-[var(--border)]">
                        {fav ? (
                          <img src={fav} alt="" className="h-3.5 w-3.5" width={14} height={14} />
                        ) : (
                          <span className="text-[9px] font-semibold text-[var(--muted)]">
                            {site.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium leading-snug text-[var(--foreground)] group-hover:underline">
                          {displayTitle}
                        </p>
                        {subtext ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">
                            {subtext}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </aside>
  )
}
