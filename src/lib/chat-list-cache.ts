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

let cachedChats: CachedConversation[] | null = null
let cachedAt = 0
let inFlight: Promise<CachedConversation[]> | null = null

export function getCachedChatList(): CachedConversation[] | null {
  return cachedChats
}

export function primeChatList(chats: CachedConversation[]) {
  cachedChats = chats
  cachedAt = Date.now()
}

export function upsertCachedChat(chat: CachedConversation) {
  const current = cachedChats ?? []
  const existing = current.find((item) => item._id === chat._id)
  const merged = existing ? { ...existing, ...chat } : chat
  cachedChats = [merged, ...current.filter((item) => item._id !== chat._id)]
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

  inFlight = fetch('/api/app/conversations')
    .then(async (res) => {
      if (!res.ok) return cachedChats ?? []
      const chats = await res.json() as CachedConversation[]
      primeChatList(chats)
      return chats
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}
