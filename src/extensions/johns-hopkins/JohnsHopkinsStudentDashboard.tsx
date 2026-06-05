'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardCheck,
  LineChart,
  Target,
} from 'lucide-react'
import {
  AppScreenBody,
  AppScreenHeader,
  AppScreenShell,
} from '@overlay/modules-react/shell'
import type { OverlayExtensionComponentProps } from '../registry'
import {
  HeaderIdentity,
  MetricCard,
  Panel,
  ProgressBar,
  Row,
  StatusPill,
} from './JohnsHopkinsDashboardPrimitives'
import {
  JOHNS_HOPKINS_STUDENT_OVERVIEW,
  type StudentOverview,
} from './data'

const metricIcons: Record<string, LucideIcon> = {
  credits: ClipboardCheck,
  research: BriefcaseBusiness,
  risk: LineChart,
}

function readinessTone(value: number) {
  if (value >= 80) return 'success'
  if (value >= 65) return 'warning'
  return 'danger'
}

export function JohnsHopkinsStudentDashboard({
  featureModule,
}: OverlayExtensionComponentProps) {
  const [overview, setOverview] = useState<StudentOverview>(JOHNS_HOPKINS_STUDENT_OVERVIEW)
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(JOHNS_HOPKINS_STUDENT_OVERVIEW.opportunityMatches[0]?.id ?? '')
  const [completedPlan, setCompletedPlan] = useState<Record<string, boolean>>(
    () => Object.fromEntries(JOHNS_HOPKINS_STUDENT_OVERVIEW.weeklyPlan.map((item) => [item.id, item.complete])),
  )

  useEffect(() => {
    let active = true
    void fetch('/api/v1/extensions/johns-hopkins/student/overview', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: StudentOverview | null) => {
        if (active && data) {
          setOverview(data)
          setCompletedPlan(Object.fromEntries(data.weeklyPlan.map((item) => [item.id, item.complete])))
          setSelectedOpportunityId(data.opportunityMatches[0]?.id ?? '')
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const metrics = useMemo(() => overview.metrics, [overview])
  const selectedOpportunity = useMemo(
    () => overview.opportunityMatches.find((item) => item.id === selectedOpportunityId) ?? overview.opportunityMatches[0],
    [overview.opportunityMatches, selectedOpportunityId],
  )
  const completedCount = useMemo(
    () => overview.weeklyPlan.filter((item) => completedPlan[item.id]).length,
    [completedPlan, overview.weeklyPlan],
  )
  const planProgress = overview.weeklyPlan.length > 0
    ? Math.round((completedCount / overview.weeklyPlan.length) * 100)
    : 0

  return (
    <AppScreenShell
      header={
        <AppScreenHeader
          title={featureModule?.label ?? 'Student'}
          actions={<HeaderIdentity name={overview.studentName} />}
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
                title={`${overview.studentName} academic plan`}
                description="Course load, pre-professional advising, and research readiness in one place."
                icon={LineChart}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.academicTracks.map((item) => (
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
                title="Research opportunity matcher"
                description="Prioritized Hopkins research fits from skills, coursework, interests, and schedule pressure."
                icon={BriefcaseBusiness}
              >
                <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="space-y-2">
                    {overview.opportunityMatches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedOpportunityId(item.id)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
                          selectedOpportunity?.id === item.id
                            ? 'border-[var(--foreground)] bg-[var(--surface-subtle)]'
                            : 'border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-subtle)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.title}</p>
                          <StatusPill tone={readinessTone(item.match)}>{item.match}%</StatusPill>
                        </div>
                        <p className="mt-1 truncate text-xs text-[var(--muted)]">{item.lab}</p>
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">{item.detail}</p>
                      </button>
                    ))}
                  </div>

                  {selectedOpportunity ? (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                      <p className="text-sm font-medium text-[var(--foreground)]">{selectedOpportunity.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{selectedOpportunity.lab}</p>
                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-[var(--muted)]">Fit score</span>
                          <StatusPill tone={readinessTone(selectedOpportunity.match)}>{selectedOpportunity.match}%</StatusPill>
                        </div>
                        <div className="mt-2">
                          <ProgressBar value={selectedOpportunity.match} />
                        </div>
                      </div>
                      <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">{selectedOpportunity.detail}</p>
                      <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
                        <p className="text-xs font-medium text-[var(--foreground)]">Recommended next step</p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{selectedOpportunity.nextStep}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Panel>
            </div>

            <aside className="space-y-4">
              <Panel
                title="Weekly workload plan"
                description="Interactive plan that balances coursework, research, and advising."
                icon={Target}
              >
                <div className="space-y-4 p-4">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[var(--foreground)]">Plan progress</p>
                      <StatusPill tone={planProgress >= 67 ? 'success' : planProgress > 0 ? 'warning' : 'neutral'}>
                        {completedCount}/{overview.weeklyPlan.length}
                      </StatusPill>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={planProgress} />
                    </div>
                  </div>

                  <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                    {overview.weeklyPlan.map((item) => {
                      const complete = Boolean(completedPlan[item.id])
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCompletedPlan((current) => ({ ...current, [item.id]: !complete }))}
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
                </div>
              </Panel>

              <Panel
                title="Critical deadlines"
                description="Academic and research moments that need attention this week."
                icon={CalendarDays}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.deadlines.map((item) => (
                    <Row
                      key={item.id}
                      title={item.title}
                      detail={item.detail}
                      meta={<StatusPill>{item.dateLabel}</StatusPill>}
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
