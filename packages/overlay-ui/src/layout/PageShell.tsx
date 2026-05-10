import * as React from 'react'
import { cn } from '../utils/cn'

export interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode
}

export const PageShell = React.forwardRef<HTMLDivElement, PageShellProps>(
  ({ className, header, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex h-full min-h-0 flex-col bg-background text-foreground',
          className,
        )}
        {...props}
      >
        {header ? (
          <div className="flex h-16 shrink-0 items-center border-b border-[var(--border)] px-6">
            {header}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto px-6 py-6">{children}</div>
      </div>
    )
  },
)
PageShell.displayName = 'PageShell'
