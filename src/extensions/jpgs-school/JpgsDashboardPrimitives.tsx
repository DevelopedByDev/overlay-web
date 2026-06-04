import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

const toneClasses: Record<Tone, string> = {
  neutral: 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--muted)]',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  icon: LucideIcon
}) {
  return (
    <article className="min-h-32 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-normal text-[var(--muted)]">{label}</p>
        <Icon size={16} strokeWidth={1.8} className="shrink-0 text-[var(--muted-light)]" />
      </div>
      <p className="mt-4 text-2xl font-medium tracking-normal text-[var(--foreground)]">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{detail}</p>
    </article>
  )
}

export function Panel({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]">
      <div className="flex min-h-14 items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-[var(--foreground)]">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{description}</p> : null}
        </div>
        {Icon ? <Icon size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[var(--muted-light)]" /> : null}
      </div>
      {children}
    </section>
  )
}

export function ProgressBar({ value }: { value: number }) {
  const boundedValue = Math.min(100, Math.max(0, value))

  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
      <div
        className="h-full rounded-full bg-[var(--foreground)]"
        style={{ width: `${boundedValue}%` }}
      />
    </div>
  )
}

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: Tone
}) {
  return (
    <span className={`inline-flex h-6 max-w-full items-center rounded-full border px-2 text-[11px] font-medium ${toneClasses[tone]}`}>
      <span className="truncate">{children}</span>
    </span>
  )
}

export function Row({
  title,
  detail,
  meta,
  action,
}: {
  title: string
  detail: string
  meta?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--foreground)]">{title}</p>
          {meta}
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">{detail}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function ActionButton({
  children,
}: {
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
    >
      {children}
    </button>
  )
}
