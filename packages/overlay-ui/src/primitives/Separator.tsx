import * as React from 'react'
import { cn } from '../utils/cn'

export interface SeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (
    { className, orientation = 'horizontal', ...props },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'shrink-0 bg-[var(--border)]',
          orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
          className,
        )}
        {...props}
      />
    )
  },
)
Separator.displayName = 'Separator'
