'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LineChart,
  School,
  Sparkles,
  Target,
  Users,
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
} from './JpgsDashboardPrimitives'
import {
  JPGS_TEACHER_OVERVIEW,
  type TeacherOverview,
} from './data'

const metricIcons: Record<string, LucideIcon> = {
  classes: Users,
  review: ClipboardCheck,
  interventions: AlertTriangle,
}

function readinessTone(value: number) {
  if (value >= 80) return 'success'
  if (value >= 68) return 'warning'
  return 'danger'
}

export function JpgsTeacherDashboard({
  featureModule,
}: OverlayExtensionComponentProps) {
  const [overview, setOverview] = useState<TeacherOverview>(JPGS_TEACHER_OVERVIEW)

  useEffect(() => {
    let active = true
    void fetch('/api/v1/extensions/jpgs-school/teacher/overview', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: TeacherOverview | null) => {
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
          title={featureModule?.label ?? 'JPGS Teacher'}
          subtitle="JPGS extension"
          description="Faculty workspace for IB, Cambridge IGCSE, and CBSE lesson operations, assessment follow-up, and approved AI workflows."
          leading={<School size={18} strokeWidth={1.8} className="text-[var(--muted)]" />}
          metadata={<StatusPill tone="neutral">IB / IGCSE / CBSE</StatusPill>}
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

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.9fr)]">
            <div className="space-y-4">
              <Panel
                title="Curriculum readiness"
                description="Live teaching priorities across the three JPGS academic tracks."
                icon={BookOpenCheck}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.curriculumReadiness.map((item) => (
                    <div key={item.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.name}</p>
                            <StatusPill tone={readinessTone(item.readiness)}>{item.readiness}%</StatusPill>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{item.focus}</p>
                        </div>
                        <p className="hidden max-w-40 shrink-0 text-right text-xs text-[var(--muted)] sm:block">{item.owner}</p>
                      </div>
                      <div className="mt-3">
                        <ProgressBar value={item.readiness} />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="Students needing follow-up"
                description="Signals that can be acted on before the next class or advisor check-in."
                icon={Target}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.atRisk.map((item) => (
                    <Row
                      key={item.id}
                      title={item.cohort}
                      detail={item.signal}
                      meta={<StatusPill tone="warning">Action</StatusPill>}
                      action={<ActionButton>{item.action}</ActionButton>}
                    />
                  ))}
                </div>
              </Panel>
            </div>

            <aside className="space-y-4">
              <Panel
                title="Today at JPGS"
                description="Teaching blocks and prep actions for the next school day."
                icon={CalendarDays}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.today.map((item) => (
                    <Row
                      key={item.id}
                      title={item.title}
                      detail={item.detail}
                      meta={<StatusPill>{item.time}</StatusPill>}
                    />
                  ))}
                </div>
              </Panel>

              <Panel
                title="Approved AI workflows"
                description="Role-safe workflows for faculty use inside Overlay."
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

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)]">Faculty pilot note</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                  This dashboard is wired as a JPGS extension page. It can be backed by ManageBac, Google Classroom, exam exports, or school SIS data without adding custom Next.js routes.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <GraduationCap size={16} strokeWidth={1.8} className="text-[var(--muted-light)]" />
                <span className="text-xs text-[var(--muted)]">{overview.campus}</span>
              </div>
            </div>
          </div>
        </div>
      </AppScreenBody>
    </AppScreenShell>
  )
}
