'use client'

import { Bot } from 'lucide-react'
import { SettingsActionRow } from '@overlay/modules-react/settings'
import { getModelsByIntelligence } from '@/shared/ai/gateway/model-data'
import { resolveDefaultChatModelSelection } from '@/shared/chat/default-chat-model'

export function DefaultChatModelSetting({
  defaultActModelId,
  defaultAskModelIds,
  isFreeTier,
  onlyAllowZdrModels,
  disabled,
  onSelect,
}: {
  defaultActModelId?: string
  defaultAskModelIds?: readonly string[]
  isFreeTier: boolean
  onlyAllowZdrModels: boolean
  disabled?: boolean
  onSelect: (actModelId: string, askModelIds: string[]) => void
}) {
  const effectiveOnlyAllowZdr = onlyAllowZdrModels && !isFreeTier
  const models = getModelsByIntelligence(isFreeTier)
    .filter((model) => model.id !== 'nvidia/nemotron-nano-9b-v2')
    .filter((model) => !effectiveOnlyAllowZdr || model.supportsZeroDataRetention)

  const currentSelection = resolveDefaultChatModelSelection({
    defaultActModelId,
    defaultAskModelIds,
    isFreeTier,
    onlyAllowZdrModels: effectiveOnlyAllowZdr,
  })
  const currentActModelId = currentSelection.actModelId

  return (
    <SettingsActionRow
      icon={<Bot size={18} strokeWidth={1.8} />}
      title="Default model"
      description="Used when you start a new chat. Existing chats keep the model they last used."
      action={
        <select
          disabled={disabled}
          value={currentActModelId}
          onChange={(event) => {
            const nextActModelId = event.target.value
            onSelect(nextActModelId, [nextActModelId])
          }}
          className="min-w-44 max-w-full rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)] disabled:opacity-60"
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      }
    />
  )
}
