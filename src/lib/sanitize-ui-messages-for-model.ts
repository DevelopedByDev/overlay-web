import type { UIMessage } from 'ai'

/**
 * `convertToModelMessages` treats any `type` starting with `tool-` as a live tool UI part.
 * Our persisted transcript uses `tool-invocation` (display-only), which becomes bogus
 * "invocation" tool calls and breaks provider validation — Act/Ask then hang or error.
 *
 * For prior turns we only replay **text** (and user files); tool execution context is
 * already reflected in the assistant's written answer.
 */
export function sanitizeUiMessagesForModelApi(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => {
    if (msg.role === 'user') {
      const parts = (msg.parts ?? []).filter((p) => {
        if (p.type === 'text') return true
        if (p.type === 'file') {
          const url = 'url' in p ? (p as { url?: string }).url : undefined
          const mediaType = 'mediaType' in p ? (p as { mediaType?: string }).mediaType : undefined
          return typeof url === 'string' && url.length > 0 && typeof mediaType === 'string' && mediaType.length > 0
        }
        return false
      })
      return { ...msg, parts }
    }

    if (msg.role === 'assistant') {
      const texts: string[] = []
      for (const p of msg.parts ?? []) {
        if (p.type === 'text' && 'text' in p && typeof (p as { text?: string }).text === 'string') {
          texts.push((p as { text: string }).text)
        }
      }
      const merged = texts.join('\n\n').trim()
      return {
        ...msg,
        parts: merged
          ? [{ type: 'text' as const, text: merged }]
          : [{ type: 'text' as const, text: ' ' }],
      }
    }

    return msg
  })
}
