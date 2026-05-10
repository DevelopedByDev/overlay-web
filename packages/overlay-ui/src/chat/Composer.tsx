import * as React from 'react'
import { cn } from '../utils/cn'
import { Send } from 'lucide-react'

export interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder = 'Message…',
  disabled,
  className,
}: ComposerProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) {
        onSubmit()
      }
    }
  }

  return (
    <div
      className={cn(
        'flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 shadow-sm',
        className,
      )}
    >
      <textarea
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[40px] w-full resize-none bg-transparent px-1 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
      />
      <button
        type="button"
        disabled={disabled || !value.trim()}
        onClick={onSubmit}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--foreground)] text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-40"
        aria-label="Send"
      >
        <Send size={16} strokeWidth={1.8} />
      </button>
    </div>
  )
}
