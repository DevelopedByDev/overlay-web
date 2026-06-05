'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BookOpenCheck,
  FileText,
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
} from './JohnsHopkinsDashboardPrimitives'
import {
  JOHNS_HOPKINS_PROFESSOR_OVERVIEW,
  type ProfessorOverview,
} from './data'

const metricIcons: Record<string, LucideIcon> = {
  students: Users,
  grant: FileText,
  course: AlertTriangle,
}

function readinessTone(value: number) {
  if (value >= 80) return 'success'
  if (value >= 65) return 'warning'
  return 'danger'
}

function severityTone(severity: 'Low' | 'Medium' | 'High') {
  if (severity === 'Low') return 'success'
  if (severity === 'Medium') return 'warning'
  return 'danger'
}

export function JohnsHopkinsProfessorDashboard({
  featureModule,
}: OverlayExtensionComponentProps) {
  const [overview, setOverview] = useState<ProfessorOverview>(JOHNS_HOPKINS_PROFESSOR_OVERVIEW)
  const [selectedAdviseeId, setSelectedAdviseeId] = useState(JOHNS_HOPKINS_PROFESSOR_OVERVIEW.advisingQueue[0]?.id ?? '')
  const [grantScores, setGrantScores] = useState<Record<string, number>>({
    aims: 4,
    innovation: 2,
    approach: 3,
    impact: 4,
  })

  useEffect(() => {
    let active = true
    void fetch('/api/v1/extensions/johns-hopkins/professor/overview', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: ProfessorOverview | null) => {
        if (active && data) {
          setOverview(data)
          setSelectedAdviseeId(data.advisingQueue[0]?.id ?? '')
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const metrics = useMemo(() => overview.metrics, [overview])
  const selectedAdvisee = useMemo(
    () => overview.advisingQueue.find((item) => item.id === selectedAdviseeId) ?? overview.advisingQueue[0],
    [overview.advisingQueue, selectedAdviseeId],
  )
  const grantScore = useMemo(
    () => overview.grantSections.reduce((total, item) => total + (grantScores[item.id] ?? 0), 0),
    [grantScores, overview.grantSections],
  )
  const grantMax = useMemo(
    () => overview.grantSections.reduce((total, item) => total + item.max, 0),
    [overview.grantSections],
  )
  const grantReadiness = grantMax > 0 ? Math.round((grantScore / grantMax) * 100) : 0

  return (
    <AppScreenShell
      header={
        <AppScreenHeader
          title={featureModule?.label ?? 'Professor'}
          actions={<HeaderIdentity name={overview.professorName} />}
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
                title="Research and teaching pipeline"
                description="Grant readiness, undergraduate research onboarding, and BME design course outcomes."
                icon={BookOpenCheck}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.researchPipeline.map((item) => (
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
                title="Advising triage"
                description="Select an advisee and generate a focused action recommendation from course and research signals."
                icon={Target}
              >
                <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                  <div className="space-y-2">
                    {overview.advisingQueue.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedAdviseeId(item.id)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
                          selectedAdvisee?.id === item.id
                            ? 'border-[var(--foreground)] bg-[var(--surface-subtle)]'
                            : 'border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-subtle)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.student}</p>
                          <StatusPill tone="neutral">{item.program}</StatusPill>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">{item.signal}</p>
                      </button>
                    ))}
                  </div>

                  {selectedAdvisee ? (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                      <p className="text-sm font-medium text-[var(--foreground)]">{selectedAdvisee.student}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{selectedAdvisee.program}</p>
                      <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
                        <p className="text-xs font-medium text-[var(--foreground)]">Signal</p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{selectedAdvisee.signal}</p>
                      </div>
                      <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
                        <p className="text-xs font-medium text-[var(--foreground)]">Recommended professor action</p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{selectedAdvisee.recommendation}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Panel>

              <Panel
                title="Grant readiness scorer"
                description="Interactive NIH-style grant section review before department chair routing."
                icon={FileText}
              >
                <div className="space-y-4 p-4">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[var(--foreground)]">Proposal readiness</p>
                      <StatusPill tone={readinessTone(grantReadiness)}>{grantScore}/{grantMax}</StatusPill>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={grantReadiness} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {overview.grantSections.map((section) => (
                      <div key={section.id}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-[var(--foreground)]">{section.label}</p>
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--muted)]">{section.descriptor}</p>
                          </div>
                          <span className="shrink-0 text-xs text-[var(--muted)]">{grantScores[section.id] ?? 0}/{section.max}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Array.from({ length: section.max + 1 }, (_, score) => (
                            <button
                              key={score}
                              type="button"
                              onClick={() => setGrantScores((current) => ({ ...current, [section.id]: score }))}
                              className={`h-7 w-7 rounded-md border text-xs transition-colors ${
                                (grantScores[section.id] ?? 0) === score
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
                </div>
              </Panel>
            </div>

            <aside className="space-y-4">
              <Panel
                title="Course signals"
                description="Teaching alerts that are ready for office hours or TA intervention."
                icon={Sparkles}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.courseSignals.map((item) => (
                    <Row
                      key={item.id}
                      title={item.title}
                      detail={item.detail}
                      meta={<StatusPill tone={severityTone(item.severity)}>{item.severity}</StatusPill>}
                    />
                  ))}
                </div>
              </Panel>

              <Panel
                title="Professor briefing"
                description="What Overlay would prepare before the next meeting block."
                icon={GraduationCap}
              >
                <div className="p-4">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {grantReadiness >= 80 ? 'Route grant for chair review' : 'Tighten proposal before routing'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                      {grantReadiness >= 80
                        ? 'The proposal sections are strong enough for department review. Attach the reviewer response matrix.'
                        : 'Focus on innovation and approach. Then review advisees with course or research-blocking signals.'}
                    </p>
                  </div>
                </div>
              </Panel>
            </aside>
          </div>
        </div>
      </AppScreenBody>
    </AppScreenShell>
  )
}
