'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  LineChart,
  Sparkles,
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
  JPIS_STUDENT_OVERVIEW,
  type StudentOverview,
} from './data'

const metricIcons: Record<string, LucideIcon> = {
  tasks: ClipboardCheck,
  practice: BookOpenCheck,
  readiness: LineChart,
}

function readinessTone(value: number) {
  if (value >= 78) return 'success'
  if (value >= 62) return 'warning'
  return 'danger'
}

export function JpisStudentDashboard({
  featureModule,
}: OverlayExtensionComponentProps) {
  const [overview, setOverview] = useState<StudentOverview>(JPIS_STUDENT_OVERVIEW)

  useEffect(() => {
    let active = true
    void fetch('/api/v1/extensions/jpis-school/student/overview', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: StudentOverview | null) => {
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
          title={featureModule?.label ?? 'Student'}
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
                title={`${overview.studentName} learning tracks`}
                description="IB and Cambridge IGCSE readiness with teacher-approved next steps."
                icon={LineChart}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.learningTracks.map((item) => (
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
                title="Focus queue"
                description="Student-owned tasks that can be completed before the next check-in."
                icon={Target}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.focusQueue.map((item) => (
                    <Row
                      key={item.id}
                      title={item.title}
                      detail={item.detail}
                      action={<ActionButton>{item.action}</ActionButton>}
                    />
                  ))}
                </div>
              </Panel>
            </div>

            <aside className="space-y-4">
              <Panel
                title="Upcoming"
                description="Near-term academic checkpoints."
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
                title="Approved AI support"
                description="Student workflows constrained to JPIS-approved materials."
                icon={Sparkles}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.aiWorkflows.map((workflow) => (
                    <Row
                      key={workflow.id}
                      title={workflow.label}
                      detail={workflow.detail}
                      action={<ActionButton>Open</ActionButton>}
                    />
                  ))}
                </div>
              </Panel>
            </aside>
          </div>
        </div>
      </AppScreenBody>
    </AppScreenShell>
  )
}
