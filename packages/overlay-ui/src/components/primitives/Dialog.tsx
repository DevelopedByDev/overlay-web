import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

export interface DialogFrameProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open: boolean
  title?: ReactNode
  description?: ReactNode
  footer?: ReactNode
  onOpenChange?: (open: boolean) => void
}

export function DialogFrame({
  open,
  title,
  description,
  footer,
  onOpenChange,
  children,
  className,
  ...props
}: DialogFrameProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10070] flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange?.(false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'w-[min(420px,92vw)] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-2xl',
          className,
        )}
        {...props}
      >
        {title ? <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2> : null}
        {description ? (
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{description}</p>
        ) : null}
        {children}
        {footer ? <div className="mt-5 flex items-center justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  )
}
