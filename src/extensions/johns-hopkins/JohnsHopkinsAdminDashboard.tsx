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
} from './JohnsHopkinsDashboardPrimitives'
import {
  JOHNS_HOPKINS_ADMIN_OVERVIEW,
  type AdminOverview,
} from './data'

const metricIcons: Record<string, LucideIcon> = {
  learners: Users,
  adoption: Workflow,
  risks: AlertTriangle,
  departments: School,
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

export function JohnsHopkinsAdminDashboard({
  featureModule,
}: OverlayExtensionComponentProps) {
  const [overview, setOverview] = useState<AdminOverview>(JOHNS_HOPKINS_ADMIN_OVERVIEW)
  const [complianceComplete, setComplianceComplete] = useState<Record<string, boolean>>(
    () => Object.fromEntries(JOHNS_HOPKINS_ADMIN_OVERVIEW.complianceWork.map((item) => [item.id, item.complete])),
  )

  useEffect(() => {
    let active = true
    void fetch('/api/v1/extensions/johns-hopkins/admin/overview', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: AdminOverview | null) => {
        if (active && data) {
          setOverview(data)
          setComplianceComplete(Object.fromEntries(data.complianceWork.map((item) => [item.id, item.complete])))
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const metrics = useMemo(() => overview.metrics, [overview])
  const completedCompliance = useMemo(
    () => overview.complianceWork.filter((item) => complianceComplete[item.id]).length,
    [complianceComplete, overview.complianceWork],
  )
  const complianceReadiness = overview.complianceWork.length > 0
    ? Math.round((completedCompliance / overview.complianceWork.length) * 100)
    : 0
  const highRiskCount = overview.studentSuccessRisks.filter((item) => item.severity === 'High').length

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
                title="University operating tracks"
                description="Student success, research compliance, and faculty support readiness."
                icon={School}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.operatingTracks.map((item) => (
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
                title="Research and student-data compliance"
                description="Toggle readiness for FERPA-safe advising, research compliance, and grant governance."
                icon={ClipboardList}
              >
                <div className="space-y-4 p-4">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[var(--foreground)]">Compliance readiness</p>
                      <StatusPill tone={readinessTone(complianceReadiness)}>{complianceReadiness}%</StatusPill>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={complianceReadiness} />
                    </div>
                  </div>

                  <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                    {overview.complianceWork.map((item) => {
                      const complete = Boolean(complianceComplete[item.id])
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setComplianceComplete((current) => ({ ...current, [item.id]: !complete }))}
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
                title="Student success risk routing"
                description="Operational segments ready for advising, tutoring, or support routing."
                icon={AlertTriangle}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.studentSuccessRisks.map((item) => (
                    <Row
                      key={item.id}
                      title={item.segment}
                      detail={`${item.signal} Recommended action: ${item.action}.`}
                      meta={<StatusPill tone={severityTone(item.severity)}>{item.severity}</StatusPill>}
                    />
                  ))}
                </div>
              </Panel>

              <Panel
                title="Executive action"
                description="Generated from current compliance and risk state."
                icon={LineChart}
              >
                <div className="p-4">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {highRiskCount > 0 ? 'Escalate high-risk segments' : 'Pilot ready for expansion'}
                      </p>
                      <StatusPill tone={highRiskCount > 0 ? 'danger' : 'success'}>{highRiskCount} high</StatusPill>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                      {highRiskCount > 0
                        ? 'Open supplemental instruction capacity, resolve research onboarding blockers, and route account-hold cases to SEAM support.'
                        : 'All high-risk queues are clear. Expand the pilot to additional departments after compliance sign-off.'}
                    </p>
                  </div>
                </div>
              </Panel>

              <Panel
                title="University pilot boundary"
                description="The pitch: one on-prem workspace for academic, research, and administrative intelligence."
                icon={ShieldCheck}
              >
                <div className="p-4">
                  <p className="text-xs leading-relaxed text-[var(--muted)]">
                    Johns Hopkins can keep student-success workflows, professor research operations, and administrative governance in the same on-prem Overlay deployment while preserving role-specific access and data boundaries.
                  </p>
                </div>
              </Panel>
            </aside>
          </div>
        </div>
      </AppScreenBody>
    </AppScreenShell>
  )
}
