import * as React from 'react'
import { cn } from '../utils/cn'

export interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: React.ReactNode
  timestamp?: string
  className?: string
}

export function MessageBubble({
  role,
  content,
  timestamp,
  className,
}: MessageBubbleProps) {
  const isUser = role === 'user'
  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start',
        className,
      )}
    >
      <div
        className={cn(
          'max-w-3xl rounded-2xl px-5 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-[var(--foreground)] text-[var(--background)]'
            : 'border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)]',
        )}
      >
        {content}
        {timestamp ? (
          <div
            className={cn(
              'mt-1.5 text-xs',
              isUser ? 'text-[var(--background)] opacity-70' : 'text-[var(--muted)]',
            )}
          >
            {timestamp}
          </div>
        ) : null}
      </div>
    </div>
  )
}
