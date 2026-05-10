// @enterprise-future — not wired to production
// Admin Settings page: read-only view of provider config

'use client'

import { useEffect, useState } from 'react'
import SettingsPanel from '@/components/admin/SettingsPanel'
import type { ConfigItem } from '@/components/admin/SettingsPanel'
import { Lock } from 'lucide-react'

export default function AdminSettingsPage() {
  const [items, setItems] = useState<ConfigItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(async (res) => {
        if (!res.ok) return { config: [] }
        return (await res.json()) as { config: ConfigItem[] }
      })
      .then((data) => setItems(data.config))
      .catch(() => setItems([]))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Settings
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Instance configuration and provider status
        </p>
      </div>

      <SettingsPanel items={items} isLoading={isLoading} />

      <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)]">
          <Lock size={18} strokeWidth={1.8} />
        </div>
        <div>
          <h3 className="text-sm font-medium text-[var(--foreground)]">
            Write protection
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            Settings mutation is stubbed for Phase 3. In Phase 4, admins will
            be able to update provider keys, rate limits, and instance name
            directly from this dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}
