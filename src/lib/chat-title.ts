export const CHAT_TITLE_UPDATED_EVENT = 'overlay:chat-title-updated'
const FALLBACK_CHAT_TITLE = 'New Chat'

export interface ChatTitleUpdatedDetail {
  chatId: string
  title: string
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
