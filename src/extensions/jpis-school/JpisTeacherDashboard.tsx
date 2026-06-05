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
  HeaderIdentity,
  MetricCard,
  Panel,
  ProgressBar,
  Row,
  StatusPill,
} from './JpisDashboardPrimitives'
import {
  JPIS_TEACHER_OVERVIEW,
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

export function JpisTeacherDashboard({
  featureModule,
}: OverlayExtensionComponentProps) {
  const [overview, setOverview] = useState<TeacherOverview>(JPIS_TEACHER_OVERVIEW)
  const [selectedFeedbackId, setSelectedFeedbackId] = useState(JPIS_TEACHER_OVERVIEW.feedbackQueue[0]?.id ?? '')
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({
    personal: 1,
    exploration: 4,
    analysis: 3,
    evaluation: 3,
    communication: 3,
  })

  useEffect(() => {
    let active = true
    void fetch('/api/v1/extensions/jpis-school/teacher/overview', { cache: 'no-store' })
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
  const selectedFeedback = useMemo(
    () => overview.feedbackQueue.find((item) => item.id === selectedFeedbackId) ?? overview.feedbackQueue[0],
    [overview.feedbackQueue, selectedFeedbackId],
  )
  const rubricTotal = useMemo(
    () => overview.rubricCriteria.reduce((total, item) => total + (rubricScores[item.id] ?? 0), 0),
    [overview.rubricCriteria, rubricScores],
  )
  const rubricMax = useMemo(
    () => overview.rubricCriteria.reduce((total, item) => total + item.max, 0),
    [overview.rubricCriteria],
  )

  return (
    <AppScreenShell
      header={
        <AppScreenHeader
          title={featureModule?.label ?? 'Teacher'}
          actions={<HeaderIdentity name={overview.teacherName} />}
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

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.9fr)]">
            <div className="space-y-4">
              <Panel
                title="Curriculum readiness"
                description="Live teaching priorities across the IB Physics program."
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
                title="IA feedback builder"
                description="Select a Physics IA draft, score the IB criteria, and produce a focused next step."
                icon={Target}
              >
                <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div className="space-y-2">
                    {overview.feedbackQueue.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedFeedbackId(item.id)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
                          selectedFeedback?.id === item.id
                            ? 'border-[var(--foreground)] bg-[var(--surface-subtle)]'
                            : 'border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-subtle)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.student}</p>
                          <StatusPill tone="neutral">{item.criterion}</StatusPill>
                        </div>
                        <p className="mt-1 truncate text-xs text-[var(--muted)]">{item.investigation}</p>
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">{item.signal}</p>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)]">{selectedFeedback?.investigation}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{selectedFeedback?.student}</p>
                      </div>
                      <StatusPill tone={rubricTotal >= 17 ? 'success' : rubricTotal >= 12 ? 'warning' : 'danger'}>
                        {rubricTotal}/{rubricMax}
                      </StatusPill>
                    </div>

                    <div className="space-y-3">
                      {overview.rubricCriteria.map((criterion) => (
                        <div key={criterion.id}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-[var(--foreground)]">{criterion.label}</p>
                              <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--muted)]">{criterion.descriptor}</p>
                            </div>
                            <span className="shrink-0 text-xs text-[var(--muted)]">{rubricScores[criterion.id] ?? 0}/{criterion.max}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Array.from({ length: criterion.max + 1 }, (_, score) => (
                              <button
                                key={score}
                                type="button"
                                onClick={() => setRubricScores((current) => ({ ...current, [criterion.id]: score }))}
                                className={`h-7 w-7 rounded-md border text-xs transition-colors ${
                                  (rubricScores[criterion.id] ?? 0) === score
                                    ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]'
                                    : 'border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]'
                                }`}
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
                      <p className="text-xs font-medium text-[var(--foreground)]">Next-step feedback</p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                        {selectedFeedback?.student} should revise {selectedFeedback?.criterion.toLowerCase()} first: {selectedFeedback?.signal}
                      </p>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>

            <aside className="space-y-4">
              <Panel
                title="Today at JPIS"
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
                title="IB assessment criteria"
                description="Reference criteria for the selected IA feedback draft."
                icon={Sparkles}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.rubricCriteria.map((criterion) => (
                    <Row
                      key={criterion.id}
                      title={criterion.label}
                      detail={criterion.descriptor}
                      meta={<StatusPill tone="neutral">/{criterion.max}</StatusPill>}
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
                  This dashboard is wired as a JPIS extension page. It can be backed by ManageBac, Google Classroom, exam exports, or school SIS data without adding custom Next.js routes.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <GraduationCap size={16} strokeWidth={1.8} className="text-[var(--muted-light)]" />
                <span className="text-xs text-[var(--muted)]">{overview.school}</span>
              </div>
            </div>
          </div>
        </div>
      </AppScreenBody>
    </AppScreenShell>
  )
}
