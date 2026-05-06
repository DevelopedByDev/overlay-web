'use client'

/**
 * Global search dialog (Cmd+K). Reuses the @-mention search backend (mention-search.ts)
 * and the same two-level navigation (top-level category buttons → drill into a category
 * → fuzzy search within that category). Selecting an entity navigates to the appropriate
 * page. ESC pops back up the breadcrumb (or closes); click outside also closes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronRight,
  FileText,
  MessageSquare,
  Plug,
  Plus,
  Search,
  Server,
  Sparkles,
  Zap,
} from 'lucide-react'
import { searchMentions } from './chat-interface/mention-search'
import type { MentionCategory, MentionItem, MentionType } from './chat-interface/mention-types'

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string; strokeWidth?: number }>> = {
  FileText,
  Plug,
  Zap,
  Sparkles,
  Server,
  MessageSquare,
}

const CATEGORY_ORDER: Array<{ type: MentionType; label: string; icon: string }> = [
  { type: 'chat', label: 'Chats', icon: 'MessageSquare' },
  { type: 'file', label: 'Files', icon: 'FileText' },
  { type: 'automation', label: 'Automations', icon: 'Zap' },
  { type: 'skill', label: 'Skills', icon: 'Sparkles' },
  { type: 'mcp', label: 'MCP Servers', icon: 'Server' },
  { type: 'connector', label: 'Connectors', icon: 'Plug' },
]

function CategoryIcon({ icon, className, size = 16 }: { icon: string; className?: string; size?: number }) {
  const Icon = ICON_MAP[icon]
  if (!Icon) return null
  return <Icon size={size} strokeWidth={1.75} className={className} />
}

function hrefForItem(item: MentionItem): string {
  switch (item.type) {
    case 'chat':
      return `/app/chat?id=${encodeURIComponent(item.id)}`
    case 'file':
      // The mention-search file fetcher stores `kind` in `description` (e.g. "note").
      if (item.description === 'note') return `/app/notes?id=${encodeURIComponent(item.id)}`
      return `/app/files?file=${encodeURIComponent(item.id)}`
    case 'automation':
      return `/app/automations?automationId=${encodeURIComponent(item.id)}`
    case 'skill':
      return `/app/tools?view=skills&id=${encodeURIComponent(item.id)}`
    case 'mcp':
      return `/app/tools?view=mcps&id=${encodeURIComponent(item.id)}`
    case 'connector':
      return `/app/tools?view=apps&slug=${encodeURIComponent(item.id)}`
    default:
      return '/app'
  }
}

interface GlobalSearchDialogProps {
  open: boolean
  onClose: () => void
  /** When set, dialog opens with this category drilled-in (used by sidebar section search). */
  initialCategory?: MentionType | null
  /** Click handler for the “New Chat” top action. Provided by the host. */
  onNewChat: () => void
}

type Row =
  | { kind: 'new-chat' }
  | { kind: 'category'; type: MentionType; label: string; icon: string }
  | { kind: 'item'; item: MentionItem; categoryType: MentionType }

