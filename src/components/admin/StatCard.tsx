export default function StatCard({
  label,
  value,
  trend,
  trendUp,
}: {
  label: string
  value: string | number
  trend?: string
  trendUp?: boolean
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <span className="mt-2 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </span>
      {trend ? (
        <span
          className={`mt-1 text-xs ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}
        >
          {trend}
        </span>
      ) : null}
    </div>
  )
}
