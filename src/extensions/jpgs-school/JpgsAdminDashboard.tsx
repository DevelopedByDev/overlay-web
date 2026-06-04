'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BarChart3,
  Building2,
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
  ActionButton,
  MetricCard,
  Panel,
  ProgressBar,
  Row,
  StatusPill,
} from './JpgsDashboardPrimitives'
import {
  JPGS_ADMIN_OVERVIEW,
  type AdminOverview,
} from './data'

const metricIcons: Record<string, LucideIcon> = {
  learners: Users,
  adoption: Workflow,
  risks: AlertTriangle,
  campuses: Building2,
}

function readinessTone(value: number) {
  if (value >= 80) return 'success'
  if (value >= 68) return 'warning'
  return 'danger'
}

function complianceTone(status: 'On track' | 'Needs review' | 'Blocked') {
  if (status === 'On track') return 'success'
  if (status === 'Needs review') return 'warning'
  return 'danger'
}

export function JpgsAdminDashboard({
  featureModule,
}: OverlayExtensionComponentProps) {
  const [overview, setOverview] = useState<AdminOverview>(JPGS_ADMIN_OVERVIEW)

  useEffect(() => {
    let active = true
    void fetch('/api/v1/extensions/jpgs-school/admin/overview', { cache: 'no-store' })
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

  return (
    <AppScreenShell
      header={
        <AppScreenHeader
          title={featureModule?.label ?? 'JPGS Admin'}
          subtitle="JPGS extension"
          description="Leadership workspace for cross-campus curriculum operations, compliance evidence, and Overlay rollout governance."
          leading={<ShieldCheck size={18} strokeWidth={1.8} className="text-[var(--muted)]" />}
          metadata={<StatusPill tone="neutral">Group dashboard</StatusPill>}
        />
      }
    >
      <AppScreenBody padding="md" maxWidth="xl" className="bg-[var(--surface-muted)]">
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
                description="Group-level readiness across IB, Cambridge IGCSE, and CBSE workstreams."
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
                title="Compliance and accreditation queue"
                description="Evidence packs and time-sensitive administrative work."
                icon={ClipboardList}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.compliance.map((item) => (
                    <Row
                      key={item.id}
                      title={item.label}
                      detail={item.detail}
                      meta={<StatusPill tone={complianceTone(item.status)}>{item.status}</StatusPill>}
                      action={<ActionButton>{item.due}</ActionButton>}
                    />
                  ))}
                </div>
              </Panel>
            </div>

            <aside className="space-y-4">
              <Panel
                title="AI adoption"
                description="Weekly active usage across approved role groups."
                icon={Sparkles}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.aiAdoption.map((item) => (
                    <div key={item.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.role}</p>
                          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{item.detail}</p>
                        </div>
                        <StatusPill tone={readinessTone(item.adoption)}>{item.adoption}%</StatusPill>
                      </div>
                      <div className="mt-3">
                        <ProgressBar value={item.adoption} />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="Executive actions"
                description="Next decisions that turn the demo into an operational pilot."
                icon={LineChart}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.executiveActions.map((item) => (
                    <Row
                      key={item.id}
                      title={item.title}
                      detail={item.detail}
                      meta={<StatusPill tone="neutral">{item.owner}</StatusPill>}
                    />
                  ))}
                </div>
              </Panel>
            </aside>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)]">On-prem enterprise rollout</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                  JPGS can keep these dashboards in its own extension branch while still receiving Overlay product updates from main.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ShieldCheck size={16} strokeWidth={1.8} className="text-[var(--muted-light)]" />
                <span className="text-xs text-[var(--muted)]">{overview.schoolGroup}</span>
              </div>
            </div>
          </div>
        </div>
      </AppScreenBody>
    </AppScreenShell>
  )
}
