export const CHAT_TITLE_UPDATED_EVENT = 'overlay:chat-title-updated'
export const CHAT_CREATED_EVENT = 'overlay:chat-created'
const FALLBACK_CHAT_TITLE = 'New Chat'

export interface ChatTitleUpdatedDetail {
  chatId: string
  title: string
}

export interface ChatCreatedDetail {
  chat: {
    _id: string
    title: string
    lastModified: number
  }
}

export function sanitizeChatTitle(title: string | null | undefined, fallback = FALLBACK_CHAT_TITLE): string {
  const normalized = (title || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'`“”]+|["'`“”]+$/g, '')
    .replace(/[.!?,;:]+$/g, '')
    .trim()

  const limited = normalized.slice(0, 60).trim()
  return limited || fallback
}

export function dispatchChatTitleUpdated(detail: ChatTitleUpdatedDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ChatTitleUpdatedDetail>(CHAT_TITLE_UPDATED_EVENT, { detail }))
}

export function dispatchChatCreated(detail: ChatCreatedDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ChatCreatedDetail>(CHAT_CREATED_EVENT, { detail }))
}
