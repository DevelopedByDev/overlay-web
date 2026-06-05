'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CalendarDays,
  Check,
  ClipboardCheck,
  LineChart,
  Mail,
  MessageSquare,
  Target,
} from 'lucide-react'
import {
  AppScreenBody,
  AppScreenHeader,
  AppScreenShell,
} from '@overlay/modules-react/shell'
import type { OverlayExtensionComponentProps } from '../registry'
import {
  ActionButton,
  HeaderIdentity,
  MetricCard,
  Panel,
  ProgressBar,
  Row,
  StatusPill,
} from './JpisDashboardPrimitives'
import {
  JPIS_PARENT_OVERVIEW,
  type ParentOverview,
} from './data'

const metricIcons: Record<string, LucideIcon> = {
  attendance: ClipboardCheck,
  tasks: Bell,
  checkpoints: CalendarDays,
}

function readinessTone(value: number) {
  if (value >= 78) return 'success'
  if (value >= 62) return 'warning'
  return 'danger'
}

export function JpisParentDashboard({
  featureModule,
}: OverlayExtensionComponentProps) {
  const [overview, setOverview] = useState<ParentOverview>(JPIS_PARENT_OVERVIEW)
  const [completedSupport, setCompletedSupport] = useState<Record<string, boolean>>({
    'support-quiz': true,
  })

  useEffect(() => {
    let active = true
    void fetch('/api/v1/extensions/jpis-school/parent/overview', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: ParentOverview | null) => {
        if (active && data) setOverview(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const metrics = useMemo(() => overview.metrics, [overview])
  const completedCount = useMemo(
    () => overview.supportChecklist.filter((item) => completedSupport[item.id]).length,
    [completedSupport, overview.supportChecklist],
  )
  const supportPercent = overview.supportChecklist.length > 0
    ? Math.round((completedCount / overview.supportChecklist.length) * 100)
    : 0

  return (
    <AppScreenShell
      header={
        <AppScreenHeader
          title={featureModule?.label ?? 'Parent'}
          actions={<HeaderIdentity name={overview.parentName} />}
        />
      }
    >
      <AppScreenBody padding="md" maxWidth="xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.id}
                label={metric.label}
                value={metric.value}
                detail={metric.detail}
                icon={metricIcons[metric.id] ?? LineChart}
              />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
            <div className="space-y-4">
              <Panel
                title={`${overview.studentName} progress`}
                description="IB readiness, feedback, and next steps approved for parent view."
                icon={LineChart}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.progress.map((item) => (
                    <div key={item.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <StatusPill tone="neutral">{item.curriculum}</StatusPill>
                            <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.subject}</p>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{item.detail}</p>
                        </div>
                        <StatusPill tone={readinessTone(item.readiness)}>{item.status}</StatusPill>
                      </div>
                      <div className="mt-3">
                        <ProgressBar value={item.readiness} />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="Family support checklist"
                description="Parent actions that reinforce IB Physics and IB Core work at home."
                icon={Target}
              >
                <div className="space-y-4 p-4">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[var(--foreground)]">Home support progress</p>
                      <StatusPill tone={supportPercent >= 67 ? 'success' : supportPercent > 0 ? 'warning' : 'neutral'}>
                        {completedCount}/{overview.supportChecklist.length}
                      </StatusPill>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={supportPercent} />
                    </div>
                  </div>

                  <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                    {overview.supportChecklist.map((item) => {
                      const complete = Boolean(completedSupport[item.id])
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCompletedSupport((current) => ({ ...current, [item.id]: !complete }))}
                          className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-subtle)]"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-[var(--foreground)]">{item.title}</span>
                            <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">{item.detail}</span>
                          </span>
                          <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] ${
                            complete
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'border-[var(--border)] text-transparent'
                          }`}>
                            {complete ? <Check size={12} strokeWidth={2} /> : null}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                    <p className="text-xs font-medium text-[var(--foreground)]">Suggested dinner-table prompt</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                      Ask {overview.studentName} to explain why terminal potential difference drops when current increases, then connect that explanation to the IA variable table.
                    </p>
                  </div>
                </div>
              </Panel>
            </div>

            <aside className="space-y-4">
              <Panel
                title="Upcoming"
                description="School calendar moments that affect the next two weeks."
                icon={CalendarDays}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.upcoming.map((item) => (
                    <Row
                      key={item.id}
                      title={item.title}
                      detail={item.detail}
                      meta={<StatusPill>{item.dateLabel}</StatusPill>}
                    />
                  ))}
                </div>
              </Panel>

              <Panel
                title="School-home updates"
                description="Approved summaries and operational messages."
                icon={MessageSquare}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.messages.map((message) => (
                    <Row
                      key={message.id}
                      title={message.title}
                      detail={message.detail}
                      meta={<StatusPill tone="neutral">{message.from}</StatusPill>}
                      action={<ActionButton>Open</ActionButton>}
                    />
                  ))}
                </div>
              </Panel>
            </aside>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)]">Parent portal boundary</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                  This view is deliberately parent-safe: it can show approved summaries and next steps without exposing internal faculty notes or raw student records.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Mail size={16} strokeWidth={1.8} className="text-[var(--muted-light)]" />
                <span className="text-xs text-[var(--muted)]">{overview.school}</span>
              </div>
            </div>
          </div>
        </div>
      </AppScreenBody>
    </AppScreenShell>
  )
}
