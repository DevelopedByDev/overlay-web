import { DEFAULT_MODEL_ID } from '@/shared/ai/gateway/model-types'
import { getModel } from '@/shared/ai/gateway/model-data'
import { resolveDefaultChatModelId } from '@/shared/chat/default-chat-model'

/** Persisted chat model selection — shared with ChatInterface and sidebar "new chat" actions. */
export const CHAT_MODEL_KEY = 'overlay_chat_model'
export const ACT_MODEL_KEY = 'overlay_act_model'
function normalizeAskIds(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of raw) {
    // Resolve through the model registry so legacy aliases are normalised, but
    // preserve unknown IDs — the gateway catalog or BYOK connections may not
    // have loaded yet. Replacing them with the fallback here would fight with
    // the default-models effect and cause an infinite render loop.
    const resolved = getModel(id)?.id ?? id
    if (seen.has(resolved)) continue
    seen.add(resolved)
    out.push(resolved)
    if (out.length >= 4) break
  }
  return out
}

export function normalizeChatModelSelection({
  askModelIds,
  actModelId,
  fallbackModelId = DEFAULT_MODEL_ID,
}: {
  askModelIds?: readonly string[]
  actModelId?: string
  fallbackModelId?: string
}): {
  askModelIds: string[]
  actModelId: string
} {
  const fallback = getModel(fallbackModelId)?.id ?? fallbackModelId
  // Preserve unknown actModelId — the model may not be registered yet because
  // the gateway catalog or BYOK connections are still loading. Replacing it
  // with the fallback here would fight with the default-models effect and
  // cause an infinite render loop.
  const resolvedAct = actModelId?.trim() ? (getModel(actModelId)?.id ?? actModelId) : undefined
  let ask = normalizeAskIds([...(askModelIds ?? [])])

  if (resolvedAct && !ask.includes(resolvedAct)) {
    ask = [resolvedAct, ...ask].slice(0, 4)
  }
  if (ask.length === 0) ask = [resolvedAct ?? fallback]

  const act = resolvedAct && ask.includes(resolvedAct)
    ? resolvedAct
    : ask[0] ?? fallback

  return {
    askModelIds: ask,
    actModelId: act,
  }
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
        const norm = normalizeChatModelSelection({ askModelIds: ids }).askModelIds
        if (norm.length > 0) return norm
      }
    } catch {
      const norm = normalizeChatModelSelection({ askModelIds: [saved] }).askModelIds
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
    if (saved) {
      return normalizeChatModelSelection({
        askModelIds: readStoredAskModelIds(),
        actModelId: saved,
      }).actModelId
    }
  } catch {
    /* ignore */
  }
  return readStoredAskModelIds()[0] ?? DEFAULT_MODEL_ID
}

/** Body fields for POST /api/v1/conversations — server clamps models for free tier. */
export function resolveNewChatModelFields({
  defaultActModelId,
  defaultAskModelIds: _defaultAskModelIds = [],
  isFreeTier = false,
  onlyAllowZdrModels = false,
}: {
  defaultActModelId?: string
  defaultAskModelIds?: readonly string[]
  isFreeTier?: boolean
  onlyAllowZdrModels?: boolean
}): {
  askModelIds: string[]
  actModelId: string
  lastMode: 'act'
} {
  void _defaultAskModelIds
  const actModelId = resolveDefaultChatModelId({
    defaultActModelId,
    isFreeTier,
    onlyAllowZdrModels,
  })
  return {
    askModelIds: [actModelId],
    actModelId,
    lastMode: 'act',
  }
}

/** @deprecated Use {@link resolveNewChatModelFields} with app settings instead. */
export function readNewChatModelFieldsFromStorage(): {
  askModelIds: string[]
  actModelId: string
  lastMode: 'act'
} {
  return resolveNewChatModelFields({})
}
