import * as React from 'react'
import { cn } from '../utils/cn'
import { ChevronDown } from 'lucide-react'

export interface ToolCallCardProps {
  toolName: string
  status: 'running' | 'success' | 'error'
  children?: React.ReactNode
  className?: string
}

export function ToolCallCard({
  toolName,
  status,
  children,
  className,
}: ToolCallCardProps) {
  const [open, setOpen] = React.useState(false)

  const statusColor =
    status === 'success'
      ? 'text-emerald-600'
      : status === 'error'
        ? 'text-red-500'
        : 'text-[var(--muted)]'

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <ChevronDown
          size={14}
          strokeWidth={1.8}
          className={cn(
            'shrink-0 text-[var(--muted)] transition-transform',
            open && 'rotate-180',
          )}
        />
        <span className="text-sm font-medium text-[var(--foreground)]">
          {toolName}
        </span>
        <span className={cn('ml-auto text-xs', statusColor)}>{status}</span>
      </button>
      {open && children ? (
        <div className="border-t border-[var(--border)] px-4 py-3">
          {children}
        </div>
      ) : null}
    </div>
  )
}
