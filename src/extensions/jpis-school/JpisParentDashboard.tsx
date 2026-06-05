'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CalendarDays,
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

  return (
    <AppScreenShell
      header={
        <AppScreenHeader
          title={featureModule?.label ?? 'Parent'}
        />
      }
    >
      <AppScreenBody padding="md" maxWidth="xl" className="bg-[var(--surface-muted)]">
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
                description="Curriculum-specific view of readiness, feedback, and next steps."
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
                title="What needs attention"
                description="A short parent-safe queue with clear ownership."
                icon={Target}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.attention.map((item) => (
                    <Row
                      key={item.id}
                      title={item.title}
                      detail={item.detail}
                      meta={<StatusPill tone={item.owner === 'Parent' ? 'warning' : 'neutral'}>{item.owner}</StatusPill>}
                      action={<ActionButton>Review</ActionButton>}
                    />
                  ))}
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
