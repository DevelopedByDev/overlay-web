'use client'

import { AlertCircle } from 'lucide-react'
import { UsageMeterBar } from '@overlay/ui/primitives'
import { formatBytes } from '@/shared/storage/storage-limits'

export interface SidebarEntitlements {
  tier: 'free' | 'pro' | 'max'
  planKind?: 'free' | 'paid'
  creditsUsed: number
  creditsTotal: number
  budgetUsedCents?: number
  budgetTotalCents?: number
  budgetRemainingCents?: number
  dailyUsage: { ask: number; write: number; agent: number }
  overlayStorageBytesUsed: number
  overlayStorageBytesLimit: number
}

export function UsageBar({ entitlements }: { entitlements: SidebarEntitlements | null }) {
  if (!entitlements) {
    return <p className="text-[11px] text-[var(--muted-light)]">Loading...</p>
  }

  const { tier } = entitlements
  const planKind = entitlements.planKind ?? (tier === 'free' ? 'free' : 'paid')
  const budgetUsedCents = entitlements.budgetUsedCents ?? entitlements.creditsUsed ?? 0
  const budgetTotalCents =
    entitlements.budgetTotalCents ??
    (typeof entitlements.creditsTotal === 'number' ? Math.max(0, entitlements.creditsTotal * 100) : 0)

  if (planKind === 'free') {
    return <p className="text-[11px] text-[var(--muted-light)]">Auto model messages are unlimited. Premium models and budgeted tools are unavailable on this plan.</p>
  }

  if (budgetTotalCents <= 0) return <p className="text-[11px] text-[#aaa]">No budget limit set</p>
  const usedPctRaw = Math.min(100, (budgetUsedCents / budgetTotalCents) * 100)
  const remainingPctRaw = Math.max(0, 100 - usedPctRaw)
  const exhausted = remainingPctRaw <= 0
  const warning = usedPctRaw >= 80
  const tone = exhausted ? 'exhausted' : warning ? 'warning' : 'default'

  return (
    <UsageMeterBar
      percent={remainingPctRaw}
      tone={tone}
      primaryLabel={
        <>
          {remainingPctRaw.toFixed(1)}% remaining
          <span className="text-[10px] opacity-70">
            {' '}· ${(budgetUsedCents / 100).toFixed(2)} / ${(budgetTotalCents / 100).toFixed(2)}
          </span>
        </>
      }
      trailingIcon={exhausted ? <AlertCircle size={11} /> : undefined}
    />
  )
}

export function StorageBar({ entitlements }: { entitlements: SidebarEntitlements | null }) {
  if (!entitlements) {
    return <p className="text-[11px] text-[var(--muted-light)]">Loading...</p>
  }

  const usedBytes = Math.max(0, entitlements.overlayStorageBytesUsed)
  const limitBytes = Math.max(0, entitlements.overlayStorageBytesLimit)
  const remainingBytes = Math.max(0, limitBytes - usedBytes)
  const usedPct = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0
  const warning = usedPct >= 80
  const exhausted = limitBytes > 0 && remainingBytes <= 0
  const tone = exhausted ? 'exhausted' : warning ? 'warning' : 'default'

  return (
    <UsageMeterBar
      percent={usedPct}
      tone={tone}
      primaryLabel={`${formatBytes(remainingBytes)} available`}
      secondaryLabel={`${formatBytes(usedBytes)} / ${formatBytes(limitBytes)}`}
    />
  )
}
