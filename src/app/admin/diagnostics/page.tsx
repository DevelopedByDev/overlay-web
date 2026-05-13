'use client'

import { useEffect, useState } from 'react'

type Diagnostics = {
  timestamp: number
  providers: Record<string, string>
  providerHealth: Record<string, { status: string; providerId: string; message?: string; latencyMs?: number }>
  license: { status: string; message?: string; subject?: string; plan?: string; expiresAt?: string }
  airGap: { enabled: boolean; valid: boolean; errors: string[] }
  smtp: { configured: boolean; message: string }
  backup: { configured: boolean; lastStatusPath: string }
}

export default function AdminDiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/diagnostics')
      .then(async (res) => res.ok ? await res.json() as Diagnostics : null)
      .then(setDiagnostics)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-sm text-[var(--muted)]">Loading diagnostics...</div>
  }

  if (!diagnostics) {
    return <div className="text-sm text-red-500">Unable to load diagnostics.</div>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Diagnostics</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Provider status, license state, air-gap validation, and operational readiness.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard label="License" value={diagnostics.license.status} ok={diagnostics.license.status === 'valid' || diagnostics.license.status === 'missing'} />
        <StatusCard label="Air-gap" value={diagnostics.airGap.enabled ? (diagnostics.airGap.valid ? 'valid' : 'invalid') : 'off'} ok={!diagnostics.airGap.enabled || diagnostics.airGap.valid} />
        <StatusCard label="SMTP" value={diagnostics.smtp.configured ? 'configured' : 'missing'} ok={diagnostics.smtp.configured} />
        <StatusCard label="Backup" value={diagnostics.backup.configured ? 'ready' : 'missing'} ok={diagnostics.backup.configured} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]">
        <div className="border-b border-[var(--border)] px-5 py-3 text-sm font-medium text-[var(--foreground)]">Providers</div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-[var(--border)]">
            {Object.entries(diagnostics.providerHealth).map(([domain, health]) => (
              <tr key={domain}>
                <td className="px-5 py-3 font-medium text-[var(--foreground)]">{domain}</td>
                <td className="px-5 py-3 font-mono text-xs text-[var(--muted)]">{health.providerId}</td>
                <td className="px-5 py-3 text-[var(--muted)]">{health.message || health.status}{health.latencyMs ? ` · ${health.latencyMs}ms` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {diagnostics.airGap.errors.length > 0 ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {diagnostics.airGap.errors.join(' ')}
        </section>
      ) : null}
    </div>
  )
}

function StatusCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
      <div className="text-xs font-medium uppercase text-[var(--muted)]">{label}</div>
      <div className={ok ? 'mt-2 text-lg font-semibold text-emerald-600' : 'mt-2 text-lg font-semibold text-red-500'}>
        {value}
      </div>
    </div>
  )
}
