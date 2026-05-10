import * as React from 'react'
import { cn } from '../utils/cn'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error'
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
          {
            'bg-[var(--surface-subtle)] text-[var(--muted)]':
              variant === 'default',
            'bg-emerald-50 text-emerald-600': variant === 'success',
            'bg-amber-50 text-amber-600': variant === 'warning',
            'bg-red-50 text-red-500': variant === 'error',
          },
          className,
        )}
        {...props}
      />
    )
  },
)
Badge.displayName = 'Badge'
