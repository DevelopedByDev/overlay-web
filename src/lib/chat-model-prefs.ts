import { DEFAULT_MODEL_ID } from '@/lib/model-types'
import { getModel } from '@/lib/model-data'

/** Persisted chat model selection — shared with ChatInterface and sidebar "new chat" actions. */
export const CHAT_MODEL_KEY = 'overlay_chat_model'
export const ACT_MODEL_KEY = 'overlay_act_model'
function normalizeAskIds(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of raw) {
    const m = getModel(id)
    if (!m || seen.has(m.id)) continue
    seen.add(m.id)
    out.push(m.id)
    if (out.length >= 4) break
  }
  return out
}

/** Read preferred Ask slot model ids from localStorage (browser only). */
export function readStoredAskModelIds(): string[] {
  if (typeof window === 'undefined') return [DEFAULT_MODEL_ID]
  try {
    const saved = localStorage.getItem(CHAT_MODEL_KEY)
    if (!saved) return [DEFAULT_MODEL_ID]
    try {
      const parsed = JSON.parse(saved) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        const ids = parsed.filter((id): id is string => typeof id === 'string')
        const norm = normalizeAskIds(ids)
        if (norm.length > 0) return norm
      }
    } catch {
      const norm = normalizeAskIds([saved])
      if (norm.length > 0) return norm
    }
  } catch {
    /* ignore */
  }
  return [DEFAULT_MODEL_ID]
}

/** Read preferred Act model from localStorage. */
export function readStoredActModelId(): string {
  if (typeof window === 'undefined') return DEFAULT_MODEL_ID
  try {
    const saved = localStorage.getItem(ACT_MODEL_KEY)?.trim()
    if (saved && getModel(saved)) return getModel(saved)!.id
  } catch {
    /* ignore */
  }
  return readStoredAskModelIds()[0] ?? DEFAULT_MODEL_ID
}

/** Body fields for POST /api/app/conversations from sidebar — server clamps models for free tier. */
export function readNewChatModelFieldsFromStorage(): {
  askModelIds: string[]
  actModelId: string
  lastMode: 'act'
} {
  return {
    askModelIds: readStoredAskModelIds(),
    actModelId: readStoredActModelId(),
    lastMode: 'act',
  }
}
