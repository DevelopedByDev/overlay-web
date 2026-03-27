import type { UIMessage } from 'ai'
import { summarizeToolResultForTranscript } from '@/lib/tool-result-summary'

/**
 * `convertToModelMessages` treats any `type` starting with `tool-` as a live tool UI part.
 * Our persisted transcript uses `tool-invocation` (display-only), which becomes bogus
 * "invocation" tool calls and breaks provider validation — Act/Ask then hang or error.
 *
 * For prior turns we only replay **text** (and user files); tool execution context is
 * already reflected in the assistant's written answer.
 */
export function sanitizeUiMessagesForModelApi(messages: UIMessage[]): UIMessage[] {
  const sanitized: UIMessage[] = []

  for (const msg of messages) {
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
      sanitized.push({ ...msg, parts })
      continue
    }

    if (msg.role === 'assistant') {
      const texts: string[] = []
      for (const p of msg.parts ?? []) {
        if (p.type === 'text' && 'text' in p && typeof (p as { text?: string }).text === 'string') {
          const text = (p as { text: string }).text.trim()
          if (text) texts.push(text)
        }
        if (
          p.type === 'tool-invocation' &&
          'toolInvocation' in p &&
          p.toolInvocation &&
          typeof p.toolInvocation === 'object'
        ) {
          const invocation = p.toolInvocation as {
            toolName?: string
            state?: string
            toolInput?: unknown
            toolOutput?: unknown
          }
          const summary = summarizeToolResultForTranscript({
            toolName: invocation.toolName,
            state: invocation.state,
            toolInput: invocation.toolInput,
            toolOutput: invocation.toolOutput,
          })
          if (summary) texts.push(summary)
        }
      }
      const merged = texts.join('\n\n').trim()
      if (!merged) continue
      sanitized.push({
        ...msg,
        parts: [{ type: 'text' as const, text: merged }],
      })
      continue
    }

    sanitized.push(msg)
  }

  return sanitized
}
