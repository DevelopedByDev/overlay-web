'use client'

import { Bot } from 'lucide-react'
import { SettingsActionRow } from '@overlay/modules-react/settings'
import { getEnabledChatModels } from '@/shared/ai/gateway/model-data'
import { useGatewayModelCatalog } from '@/components/providers/useGatewayModelCatalog'
import { useByokModels } from '@/components/providers/useByokModels'
import { resolveDefaultChatModelId } from '@/shared/chat/default-chat-model'

export function DefaultChatModelSetting({
  defaultActModelId,
  isFreeTier,
  onlyAllowZdrModels,
  enabledModelIds,
  modelOrder,
  disabled,
  onSelect,
}: {
  defaultActModelId?: string
  isFreeTier: boolean
  onlyAllowZdrModels: boolean
  enabledModelIds: readonly string[]
  modelOrder?: readonly string[]
  disabled?: boolean
  onSelect: (actModelId: string) => void
}) {
  useGatewayModelCatalog()
  useByokModels()
  const effectiveOnlyAllowZdr = onlyAllowZdrModels && !isFreeTier
  const models = getEnabledChatModels(enabledModelIds, isFreeTier, modelOrder)
    .filter((model) => model.id !== 'nvidia/nemotron-nano-9b-v2')
    .filter((model) => !effectiveOnlyAllowZdr || model.supportsZeroDataRetention)

  const currentActModelId = resolveDefaultChatModelId({
    defaultActModelId,
    isFreeTier,
    onlyAllowZdrModels: effectiveOnlyAllowZdr,
  })

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
            onSelect(event.target.value)
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
