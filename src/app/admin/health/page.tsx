// @enterprise-future — not wired to production
// Admin Health page: visual status of all dependencies

'use client'

import { useEffect, useState } from 'react'
import HealthStatusGrid from '@/components/admin/HealthStatusGrid'
import type { HealthCheckItem } from '@/components/admin/HealthStatusGrid'

export default function AdminHealthPage() {
  const [checks, setChecks] = useState<HealthCheckItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const loadHealth = () => {
    fetch('/api/health/dependencies')
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as {
          status: string
          timestamp: number
          checks: Record<string, { status: string; latencyMs?: number; message?: string }>
        }
      })
      .then((data) => {
        if (!data) {
          setChecks([])
          return
        }
        const mapped: HealthCheckItem[] = Object.entries(data.checks).map(
          ([name, check]) => ({
            name,
            status: check.status as 'ok' | 'degraded' | 'error',
            latencyMs: check.latencyMs,
            message: check.message,
          }),
        )
        setChecks(mapped)
        setLastUpdated(new Date(data.timestamp).toLocaleString())
      })
      .catch(() => setChecks([]))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadHealth()
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Health
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {lastUpdated ? `Last checked: ${lastUpdated}` : 'Dependency status'}
          </p>
        </div>
        <button
          type="button"
          onClick={loadHealth}
          className="inline-flex rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
        >
          Refresh
        </button>
      </div>

      <HealthStatusGrid checks={checks} isLoading={isLoading} />
    </div>
  )
}
