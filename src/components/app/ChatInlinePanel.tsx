'use client'

import { useState, useCallback, useEffect, type MouseEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MessageSquare, Check, Pencil, Trash2 } from 'lucide-react'
import { SidebarListSkeleton } from '@/components/ui/Skeleton'
import { useAsyncSessions } from '@/lib/async-sessions-store'
import {
  CHAT_CREATED_EVENT,
  CHAT_DELETED_EVENT,
  CHAT_MODIFIED_EVENT,
  CHAT_TITLE_UPDATED_EVENT,
  dispatchChatDeleted,
  dispatchChatTitleUpdated,
  sanitizeChatTitle,
  type ChatCreatedDetail,
  type ChatDeletedDetail,
  type ChatTitleUpdatedDetail,
} from '@/lib/chat-title'
import { fetchChatList, getCachedChatList, removeCachedChat, upsertCachedChat } from '@/lib/chat-list-cache'

const panelItemClass =
  'group flex h-7 items-center gap-2 rounded-md px-2.5 py-0 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
const inlineConfirmDeleteButtonClass =
  'ml-1 inline-flex h-5 shrink-0 items-center rounded-full bg-red-500/15 px-2 text-[11px] font-medium leading-none text-red-500 transition-colors hover:bg-red-500/25'

type Conversation = { _id: string; title: string; lastModified: number }

