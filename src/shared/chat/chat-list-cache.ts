import { overlayAppClient } from '@/shared/app/overlay-app-client'
import { isPaginatedEnvelope, type PaginatedEnvelope } from '@/shared/api/pagination'

export type CachedConversation = {
  _id: string
  title: string
  lastModified: number
  createdAt?: number
  updatedAt?: number
  lastMode?: 'ask' | 'act'
  askModelIds?: string[]
  modelIds?: string[]
  actModelId?: string
}

const CACHE_TTL_MS = 15_000
export const INITIAL_CHAT_LIST_LIMIT = 24

export type ChatListPageInfo = {
  nextCursor?: string
  hasMore: boolean
}

let cachedChats: CachedConversation[] | null = null
let cachedAt = 0
let inFlight: Promise<CachedConversation[]> | null = null
let nextPageInFlight: Promise<CachedConversation[]> | null = null
let cachedPageInfo: ChatListPageInfo = { hasMore: false }

function sortByLastModified(chats: CachedConversation[]): CachedConversation[] {
  return [...chats].sort((a, b) => {
    const bTime = b.lastModified ?? b.updatedAt ?? b.createdAt ?? 0
    const aTime = a.lastModified ?? a.updatedAt ?? a.createdAt ?? 0
    return bTime - aTime
  })
}

export function getCachedChatList(): CachedConversation[] | null {
  return cachedChats
}

export function getCachedChatListPageInfo(): ChatListPageInfo {
  return cachedPageInfo
}

export function primeChatList(
  chats: CachedConversation[],
  pageInfo: ChatListPageInfo = { hasMore: false },
) {
  cachedChats = sortByLastModified(chats)
  cachedPageInfo = pageInfo
  cachedAt = Date.now()
}

export function upsertCachedChat(chat: CachedConversation) {
  const current = cachedChats ?? []
  const existing = current.find((item) => item._id === chat._id)
  const merged = existing ? { ...existing, ...chat } : chat
  cachedChats = sortByLastModified([merged, ...current.filter((item) => item._id !== chat._id)])
  cachedAt = Date.now()
}

export function removeCachedChat(chatId: string) {
  if (!cachedChats) return
  cachedChats = cachedChats.filter((chat) => chat._id !== chatId)
  cachedAt = Date.now()
}

export async function fetchChatList(options: { force?: boolean } = {}): Promise<CachedConversation[]> {
  const now = Date.now()
  if (!options.force && cachedChats && now - cachedAt < CACHE_TTL_MS) {
    return cachedChats
  }
  if (!options.force && inFlight) return inFlight

  inFlight = overlayAppClient.conversations.getResponse({ limit: INITIAL_CHAT_LIST_LIMIT })
    .then(async (res) => {
      if (!res.ok) return cachedChats ?? []
      const payload = await res.json()
      if (!isPaginatedEnvelope<CachedConversation>(payload)) return cachedChats ?? []
      primeChatList(payload.data, {
        nextCursor: payload.nextCursor,
        hasMore: payload.hasMore,
      })
      return payload.data
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

export async function fetchNextChatListPage(): Promise<CachedConversation[]> {
  if (!cachedPageInfo.hasMore || !cachedPageInfo.nextCursor) return cachedChats ?? []
  if (nextPageInFlight) return nextPageInFlight

  nextPageInFlight = overlayAppClient.conversations.getResponse({
    cursor: cachedPageInfo.nextCursor,
    limit: INITIAL_CHAT_LIST_LIMIT,
  })
    .then(async (res) => {
      if (!res.ok) return cachedChats ?? []
      const payload = await res.json() as PaginatedEnvelope<CachedConversation>
      if (!isPaginatedEnvelope<CachedConversation>(payload)) return cachedChats ?? []
      const current = cachedChats ?? []
      const byId = new Map(current.map((chat) => [chat._id, chat]))
      for (const chat of payload.data) {
        byId.set(chat._id, { ...byId.get(chat._id), ...chat })
      }
      const merged = [...byId.values()]
      primeChatList(merged, {
        nextCursor: payload.nextCursor,
        hasMore: payload.hasMore,
      })
      return getCachedChatList() ?? merged
    })
    .finally(() => {
      nextPageInFlight = null
    })

  return nextPageInFlight
}
