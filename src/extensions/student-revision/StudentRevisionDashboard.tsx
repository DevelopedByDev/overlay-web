'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AppScreenBody,
  AppScreenHeader,
  AppScreenShell,
} from '@overlay/modules-react/shell'
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  LineChart,
  Target,
} from 'lucide-react'
import type { OverlayExtensionComponentProps } from '../registry'

type RevisionOverview = {
  activePlans: number
  practiceSets: number
  weakTopics: string[]
  upcomingAssessments: Array<{ id: string; title: string; dateLabel: string }>
}

const FALLBACK_OVERVIEW: RevisionOverview = {
  activePlans: 12,
  practiceSets: 48,
  weakTopics: ['Quadratic equations', 'Organic chemistry mechanisms', 'Macroeconomic diagrams'],
  upcomingAssessments: [
    { id: 'math-cbse-10', title: 'Grade 10 Mathematics', dateLabel: 'Friday' },
    { id: 'ibdp-econ', title: 'IBDP Economics Paper 1', dateLabel: 'Next week' },
  ],
}

const quickActions = [
  'Create 14-day revision plan',
  'Generate weak-topic practice',
  'Review uploaded notes',
  'Draft parent-safe summary',
] as const

export function StudentRevisionDashboard({
  featureModule,
}: OverlayExtensionComponentProps) {
  const [overview, setOverview] = useState<RevisionOverview>(FALLBACK_OVERVIEW)

  useEffect(() => {
    let active = true
    void fetch('/api/v1/extensions/student-revision/overview', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: RevisionOverview | null) => {
        if (active && data) setOverview(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const metrics = useMemo(() => [
    { label: 'Active plans', value: String(overview.activePlans), icon: CalendarDays },
    { label: 'Practice sets', value: String(overview.practiceSets), icon: BookOpen },
    { label: 'Weak topics', value: String(overview.weakTopics.length), icon: Target },
  ], [overview])

  return (
    <AppScreenShell
      header={
        <AppScreenHeader
          title={featureModule?.label ?? 'Student Revision'}
          subtitle="Extension"
          description="Revision planning, weak-topic practice, and assessment preparation for school-approved learning tracks."
          leading={<GraduationCap size={18} strokeWidth={1.8} className="text-[var(--muted)]" />}
        />
      }
    >
      <AppScreenBody padding="md" maxWidth="xl" className="bg-[var(--surface-muted)]">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {metrics.map((metric) => {
                const Icon = metric.icon
                return (
                  <article
                    key={metric.label}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-[var(--muted)]">{metric.label}</p>
                      <Icon size={15} strokeWidth={1.8} className="text-[var(--muted-light)]" />
                    </div>
                    <p className="mt-3 text-2xl font-medium tracking-normal text-[var(--foreground)]">{metric.value}</p>
                  </article>
                )
              })}
            </div>

            <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]">
              <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--border)] px-4">
                <div>
                  <h2 className="text-sm font-medium text-[var(--foreground)]">Weak-topic queue</h2>
                  <p className="text-xs text-[var(--muted)]">Prioritized from uploaded notes, practice history, and assessment goals.</p>
                </div>
                <LineChart size={16} strokeWidth={1.8} className="text-[var(--muted-light)]" />
              </div>
              <div className="divide-y divide-[var(--border)]">
                {overview.weakTopics.map((topic, index) => (
                  <div key={topic} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--foreground)]">{topic}</p>
                      <p className="text-xs text-[var(--muted)]">Targeted practice set {index + 1}</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
              <h2 className="text-sm font-medium text-[var(--foreground)]">Quick actions</h2>
              <div className="mt-3 space-y-2">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-left text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
                  >
                    <span>{action}</span>
                    <span className="text-[var(--muted-light)]">Open</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
              <h2 className="text-sm font-medium text-[var(--foreground)]">Upcoming assessments</h2>
              <div className="mt-3 space-y-3">
                {overview.upcomingAssessments.map((assessment) => (
                  <div key={assessment.id} className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                    <p className="text-sm text-[var(--foreground)]">{assessment.title}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{assessment.dateLabel}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </AppScreenBody>
    </AppScreenShell>
  )
}