export function ChatInlinePanel({
  refreshKey,
  searchQuery = '',
  onNavigate,
}: {
  refreshKey: number
  searchQuery?: string
  onNavigate?: () => void
}) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const { sessions, getUnread } = useAsyncSessions()
  const [chats, setChats] = useState<Conversation[]>(() => getCachedChatList() ?? [])
  const [loading, setLoading] = useState(() => !getCachedChatList())
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deletingChatIds, setDeletingChatIds] = useState<string[]>([])
  const [pendingDeleteChatId, setPendingDeleteChatId] = useState<string | null>(null)
  const activeId = searchParams?.get('id') ?? null

  const loadChats = useCallback(async (options: { force?: boolean } = {}) => {
    try {
      setChats(await fetchChatList(options))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!getCachedChatList()) setLoading(true)
    void loadChats()
  }, [loadChats, refreshKey])

  useEffect(() => {
    function handleChatUpserted(event: Event) {
      const { detail } = event as CustomEvent<ChatCreatedDetail>
      const nextChat = detail?.chat
      if (!nextChat?._id) return
      upsertCachedChat(nextChat)
      setLoading(false)
      setChats((prev) => {
        const existingIndex = prev.findIndex((chat) => chat._id === nextChat._id)
        if (existingIndex === -1) return [nextChat, ...prev]
        const existing = prev[existingIndex]
        const merged = {
          ...existing,
          ...nextChat,
          title: nextChat.title || existing.title,
        }
        const withoutExisting = prev.filter((chat) => chat._id !== nextChat._id)
        return [merged, ...withoutExisting]
      })
    }

    function handleChatTitleUpdated(event: Event) {
      const { detail } = event as CustomEvent<ChatTitleUpdatedDetail>
      if (!detail?.chatId || !detail.title) return
      upsertCachedChat({
        _id: detail.chatId,
        title: detail.title,
        lastModified: Date.now(),
      })
      setChats((prev) => {
        const existing = prev.find((chat) => chat._id === detail.chatId)
        if (!existing) return prev
        const updated = { ...existing, title: detail.title, lastModified: Date.now() }
        return [updated, ...prev.filter((chat) => chat._id !== detail.chatId)]
      })
    }

    function handleChatDeleted(event: Event) {
      const { detail } = event as CustomEvent<ChatDeletedDetail>
      if (!detail?.chatId) return
      const deletedChatId = detail.chatId
      removeCachedChat(deletedChatId)
      setDeletingChatIds((prev) => (
        prev.includes(deletedChatId) ? prev : [...prev, deletedChatId]
      ))
      window.setTimeout(() => {
        setChats((prev) => prev.filter((chat) => chat._id !== deletedChatId))
        setDeletingChatIds((prev) => prev.filter((id) => id !== deletedChatId))
      }, 180)
    }
    window.addEventListener(CHAT_CREATED_EVENT, handleChatUpserted)
    window.addEventListener(CHAT_MODIFIED_EVENT, handleChatUpserted)
    window.addEventListener(CHAT_TITLE_UPDATED_EVENT, handleChatTitleUpdated)
    window.addEventListener(CHAT_DELETED_EVENT, handleChatDeleted)
    return () => {
      window.removeEventListener(CHAT_CREATED_EVENT, handleChatUpserted)
      window.removeEventListener(CHAT_MODIFIED_EVENT, handleChatUpserted)
      window.removeEventListener(CHAT_TITLE_UPDATED_EVENT, handleChatTitleUpdated)
      window.removeEventListener(CHAT_DELETED_EVENT, handleChatDeleted)
    }
  }, [])

  function beginRename(chat: Conversation, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    setPendingDeleteChatId(null)
    setEditingChatId(chat._id)
    setEditingTitle(chat.title)
  }

  function cancelRename() {
    setEditingChatId(null)
    setEditingTitle('')
  }

  async function saveRename(chatId: string) {
    const previousTitle = chats.find((chat) => chat._id === chatId)?.title ?? 'New Chat'
    const nextTitle = sanitizeChatTitle(editingTitle, previousTitle)
    cancelRename()
    if (nextTitle === previousTitle) return

    setChats((prev) => prev.map((chat) => (
      chat._id === chatId ? { ...chat, title: nextTitle } : chat
    )))
    dispatchChatTitleUpdated({ chatId, title: nextTitle })

    try {
      const response = await fetch('/api/app/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: chatId, title: nextTitle }),
      })
      if (!response.ok) throw new Error('Failed to rename chat')
    } catch {
      setChats((prev) => prev.map((chat) => (
        chat._id === chatId ? { ...chat, title: previousTitle } : chat
      )))
      dispatchChatTitleUpdated({ chatId, title: previousTitle })
    }
  }

  function requestDeleteChat(chat: Conversation, event: MouseEvent) {
    event.stopPropagation()
    setEditingChatId(null)
    setPendingDeleteChatId(chat._id)
  }

  async function confirmDeleteChatAction(chatId: string, event: MouseEvent) {
    event.stopPropagation()
    setPendingDeleteChatId(null)
    dispatchChatDeleted({ chatId })
    await fetch(`/api/app/conversations?conversationId=${chatId}`, { method: 'DELETE' })
    if (activeId === chatId) {
      router.push('/app/chat')
    }
  }

  const filteredChats = searchQuery.trim()
    ? chats.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : chats

  return (
    <div className="space-y-0.5">
      {loading ? (
        <SidebarListSkeleton rows={6} />
      ) : filteredChats.length === 0 ? (
        <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">{chats.length === 0 ? 'No chats yet' : 'No results'}</p>
      ) : filteredChats.map((chat) => {
        const isStreaming = sessions[chat._id]?.status === 'streaming'
        const unread = getUnread(chat._id)
        const active = activeId === chat._id
        const isEditing = editingChatId === chat._id
        const isDeleting = deletingChatIds.includes(chat._id)
        const isConfirmingDelete = pendingDeleteChatId === chat._id
        return (
          <div
            key={chat._id}
            onMouseLeave={() => {
              if (isConfirmingDelete) setPendingDeleteChatId(null)
            }}
            onClick={() => {
              if (isDeleting) return
              if (isEditing) return
              const href = `/app/chat?id=${encodeURIComponent(chat._id)}`
              if (pathname === '/app/chat') {
                window.history.pushState(null, '', href)
                window.dispatchEvent(new CustomEvent('overlay:chat-route-selected', {
                  detail: { chatId: chat._id },
                }))
              } else {
                router.push(href)
              }
              onNavigate?.()
            }}
            className={`${panelItemClass} cursor-pointer overflow-hidden transition-all duration-200 ${
              isDeleting ? 'max-h-0 -translate-y-1 opacity-0' : 'max-h-7 opacity-100'
            } ${active ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''}`}
          >
            <MessageSquare size={12} className="shrink-0" />
            {isEditing ? (
              <input
                autoFocus
                value={editingTitle}
                onChange={(event) => setEditingTitle(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void saveRename(chat._id)
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    cancelRename()
                  }
                }}
                onBlur={() => void saveRename(chat._id)}
                className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[11px] text-[var(--foreground)] outline-none"
              />
            ) : (
              <span className="min-w-0 flex-1 truncate">{chat.title}</span>
            )}
            {isStreaming && !unread ? (
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--muted)]" />
            ) : null}
            {unread > 0 ? (
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[9px] font-medium text-[var(--background)]">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
            {isEditing ? (
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void saveRename(chat._id)
                }}
                className="ml-1 shrink-0 rounded p-0.5 text-[var(--foreground)] hover:bg-[var(--border)]"
                aria-label="Save chat name"
              >
                <Check size={11} />
              </button>
            ) : (
              <>
                {isConfirmingDelete ? (
                  <button
                    type="button"
                    onClick={(event) => void confirmDeleteChatAction(chat._id, event)}
                    className={inlineConfirmDeleteButtonClass}
                    aria-label="Confirm delete chat"
                  >
                    Confirm
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={(event) => beginRename(chat, event)}
                      className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
                      aria-label="Rename chat"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => requestDeleteChat(chat, event)}
                      className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
                      aria-label="Delete chat"
                    >
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
