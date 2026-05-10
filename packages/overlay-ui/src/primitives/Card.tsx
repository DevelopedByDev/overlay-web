import * as React from 'react'
import { cn } from '../utils/cn'

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm',
          className,
        )}
        {...props}
      />
    )
  },
)
Card.displayName = 'Card'
