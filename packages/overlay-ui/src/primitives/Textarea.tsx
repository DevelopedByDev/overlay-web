import * as React from 'react'
import { cn } from '../utils/cn'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--foreground)] disabled:opacity-60 resize-none',
          className,
        )}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'
