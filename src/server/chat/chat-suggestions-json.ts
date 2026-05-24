export type ChatSuggestionsJson = {
  prompts?: unknown
}

export function extractChatSuggestionsJson(raw: string): string | null {
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  if (!unfenced) return null

  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start === -1 || end <= start) return null

  return unfenced.slice(start, end + 1).trim()
}

export function parseChatSuggestionsJson(raw: string): ChatSuggestionsJson | null {
  const json = extractChatSuggestionsJson(raw)
  if (!json) return null

  try {
    const parsed = JSON.parse(json) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as ChatSuggestionsJson
  } catch {
    return null
  }
}
