'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BarChart3,
  Check,
  ClipboardList,
  LineChart,
  School,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
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
  JPIS_ADMIN_OVERVIEW,
  type AdminOverview,
} from './data'

const metricIcons: Record<string, LucideIcon> = {
  learners: Users,
  adoption: Workflow,
  risks: AlertTriangle,
  programs: School,
}

function readinessTone(value: number) {
  if (value >= 80) return 'success'
  if (value >= 68) return 'warning'
  return 'danger'
}

function policyTone(status: 'Ready' | 'Needs review' | 'Blocked') {
  if (status === 'Ready') return 'success'
  if (status === 'Needs review') return 'warning'
  return 'danger'
}

export function JpisAdminDashboard({
  featureModule,
}: OverlayExtensionComponentProps) {
  const [overview, setOverview] = useState<AdminOverview>(JPIS_ADMIN_OVERVIEW)
  const [evidenceComplete, setEvidenceComplete] = useState<Record<string, boolean>>(
    () => Object.fromEntries(JPIS_ADMIN_OVERVIEW.authorizationEvidence.map((item) => [item.id, item.complete])),
  )

  useEffect(() => {
    let active = true
    void fetch('/api/v1/extensions/jpis-school/admin/overview', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: AdminOverview | null) => {
        if (active && data) setOverview(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const metrics = useMemo(() => overview.metrics, [overview])
  const evidenceDone = useMemo(
    () => overview.authorizationEvidence.filter((item) => evidenceComplete[item.id]).length,
    [evidenceComplete, overview.authorizationEvidence],
  )
  const authorizationReadiness = overview.authorizationEvidence.length > 0
    ? Math.round((evidenceDone / overview.authorizationEvidence.length) * 100)
    : 0

  return (
    <AppScreenShell
      header={
        <AppScreenHeader
          title={featureModule?.label ?? 'Admin'}
          actions={<HeaderIdentity name={overview.adminName} />}
        />
      }
    >
      <AppScreenBody padding="md" maxWidth="xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.id}
                label={metric.label}
                value={metric.value}
                detail={metric.detail}
                icon={metricIcons[metric.id] ?? BarChart3}
              />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]">
            <div className="space-y-4">
              <Panel
                title="Curriculum operations"
                description="Readiness across JPIS IB PYP, MYP, and DP workstreams."
                icon={School}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.curriculumOps.map((item) => (
                    <div key={item.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.name}</p>
                            <StatusPill tone={readinessTone(item.readiness)}>{item.readiness}%</StatusPill>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{item.focus}</p>
                        </div>
                        <p className="hidden max-w-44 shrink-0 text-right text-xs text-[var(--muted)] lg:block">{item.owner}</p>
                      </div>
                      <div className="mt-3">
                        <ProgressBar value={item.readiness} />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="IB authorization evidence tracker"
                description="Toggle evidence readiness for the next IB review cycle."
                icon={ClipboardList}
              >
                <div className="space-y-4 p-4">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[var(--foreground)]">Authorization readiness</p>
                      <StatusPill tone={authorizationReadiness >= 80 ? 'success' : authorizationReadiness >= 50 ? 'warning' : 'danger'}>
                        {authorizationReadiness}%
                      </StatusPill>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={authorizationReadiness} />
                    </div>
                  </div>

                  <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                    {overview.authorizationEvidence.map((item) => {
                      const complete = Boolean(evidenceComplete[item.id])
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setEvidenceComplete((current) => ({ ...current, [item.id]: !complete }))}
                          className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-subtle)]"
                        >
                          <span className="min-w-0">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-medium text-[var(--foreground)]">{item.label}</span>
                              <StatusPill tone="neutral">{item.owner}</StatusPill>
                            </span>
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
            </div>

            <aside className="space-y-4">
              <Panel
                title="IB AI policy checks"
                description="Governance controls for student, teacher, and parent-facing workflows."
                icon={Sparkles}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.policyChecks.map((item) => (
                    <Row
                      key={item.id}
                      title={item.label}
                      detail={item.detail}
                      meta={<StatusPill tone={policyTone(item.status)}>{item.status}</StatusPill>}
                    />
                  ))}
                </div>
              </Panel>

              <Panel
                title="Next governance action"
                description="Generated from current authorization evidence state."
                icon={LineChart}
              >
                <div className="p-4">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {authorizationReadiness >= 80 ? 'Ready for leadership review' : 'Close evidence gaps'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                      {authorizationReadiness >= 80
                        ? 'Schedule the IB leadership review and export the evidence packet for coordinator sign-off.'
                        : 'Prioritize incomplete Physics IA samples and CAS learner profile evidence before the next review meeting.'}
                    </p>
                  </div>
                </div>
              </Panel>
            </aside>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)]">On-prem enterprise rollout</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                  JPIS can keep these dashboards in its own extension branch while still receiving Overlay product updates from main.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ShieldCheck size={16} strokeWidth={1.8} className="text-[var(--muted-light)]" />
                <span className="text-xs text-[var(--muted)]">{overview.school}</span>
              </div>
            </div>
          </div>
        </div>
      </AppScreenBody>
    </AppScreenShell>
  )
}
