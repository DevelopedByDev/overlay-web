import {
  FREE_TIER_AUTO_MODEL_ID,
  PAID_TIER_DEFAULT_MODEL_ID,
  isFreeTierChatModelId,
  resolveFreeTierChatModelId,
} from '@/shared/ai/gateway/model-types'
import { getModel, modelSupportsZeroDataRetention } from '@/shared/ai/gateway/model-data'
import { normalizeChatModelSelection } from '@/shared/chat/chat-model-prefs'

export function tierDefaultActModelId(isFreeTier: boolean): string {
  return isFreeTier ? FREE_TIER_AUTO_MODEL_ID : PAID_TIER_DEFAULT_MODEL_ID
}

/**
 * Resolves the single default chat model ID for new conversations.
 * Ask mode has been removed — every conversation uses a single model.
 */
export function resolveDefaultChatModelId({
  defaultActModelId,
  isFreeTier,
  onlyAllowZdrModels = false,
}: {
  defaultActModelId?: string
  isFreeTier: boolean
  onlyAllowZdrModels?: boolean
}): string {
  const tierDefault = tierDefaultActModelId(isFreeTier)

  let actModelId = defaultActModelId?.trim() || undefined

  if (isFreeTier) {
    actModelId = actModelId ? resolveFreeTierChatModelId(actModelId) ?? tierDefault : tierDefault
  } else if (onlyAllowZdrModels) {
    actModelId = actModelId && modelSupportsZeroDataRetention(actModelId) ? actModelId : tierDefault
  }

  if (!actModelId) actModelId = tierDefault
  if (isFreeTier && !isFreeTierChatModelId(actModelId)) actModelId = tierDefault
  if (onlyAllowZdrModels && !isFreeTier && !modelSupportsZeroDataRetention(actModelId)) actModelId = tierDefault

  return actModelId
}

/**
 * @deprecated Use {@link resolveDefaultChatModelId} instead. Ask mode has been removed.
 * Kept for backward compat with code that still expects the old shape.
 */
export function resolveDefaultChatModelSelection({
  defaultActModelId,
  defaultAskModelIds: _defaultAskModelIds = [],
  isFreeTier,
  onlyAllowZdrModels = false,
}: {
  defaultActModelId?: string
  defaultAskModelIds?: readonly string[]
  isFreeTier: boolean
  onlyAllowZdrModels?: boolean
}): {
  askModelIds: string[]
  actModelId: string
} {
  void _defaultAskModelIds
  const actModelId = resolveDefaultChatModelId({ defaultActModelId, isFreeTier, onlyAllowZdrModels })
  return normalizeChatModelSelection({
    askModelIds: [actModelId],
    actModelId,
    fallbackModelId: actModelId,
  })
}

export function resolveDefaultChatModelDisplayName({
  defaultActModelId,
  isFreeTier,
  onlyAllowZdrModels = false,
}: {
  defaultActModelId?: string
  defaultAskModelIds?: readonly string[]
  isFreeTier: boolean
  onlyAllowZdrModels?: boolean
}): string {
  const actModelId = resolveDefaultChatModelId({ defaultActModelId, isFreeTier, onlyAllowZdrModels })
  return getModel(actModelId)?.name ?? actModelId
}
