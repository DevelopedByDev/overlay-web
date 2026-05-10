import * as React from 'react'
import { cn } from '../utils/cn'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--foreground)] disabled:opacity-60',
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
