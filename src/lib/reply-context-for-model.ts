import type { UIMessage } from 'ai'

/** Appends hidden-from-UI-thread context to the last user turn for the model only (persistence uses raw user text). */
export function mergeReplyContextIntoMessagesForModel(
  messages: UIMessage[],
  replyContextForModel: string | undefined,
): UIMessage[] {
  const ctx = replyContextForModel?.trim()
  if (!ctx) return messages

  const out = messages.map((m) => ({
    ...m,
    parts: m.parts ? m.parts.map((p) => ({ ...p })) : undefined,
  })) as UIMessage[]

  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i]!.role !== 'user') continue
    // Narrow for mutation: we only append to a text part or add a text part.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts = [...(out[i]!.parts ?? [])] as any[]
    const ti = parts.findIndex((p: { type?: string }) => p.type === 'text')
    const block = `\n\n---\n[User is replying in thread to your prior assistant message]\n${ctx}`
    if (ti >= 0) {
      const p = parts[ti] as { type: string; text?: string }
      if (p.type === 'text') {
        parts[ti] = { ...p, text: (p.text || '') + block }
      }
    } else {
      parts.push({ type: 'text', text: block.trim() })
    }
    out[i] = { ...out[i]!, parts } as UIMessage
    break
  }
  return out
}
