import * as React from 'react'
import { cn } from '../utils/cn'
import { useLockBodyScroll } from '../utils/useLockBodyScroll'
import { X } from 'lucide-react'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  useLockBodyScroll(open)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--overlay-scrim)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative z-10 w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-lg',
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          {title ? (
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              {title}
            </h2>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
