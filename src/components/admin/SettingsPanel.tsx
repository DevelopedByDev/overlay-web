'use client'

export interface ConfigItem {
  label: string
  value: string
  status: 'configured' | 'optional' | 'missing'
}

export default function SettingsPanel({
  items,
  isLoading,
}: {
  items: ConfigItem[]
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-[var(--surface-subtle)]"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
            <th className="px-5 py-3 font-medium">Setting</th>
            <th className="px-5 py-3 font-medium">Value</th>
            <th className="px-5 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {items.map((item) => (
            <tr
              key={item.label}
              className="transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <td className="px-5 py-3 text-[var(--foreground)]">
                {item.label}
              </td>
              <td className="px-5 py-3 font-mono text-xs text-[var(--muted)]">
                {item.value}
              </td>
              <td className="px-5 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.status === 'configured'
                      ? 'bg-emerald-50 text-emerald-600'
                      : item.status === 'optional'
                        ? 'bg-[var(--surface-subtle)] text-[var(--muted)]'
                        : 'bg-red-50 text-red-500'
                  }`}
                >
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
