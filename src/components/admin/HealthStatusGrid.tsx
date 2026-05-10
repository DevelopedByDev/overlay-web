'use client'

import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'

export interface HealthCheckItem {
  name: string
  status: 'ok' | 'degraded' | 'error'
  latencyMs?: number
  message?: string
}

export default function HealthStatusGrid({
  checks,
  isLoading,
}: {
  checks: HealthCheckItem[]
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-[var(--surface-subtle)]"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {checks.map((c) => {
        const isOk = c.status === 'ok'
        const isError = c.status === 'error'
        return (
          <div
            key={c.name}
            className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm"
          >
            <div
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isOk
                  ? 'bg-emerald-50 text-emerald-600'
                  : isError
                    ? 'bg-red-50 text-red-500'
                    : 'bg-amber-50 text-amber-600'
              }`}
            >
              {isOk ? (
                <CheckCircle size={20} strokeWidth={1.8} />
              ) : isError ? (
                <XCircle size={20} strokeWidth={1.8} />
              ) : (
                <AlertCircle size={20} strokeWidth={1.8} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {c.name}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {c.message || (isOk ? 'Operational' : 'Issue detected')}
                {c.latencyMs ? ` · ${c.latencyMs}ms` : ''}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
