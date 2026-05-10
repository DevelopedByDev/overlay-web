'use client'

import type { AuditEvent } from '@/lib/audit'

export default function AuditLogTable({
  events,
  isLoading,
}: {
  events: AuditEvent[]
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-[var(--surface-subtle)]"
            />
          ))}
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8 text-center text-sm text-[var(--muted)]">
        No audit events recorded yet.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
            <th className="px-5 py-3 font-medium">Time</th>
            <th className="px-5 py-3 font-medium">Actor</th>
            <th className="px-5 py-3 font-medium">Action</th>
            <th className="px-5 py-3 font-medium">Resource</th>
            <th className="px-5 py-3 font-medium">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {events.map((e) => (
            <tr
              key={e.id}
              className="transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <td className="whitespace-nowrap px-5 py-3 text-[var(--muted)]">
                {new Date(e.timestamp).toLocaleString()}
              </td>
              <td className="px-5 py-3 font-mono text-xs text-[var(--foreground)]">
                {e.actorId.slice(0, 12)}…
              </td>
              <td className="px-5 py-3 text-[var(--foreground)]">{e.action}</td>
              <td className="px-5 py-3 text-[var(--foreground)]">
                {e.resource}
                {e.resourceId ? ` / ${e.resourceId}` : ''}
              </td>
              <td className="px-5 py-3 text-[var(--muted)]">
                {e.metadata ? JSON.stringify(e.metadata) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
