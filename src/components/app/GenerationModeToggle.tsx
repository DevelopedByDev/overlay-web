'use client'

import type { ComponentType } from 'react'
import { MessageSquare, ImageIcon, Video, Bot } from 'lucide-react'
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

const ASK_ACT_MODES: {
  value: 'ask' | 'act'
  label: string
  Icon: ComponentType<{ size?: number; className?: string }>
}[] = [
  { value: 'act', label: 'Act', Icon: Bot },
  { value: 'ask', label: 'Ask', Icon: MessageSquare },
]

interface AskActModeToggleProps {
  mode: 'ask' | 'act'
  onChange: (mode: 'ask' | 'act') => void
  disabled?: boolean
  className?: string
}

/** Same chrome as {@link GenerationModeToggle} — for the composer only. */
export function AskActModeToggle({ mode, onChange, disabled, className = '' }: AskActModeToggleProps) {
  return (
    <div className={`flex items-center bg-[var(--surface-subtle)] rounded-lg p-0.5 shrink-0 ${className}`}>
      {ASK_ACT_MODES.map(({ value, label, Icon }) => {
        const active = mode === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => !disabled && onChange(value)}
            disabled={disabled}
            title={label}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            } ${
              active
                ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm font-medium'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Icon size={11} />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
