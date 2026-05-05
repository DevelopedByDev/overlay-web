'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText,
  MessageSquare,
  Plug,
  Server,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react'
import type { MentionCategory, MentionItem, MentionType } from './mention-types'

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  FileText,
  Plug,
  Zap,
  Sparkles,
  Server,
  MessageSquare,
}

function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICON_MAP[icon]
  if (!Icon) return null
  return <Icon size={12} className={className} />
}

interface MentionPopupProps {
  categories: MentionCategory[]
  loading: boolean
  position: { x: number; y: number } | null
  onSelect: (item: MentionItem) => void
  onUploadFile: () => void
  onClose: () => void
  query: string
}

export function MentionPopup({
  categories,
  loading,
  position,
  onSelect,
  onUploadFile,
  onClose,
  query,
}: MentionPopupProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const popupRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Flatten items for keyboard navigation
  const flatItems = useMemo(() => {
    const items: Array<{ item: MentionItem; categoryType: MentionType } | { action: 'upload' }> = []
    for (const cat of categories) {
      for (const item of cat.items) {
        items.push({ item, categoryType: cat.type })
      }
    }
    items.push({ action: 'upload' })
    return items
  }, [categories])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, categories])

  useEffect(() => {
    const el = itemRefs.current[activeIndex]
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setActiveIndex((prev) => Math.min(prev + 1, flatItems.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        const current = flatItems[activeIndex]
        if (current) {
          if ('action' in current) {
            onUploadFile()
          } else {
            onSelect(current.item)
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [activeIndex, flatItems, onSelect, onUploadFile, onClose])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!position) return null

  let itemIdx = 0

  return (
    <div
      ref={popupRef}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl"
      style={{
        left: `${position.x}px`,
        bottom: `${window.innerHeight - position.y + 8}px`,
      }}
    >
      {loading && categories.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--muted)] border-t-transparent" />
        </div>
      ) : categories.length === 0 && !loading ? (
        <div className="px-3 py-4 text-center text-xs text-[var(--muted-light)]">
          No results for &ldquo;{query}&rdquo;
        </div>
      ) : (
        <>
          {categories.map((cat) => (
            <div key={cat.type}>
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-[var(--surface-elevated)] px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--muted-light)]">
                <CategoryIcon icon={cat.icon} className="opacity-60" />
                {cat.label}
              </div>
              {cat.items.map((item) => {
                const idx = itemIdx++
                const isActive = idx === activeIndex
                return (
                  <button
                    key={`${cat.type}-${item.id}`}
                    ref={(el) => { itemRefs.current[idx] = el }}
                    type="button"
                    onClick={() => onSelect(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors ${
                      isActive
                        ? 'bg-[var(--surface-muted)] text-[var(--foreground)]'
                        : 'text-[var(--muted)] hover:bg-[var(--surface-muted)]'
                    }`}
                  >
                    {item.logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={item.logoUrl} alt="" className="h-4 w-4 rounded object-contain" />
                    ) : (
                      <CategoryIcon icon={item.icon || cat.icon} className="shrink-0 opacity-70" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                    {item.description && (
                      <span className="shrink-0 truncate text-[10px] text-[var(--muted-light)] max-w-[100px]">
                        {item.description}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
          {/* Upload file option */}
          <div className="border-t border-[var(--border)]">
            <button
              ref={(el) => { itemRefs.current[itemIdx] = el }}
              type="button"
              onClick={onUploadFile}
              onMouseEnter={() => setActiveIndex(flatItems.length - 1)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                activeIndex === flatItems.length - 1
                  ? 'bg-[var(--surface-muted)] text-[var(--foreground)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-muted)]'
              }`}
            >
              <Upload size={12} className="shrink-0 opacity-70" />
              <span className="font-medium">Upload a file...</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
