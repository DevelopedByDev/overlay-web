'use client'

import { MessageSquare, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { MouseEvent } from 'react'

export type ChatHistoryItem = {
  _id: string
  title: string
  lastModified: number
  updatedAt?: number
}

const ABSOLUTE_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
})

const SHORT_DATE_WITH_YEAR_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatChatTimestamp(ms: number): { short: string; full: string } {
  if (!Number.isFinite(ms) || ms <= 0) return { short: '', full: '' }
  const date = new Date(ms)
  const now = Date.now()
  const diffMs = now - ms
  const full = ABSOLUTE_TIMESTAMP_FORMATTER.format(date)

  if (diffMs < 60_000) return { short: 'now', full }
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return { short: `${minutes}m`, full }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { short: `${hours}h`, full }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfDate = new Date(date)
  startOfDate.setHours(0, 0, 0, 0)
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000)
  if (dayDiff === 1) return { short: 'Yesterday', full }
  if (dayDiff < 7) return { short: `${dayDiff}d`, full }

  if (date.getFullYear() === new Date().getFullYear()) {
    return { short: SHORT_DATE_FORMATTER.format(date), full }
  }
  return { short: SHORT_DATE_WITH_YEAR_FORMATTER.format(date), full }
}

type ChatHistorySidebarProps = {
  chats: ChatHistoryItem[]
  activeChatId: string | null
  sessions: Record<string, { status?: string } | undefined>
  getUnread: (chatId: string) => number
  editingChatId: string | null
  editingChatTitle: string
  deletingChatIds: string[]
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  onCreateChat: () => void | Promise<unknown>
  onSelectChat: (chatId: string) => void | Promise<void>
  onBeginRename: (chatId: string, title: string, event: MouseEvent<HTMLButtonElement>) => void
  onEditingTitleChange: (title: string) => void
  onCommitRename: (chatId: string) => void | Promise<void>
  onCancelRename: () => void
  onRequestDelete: (chat: ChatHistoryItem, event: MouseEvent<HTMLButtonElement>) => void
}

function ChatHistoryRow({
  chat,
  activeChatId,
  isStreaming,
  unread,
  isEditing,
  editingChatTitle,
  isDeleting,
  mobile,
  onSelect,
  onBeginRename,
  onEditingTitleChange,
  onCommitRename,
  onCancelRename,
  onRequestDelete,
}: {
  chat: ChatHistoryItem
  activeChatId: string | null
  isStreaming: boolean
  unread: number
  isEditing: boolean
  editingChatTitle: string
  isDeleting: boolean
  mobile?: boolean
  onSelect: () => void
  onBeginRename: (event: MouseEvent<HTMLButtonElement>) => void
  onEditingTitleChange: (title: string) => void
  onCommitRename: () => void | Promise<void>
  onCancelRename: () => void
  onRequestDelete: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  const timestamp = formatChatTimestamp(chat.lastModified)
  return (
    <div
      onClick={() => {
        if (isDeleting) return
        if (isEditing) return
        onSelect()
      }}
      className={`group flex ${mobile ? '' : 'cursor-pointer'} items-center justify-between overflow-hidden rounded-md px-2.5 text-xs transition-all duration-200 ${
        isDeleting ? 'max-h-0 -translate-y-1 py-0 opacity-0' : mobile ? 'max-h-11 py-2 opacity-100' : 'max-h-10 py-1.5 opacity-100'
      } ${
        activeChatId === chat._id
          ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
          : 'text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]'
      }`}
    >
      {isEditing ? (
        <input
          autoFocus
          value={editingChatTitle}
          onChange={(event) => onEditingTitleChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void onCommitRename()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onCancelRename()
            }
          }}
          onBlur={() => void onCommitRename()}
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[11px] text-[var(--foreground)] outline-none"
        />
      ) : (
        <span className="flex-1 truncate">{chat.title}</span>
      )}
      {isStreaming && !unread && (
        <span className="ml-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--muted)]" />
      )}
      {unread > 0 && (
        <span className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[9px] font-medium text-[var(--background)]">
          {unread}
        </span>
      )}
      {!isEditing && timestamp.short ? (
        <time
          dateTime={new Date(chat.lastModified).toISOString()}
          title={timestamp.full}
          className="ml-2 shrink-0 text-[10px] tabular-nums text-[var(--muted)] transition-opacity group-hover:opacity-0"
        >
          {timestamp.short}
        </time>
      ) : null}
      {!isEditing ? (
        <>
          <button
            type="button"
            onClick={onBeginRename}
            className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
            aria-label="Rename chat"
          >
            <Pencil size={11} />
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
            aria-label="Delete chat"
          >
            <Trash2 size={11} />
          </button>
        </>
      ) : null}
    </div>
  )
}

