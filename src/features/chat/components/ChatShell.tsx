'use client'

import { Image as ImageIcon } from 'lucide-react'
import type { DragEventHandler, ReactNode } from 'react'

type ChatShellProps = {
  sidebar?: ReactNode
  children: ReactNode
  mobileHistoryBar?: ReactNode
  sourcesPanel?: ReactNode
  dialogs?: ReactNode
  isDragging: boolean
  activeChatDeleting: boolean
  onDragEnter: DragEventHandler<HTMLDivElement>
  onDragOver: DragEventHandler<HTMLDivElement>
  onDragLeave: DragEventHandler<HTMLDivElement>
  onDrop: DragEventHandler<HTMLDivElement>
}

export function ChatShell({
  sidebar,
  children,
  mobileHistoryBar,
  sourcesPanel,
  dialogs,
  isDragging,
  activeChatDeleting,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: ChatShellProps) {
  return (
    <div className="flex h-full min-w-0 overflow-x-hidden">
      {sidebar}
      <div
        className={`relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden transition-opacity duration-200 ${
          activeChatDeleting ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-30 m-2 flex items-center justify-center rounded-lg border-2 border-dashed border-[#0a0a0a] bg-[var(--background)]/90 pointer-events-none">
            <div className="text-center">
              <ImageIcon size={28} className="mx-auto mb-2 text-[var(--muted)]" />
              <p className="text-sm font-medium text-[var(--foreground)]">Drop images or documents here</p>
            </div>
          </div>
        )}
        {children}
        {mobileHistoryBar}
      </div>
      {sourcesPanel}
      {dialogs}
    </div>
  )
}
