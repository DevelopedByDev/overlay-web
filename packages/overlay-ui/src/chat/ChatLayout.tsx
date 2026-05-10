import * as React from 'react'
import { cn } from '../utils/cn'

export interface ChatLayoutProps {
  sidebar?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function ChatLayout({ sidebar, children, className }: ChatLayoutProps) {
  return (
    <div className={cn('flex h-screen overflow-hidden bg-background text-foreground', className)}>
      {sidebar}
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