export function ChatHistorySidebar({
  chats,
  activeChatId,
  sessions,
  getUnread,
  editingChatId,
  editingChatTitle,
  deletingChatIds,
  mobileOpen,
  onMobileOpenChange,
  onCreateChat,
  onSelectChat,
  onBeginRename,
  onEditingTitleChange,
  onCommitRename,
  onCancelRename,
  onRequestDelete,
}: ChatHistorySidebarProps) {
  const rows = (mobile: boolean) => (
    <div className="space-y-0.5">
      {chats.map((chat) => {
        const isStreaming = sessions[chat._id]?.status === 'streaming'
        const unread = getUnread(chat._id)
        const isEditing = editingChatId === chat._id
        const isDeleting = deletingChatIds.includes(chat._id)
        return (
          <ChatHistoryRow
            key={chat._id}
            chat={chat}
            activeChatId={activeChatId}
            isStreaming={isStreaming}
            unread={unread}
            isEditing={isEditing}
            editingChatTitle={editingChatTitle}
            isDeleting={isDeleting}
            mobile={mobile}
            onSelect={() => {
              void onSelectChat(chat._id)
              if (mobile) onMobileOpenChange(false)
            }}
            onBeginRename={(event) => onBeginRename(chat._id, chat.title, event)}
            onEditingTitleChange={onEditingTitleChange}
            onCommitRename={() => onCommitRename(chat._id)}
            onCancelRename={onCancelRename}
            onRequestDelete={(event) => onRequestDelete(chat, event)}
          />
        )
      })}
    </div>
  )

  return (
    <>
      <div className="hidden h-full w-52 flex-col border-r border-[var(--border)] bg-[var(--surface-muted)] md:flex">
        <div className="flex h-16 items-center border-b border-[var(--border)] px-3">
          <button
            onClick={() => void onCreateChat()}
            className="flex w-full items-center gap-1.5 rounded-md bg-[var(--foreground)] px-3 py-1.5 text-sm text-[var(--background)] transition-colors hover:opacity-80"
          >
            <Plus size={13} />
            New chat
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {rows(false)}
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close chat list"
            className="absolute inset-0 bg-black/40"
            onClick={() => onMobileOpenChange(false)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 flex max-h-[min(78vh,560px)] flex-col rounded-t-2xl border border-[var(--border)] border-b-0 bg-[var(--surface-muted)] shadow-[0_-8px_40px_rgba(0,0,0,0.12)]"
            role="dialog"
            aria-modal="true"
            aria-label="Chat history"
          >
            <div className="flex shrink-0 items-center justify-center pb-1 pt-2">
              <span className="h-1 w-12 rounded-full bg-[var(--border)]" aria-hidden />
            </div>
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
              <span className="text-sm font-medium text-[var(--foreground)]">Chats</span>
              <button
                type="button"
                onClick={() => onMobileOpenChange(false)}
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="border-b border-[var(--border)] px-3 py-2">
              <button
                onClick={() => {
                  void Promise.resolve(onCreateChat()).then(() => onMobileOpenChange(false))
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--foreground)] px-3 py-2 text-sm text-[var(--background)] transition-colors hover:opacity-80"
              >
                <Plus size={13} />
                New chat
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {rows(true)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function ChatHistoryMobileBar({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur md:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-center gap-2 py-2.5 text-xs font-medium text-[var(--muted)] active:bg-[var(--surface-subtle)]"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <MessageSquare size={15} strokeWidth={1.75} />
        Chats
      </button>
    </div>
  )
}
