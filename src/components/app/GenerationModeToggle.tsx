'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { MessageSquare, ImageIcon, Video, ChevronDown, Check } from 'lucide-react'
import type { GenerationMode } from '@/lib/models'

interface GenerationModeToggleProps {
  mode: GenerationMode
  onChange: (mode: GenerationMode) => void
  disabled?: boolean
  className?: string
  /** Equal-width segments for narrow layouts (no horizontal overflow). */
  layout?: 'default' | 'stretch'
}

const MODES: { value: GenerationMode; label: string; Icon: ComponentType<{ size?: number; className?: string }> }[] = [
  { value: 'text', label: 'Text', Icon: MessageSquare },
  { value: 'image', label: 'Image', Icon: ImageIcon },
  { value: 'video', label: 'Video', Icon: Video },
]

export function GenerationModeToggle({
  mode,
  onChange,
  disabled,
  className = '',
  layout = 'default',
}: GenerationModeToggleProps) {
  const stretch = layout === 'stretch'
  return (
    <div
      className={`flex items-center rounded-lg bg-[var(--surface-subtle)] p-0.5 shrink-0 ${stretch ? 'w-full min-w-0' : ''} ${className}`}
    >
      {MODES.map(({ value, label, Icon }) => {
        const active = mode === value
        return (
          <button
            key={value}
            onClick={() => !disabled && onChange(value)}
            disabled={disabled}
            title={label}
            type="button"
            className={`flex items-center justify-center rounded-md text-xs transition-colors ${
              stretch
                ? 'min-w-0 flex-1 flex-col gap-0.5 px-0.5 py-1.5 sm:flex-row sm:gap-1 sm:px-2 sm:py-1'
                : 'gap-1 px-2.5 py-1'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${
              active
                ? 'bg-[var(--surface-elevated)] font-medium text-[var(--foreground)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Icon size={stretch ? 13 : 11} className="shrink-0" />
            <span className={stretch ? 'max-w-full truncate text-center text-[10px] leading-none sm:text-xs' : ''}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Compact dropdown for mobile headers (replaces the segmented control). */
export function GenerationModeSelect({
  mode,
  onChange,
  disabled,
  className = '',
}: {
  mode: GenerationMode
  onChange: (mode: GenerationMode) => void
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = MODES.find((m) => m.value === mode) ?? MODES[0]!
  const CurrentIcon = current.Icon

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc, true)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`flex h-8 min-h-8 max-w-[7.5rem] min-w-0 items-center justify-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2 text-xs leading-none text-[var(--muted)] transition-colors ${
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'hover:border-[var(--foreground)]/20 hover:text-[var(--foreground)]'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <CurrentIcon size={12} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left text-[10px] font-medium leading-none sm:text-xs">
          {current.label}
        </span>
        <ChevronDown size={10} className="shrink-0 opacity-70" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-30 mt-1 min-w-[7.5rem] rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg"
        >
          {MODES.map(({ value, label, Icon }) => {
            const active = mode === value
            return (
              <li key={value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs ${
                    active ? 'bg-[var(--surface-muted)] font-medium text-[var(--foreground)]' : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)]'
                  }`}
                >
                  {active ? <Check size={10} className="shrink-0" /> : <span className="inline-block w-[10px] shrink-0" />}
                  <Icon size={12} className="shrink-0" />
                  {label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