export function GlobalSearchDialog({ open, onClose, initialCategory = null, onNewChat }: GlobalSearchDialogProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<MentionType | null>(initialCategory)
  const [categories, setCategories] = useState<MentionCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Reset internal state when the dialog opens. Wrapped in queueMicrotask to avoid
  // synchronous setState inside the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setQuery('')
      setSelectedCategory(initialCategory)
      setActiveIndex(0)
      inputRef.current?.focus()
    })
  }, [open, initialCategory])

  // Fetch results whenever query or category changes.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
    })
    void searchMentions(query)
      .then((cats) => {
        if (cancelled) return
        setCategories(cats)
      })
      .catch(() => {
        if (cancelled) return
        setCategories([])
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, query])

  const rows: Row[] = useMemo(() => {
    const list: Row[] = []
    const trimmed = query.trim()

    if (selectedCategory === null) {
      if (trimmed === '') {
        for (const cat of CATEGORY_ORDER) {
          list.push({ kind: 'category', type: cat.type, label: cat.label, icon: cat.icon })
        }
        return list
      }
      // Top-level with query: flatten matching items across all categories.
      for (const cat of categories) {
        for (const item of cat.items) {
          list.push({ kind: 'item', item, categoryType: cat.type })
        }
      }
      return list
    }

    // Drilled into a specific category: only items of that type, filtered by query.
    const cat = categories.find((c) => c.type === selectedCategory)
    if (cat) {
      for (const item of cat.items) {
        list.push({ kind: 'item', item, categoryType: cat.type })
      }
    }
    return list
  }, [categories, query, selectedCategory])

  // Reset row highlight when the row set changes. Wrapped in queueMicrotask to
  // sidestep the react-hooks/set-state-in-effect lint and match MentionPopup.
  useEffect(() => {
    queueMicrotask(() => setActiveIndex(0))
  }, [rows.length, selectedCategory])

  useEffect(() => {
    const el = itemRefs.current[activeIndex]
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const performAction = useCallback(
    (row: Row) => {
      if (row.kind === 'new-chat') {
        onNewChat()
        onClose()
        return
      }
      if (row.kind === 'category') {
        setSelectedCategory(row.type)
        setActiveIndex(0)
        return
      }
      router.push(hrefForItem(row.item))
      onClose()
    },
    [onClose, onNewChat, router],
  )

  // Keyboard handling.
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, rows.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const current = rows[activeIndex]
        if (current) performAction(current)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (selectedCategory !== null) {
          setSelectedCategory(null)
          setQuery('')
          setActiveIndex(0)
          queueMicrotask(() => inputRef.current?.focus())
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [open, rows, activeIndex, performAction, selectedCategory, onClose])

  if (!open) return null

  const selectedCategoryMeta = selectedCategory
    ? CATEGORY_ORDER.find((c) => c.type === selectedCategory)
    : null

  const placeholder = selectedCategoryMeta
    ? `Search ${selectedCategoryMeta.label.toLowerCase()}...`
    : 'Type a command or search...'

  const showEmpty = rows.length === 0 || (rows.length === 1 && rows[0]!.kind === 'new-chat' && query.trim() !== '' && selectedCategory === null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[12vh] px-4"
      onMouseDown={(e) => {
        // Close on backdrop click only (not on dialog itself).
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-2xl"
      >
        {selectedCategoryMeta && (
          <div className="flex items-center gap-1.5 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-[var(--muted-light)]">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null)
                setQuery('')
                inputRef.current?.focus()
              }}
              className="hover:text-[var(--foreground)] transition-colors"
            >
              All
            </button>
            <ChevronRight size={10} className="opacity-60" />
            <CategoryIcon icon={selectedCategoryMeta.icon} className="opacity-60" size={11} />
            <span>{selectedCategoryMeta.label}</span>
            <span className="ml-auto text-[9px] opacity-60">esc to go back</span>
          </div>
        )}

        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <Search size={16} strokeWidth={1.75} className="shrink-0 text-[var(--muted-light)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-light)]"
          />
        </div>

        <div className="overflow-y-auto py-1">
          {loading && rows.length <= 1 ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--muted)] border-t-transparent" />
            </div>
          ) : showEmpty ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--muted-light)]">
              {query.trim() !== '' ? <>No results for &ldquo;{query}&rdquo;</> : <>Nothing here yet</>}
            </div>
          ) : (
            rows.map((row, idx) => {
              const isActive = idx === activeIndex
              if (row.kind === 'new-chat') {
                return (
                  <button
                    key="new-chat"
                    ref={(el) => {
                      itemRefs.current[idx] = el
                    }}
                    type="button"
                    onClick={() => performAction(row)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`mx-2 my-1 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-[var(--surface-muted)] text-[var(--foreground)]'
                        : 'text-[var(--foreground)] hover:bg-[var(--surface-muted)]'
                    }`}
                  >
                    <Plus size={16} strokeWidth={1.75} className="shrink-0" />
                    <span className="font-medium">New Chat</span>
                  </button>
                )
              }
              if (row.kind === 'category') {
                return (
                  <button
                    key={`cat-${row.type}`}
                    ref={(el) => {
                      itemRefs.current[idx] = el
                    }}
                    type="button"
                    onClick={() => performAction(row)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex w-full items-center gap-3 px-5 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-[var(--surface-muted)] text-[var(--foreground)]'
                        : 'text-[var(--muted)] hover:bg-[var(--surface-muted)]'
                    }`}
                  >
                    <CategoryIcon icon={row.icon} className="shrink-0 opacity-70" />
                    <span className="flex-1 font-medium">{row.label}</span>
                    <ChevronRight size={14} strokeWidth={1.75} className="shrink-0 opacity-50" />
                  </button>
                )
              }
              const { item, categoryType } = row
              const fallbackIcon = CATEGORY_ORDER.find((c) => c.type === categoryType)?.icon || 'FileText'
              return (
                <button
                  key={`${categoryType}-${item.id}`}
                  ref={(el) => {
                    itemRefs.current[idx] = el
                  }}
                  type="button"
                  onClick={() => performAction(row)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex w-full items-center gap-3 px-5 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-[var(--surface-muted)] text-[var(--foreground)]'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-muted)]'
                  }`}
                >
                  {item.logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.logoUrl} alt="" className="h-4 w-4 shrink-0 rounded object-contain" />
                  ) : (
                    <CategoryIcon icon={item.icon || fallbackIcon} className="shrink-0 opacity-70" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                  {item.description && (
                    <span className="ml-2 shrink-0 truncate text-[11px] text-[var(--muted-light)]">
                      {item.description}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
