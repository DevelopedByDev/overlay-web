import * as React from 'react'
import { cn } from '../utils/cn'

export interface SplitPaneProps {
  left: React.ReactNode
  right: React.ReactNode
  className?: string
}

export function SplitPane({ left, right, className }: SplitPaneProps) {
  return (
    <div className={cn('flex h-full min-h-0', className)}>
      <div className="min-w-0 flex-1 overflow-auto">{left}</div>
      <div className="min-w-0 flex-1 overflow-auto border-l border-[var(--border)]">
        {right}
      </div>
    </div>
  )
}
