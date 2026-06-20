'use client'

import { useCallback, useMemo, useState } from 'react'
import { GripVertical, KeyRound, RefreshCw, ScanEye, Sparkles } from 'lucide-react'
import {
  CHAT_MODEL_QUALITY_PRIORITY,
  getEnabledChatModels,
} from '@/shared/ai/gateway/model-data'
import { isByokModelId } from '@/shared/ai/gateway/byok-model-conversion'
import { useByokModels } from '@/components/providers/useByokModels'
import { useGatewayModelCatalog } from '@/components/providers/useGatewayModelCatalog'

function isByokModel(modelId: string): boolean {
  return isByokModelId(modelId)
}

export function ModelCatalogSetting({
  enabledModelIds,
  modelOrder,
  disabled,
  onChange,
}: {
  enabledModelIds: readonly string[]
  modelOrder: readonly string[]
  disabled?: boolean
  onChange: (patch: { enabledChatModelIds?: string[]; modelOrder?: string[] }) => void
}) {
  const { connections: byokConnections, refresh: refreshByok } = useByokModels()
  const { models: gatewayModels, isLoading: gatewayLoading, refresh: refreshGateway } = useGatewayModelCatalog()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const modelCatalogVersion = useMemo(
    () =>
      [
        gatewayModels.map((model) => model.id).join(','),
        byokConnections
          .map((connection) => [
            connection._id,
            connection.status,
            connection.discoveredAt ?? 0,
            connection.enabledModelIds.join(','),
          ].join(':'))
          .join('|'),
      ].join('::'),
    [byokConnections, gatewayModels],
  )

  // Get the ordered list of enabled models
  const orderedModels = useMemo(() => {
    // AVAILABLE_MODELS is updated out-of-band by the catalog hooks above.
    void modelCatalogVersion
    return getEnabledChatModels(enabledModelIds, false, modelOrder)
  }, [enabledModelIds, modelCatalogVersion, modelOrder])

  // Local drag-reorder state — the working order before saving
  const [localOrder, setLocalOrder] = useState<string[] | null>(null)
  const displayModels = useMemo(() => {
    if (!localOrder) return orderedModels
    const orderMap = new Map(localOrder.map((id, i) => [id, i]))
    return [...orderedModels].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
  }, [localOrder, orderedModels])

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    setDropIndex(index)
  }, [dragIndex])

  const handleDrop = useCallback((index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null)
      setDropIndex(null)
      return
    }
    const currentIds = displayModels.map((m) => m.id)
    const [moved] = currentIds.splice(dragIndex, 1)
    currentIds.splice(index, 0, moved)
    setLocalOrder(currentIds)
    setDragIndex(null)
    setDropIndex(null)
  }, [dragIndex, displayModels])

  const handleSaveOrder = useCallback(() => {
    const order = localOrder ?? displayModels.map((m) => m.id)
    onChange({ modelOrder: order })
    setLocalOrder(null)
  }, [localOrder, displayModels, onChange])

  const handleResetOrder = useCallback(() => {
    // Reset to CHAT_MODEL_QUALITY_PRIORITY order
    const priorityIds = CHAT_MODEL_QUALITY_PRIORITY.filter((id) =>
      orderedModels.some((m) => m.id === id),
    )
    const remaining = orderedModels
      .filter((m) => !CHAT_MODEL_QUALITY_PRIORITY.includes(m.id))
      .map((m) => m.id)
    onChange({ modelOrder: [...priorityIds, ...remaining] })
    setLocalOrder(null)
  }, [orderedModels, onChange])

  const hasLocalChanges = localOrder !== null

  return (
    <div className="flex flex-col gap-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">
            Drag to reorder. This is the order models appear in your chat dropdown.
          </p>
          <p className="mt-1 text-xs text-[var(--muted-light)]">
            Enable or disable models from each provider&apos;s edit dialog in the Providers section.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => { void refreshGateway(); void refreshByok() }}
            disabled={gatewayLoading || disabled}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
            aria-label="Refresh models"
          >
            <RefreshCw size={14} className={gatewayLoading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={handleResetOrder}
            disabled={disabled || hasLocalChanges}
            className="hidden h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--foreground)] sm:block disabled:opacity-50"
          >
            Reset to default order
          </button>
        </div>
      </div>

      {/* Save bar when local changes exist */}
      {hasLocalChanges ? (
        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2.5">
          <span className="text-xs text-[var(--muted)]">Unsaved order changes</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocalOrder(null)}
              disabled={disabled}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveOrder}
              disabled={disabled}
              className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Save order
            </button>
          </div>
        </div>
      ) : null}

      {/* Drag-reorderable model list */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
        <div className="border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
          {displayModels.length} enabled model{displayModels.length !== 1 ? 's' : ''}
        </div>
        <div className="divide-y divide-[var(--border)]">
          {displayModels.map((model, index) => {
            const byok = isByokModel(model.id)
            const isDragging = dragIndex === index
            const isDropTarget = dropIndex === index && dragIndex !== null && dragIndex !== index
            return (
              <div
                key={model.id}
                draggable={!disabled}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => { setDragIndex(null); setDropIndex(null) }}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  isDragging ? 'opacity-40' : ''
                } ${isDropTarget ? 'border-t-2 border-[var(--foreground)]' : ''} ${
                  !disabled ? 'cursor-grab hover:bg-[var(--surface-muted)] active:cursor-grabbing' : ''
                }`}
              >
                {/* Drag handle */}
                <GripVertical
                  size={16}
                  className={`shrink-0 text-[var(--muted-light)] ${disabled ? 'opacity-30' : ''}`}
                />

                {/* Model info */}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--foreground)]">{model.name}</span>
                    {model.supportsVision ? (
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#f0f0f0] text-zinc-700">
                        <ScanEye size={11} strokeWidth={1.6} />
                      </span>
                    ) : null}
                    {model.supportsReasoning ? (
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#f0f0f0] text-zinc-700">
                        <Sparkles size={11} strokeWidth={1.6} />
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-[var(--muted)]">
                    <span className="truncate">{model.provider}</span>
                    {byok ? (
                      <>
                        <span>·</span>
                        <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-[var(--muted-light)]">
                          <KeyRound size={9} strokeWidth={2} />
                          BYOK
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Cost badge */}
                <span className="shrink-0">
                  {byok ? (
                    <span className="inline-flex h-5 items-center rounded-full bg-[var(--surface-subtle)] px-1.5 text-[9px] font-semibold leading-none text-[var(--muted)]">
                      BYOK
                    </span>
                  ) : (
                    <span
                      className={`inline-flex h-5 items-center rounded-full px-1.5 text-[9px] font-semibold leading-none ${
                        model.cost === 0
                          ? ''
                          : 'bg-[var(--surface-subtle)] text-[var(--muted)]'
                      }`}
                      style={
                        model.cost === 0
                          ? { background: 'var(--chat-badge-free-bg)', color: 'var(--chat-badge-free-fg)' }
                          : undefined
                      }
                    >
                      {model.cost === 0 ? 'Free' : '$'.repeat(model.cost ?? 1)}
                    </span>
                  )}
                </span>
              </div>
            )
          })}
          {displayModels.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              No models enabled. Add a provider in the Providers section to get started.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
