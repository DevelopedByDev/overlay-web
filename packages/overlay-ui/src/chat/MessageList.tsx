import * as React from 'react'
import { cn } from '../utils/cn'

export interface MessageListProps {
  children: React.ReactNode
  className?: string
}

export const MessageList = React.forwardRef<HTMLDivElement, MessageListProps>(
  ({ children, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4',
          className,
        )}
      >
        {children}
      </div>
    )
  },
)
MessageList.displayName = 'MessageList'
