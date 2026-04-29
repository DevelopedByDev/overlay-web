'use client'

import { useEffect } from 'react'

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
      else if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onCancel, onConfirm])

  if (!isOpen) return null

  const confirmClass = destructive
    ? 'rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40'
    : 'rounded-lg bg-[var(--foreground)] px-4 py-1.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-40'

  return (
    <div
      className="fixed inset-0 z-[10070] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-[min(420px,92vw)] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-2xl"
      >
        <h2 id="confirm-dialog-title" className="text-sm font-semibold text-[var(--foreground)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{description}</p>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)] disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={confirmClass}
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
