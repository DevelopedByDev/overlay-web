import { ArrowUp, BrainCircuit, Check, DollarSign, ImageIcon, ShieldCheck, X, Zap } from 'lucide-react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

export interface ChatModelIndicatorModel {
  cost: number
  supportsVision?: boolean
  supportsReasoning?: boolean
  supportsZeroDataRetention?: boolean
  intelligence?: number
  pricePer1mTokens?: number
  medianOutputTokensPerSecond?: number
}

export function ModelBadges({
  model,
  isFreeTier,
  onUpgradeClick,
}: {
  model: ChatModelIndicatorModel
  isFreeTier: boolean
  onUpgradeClick?: () => void
}) {
  const showUpgrade = isFreeTier && model.cost > 0

  function handleUpgradeClick(event: MouseEvent<HTMLSpanElement>) {
    event.stopPropagation()
    onUpgradeClick?.()
  }

  function handleUpgradeKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.stopPropagation()
      onUpgradeClick?.()
    }
  }

  return (
    <span className="flex h-5 shrink-0 items-center gap-1">
      {showUpgrade && (
        <span
          role="button"
          tabIndex={0}
          onClick={handleUpgradeClick}
          onKeyDown={handleUpgradeKeyDown}
          className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded"
          style={{ background: 'var(--chat-badge-upgrade-bg)', color: 'var(--chat-badge-upgrade-fg)' }}
        >
          <ArrowUp size={10} strokeWidth={2} />
        </span>
      )}
      {model.supportsVision && (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--surface-subtle)] text-[var(--muted)]">
          <ImageIcon size={10} strokeWidth={1.75} />
        </span>
      )}
      {model.supportsReasoning && (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--surface-subtle)] text-[var(--muted)]">
          <BrainCircuit size={10} strokeWidth={1.75} />
        </span>
      )}
    </span>
  )
}

function MetricRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
        <Icon size={11} strokeWidth={1.75} className="shrink-0 text-[var(--muted-light)]" />
        <span>{label}</span>
      </div>
      <span className="whitespace-nowrap text-[11px] font-medium tabular-nums text-[var(--foreground)]">{value}</span>
    </div>
  )
}

export function ModelQualitiesPanel({ model }: { model: ChatModelIndicatorModel | null | undefined }) {
  if (!model) return null
  return (
    <div className="pointer-events-none flex flex-col gap-1">
      <MetricRow
        icon={BrainCircuit}
        label="Intelligence"
        value={Math.round(model.intelligence ?? 0)}
      />
      <MetricRow
        icon={DollarSign}
        label="Cost"
        value={model.cost === 0 ? 'Free' : `$${(model.pricePer1mTokens ?? model.cost).toFixed(2)}/M`}
      />
      <MetricRow
        icon={Zap}
        label="Speed"
        value={model.medianOutputTokensPerSecond ? `${Math.round(model.medianOutputTokensPerSecond)} t/s` : 'N/A'}
      />
      <MetricRow
        icon={ShieldCheck}
        label="ZDR"
        value={
          <span className="inline-flex items-center gap-1 text-[var(--foreground)]">
            {model.supportsZeroDataRetention ? <Check size={11} strokeWidth={2} /> : <X size={11} strokeWidth={2} />}
          </span>
        }
      />
    </div>
  )
}
