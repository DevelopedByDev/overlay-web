// @enterprise-future — not wired to production
// Admin Overview page: stat cards + quick links

import StatCard from '@/components/admin/StatCard'
import { Users, Cpu, HardDrive } from 'lucide-react'

export default function AdminOverviewPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Overview
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Instance health and key metrics
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value="—" trend="Coming in Phase 4" />
        <StatCard label="Active today" value="—" trend="Coming in Phase 4" />
        <StatCard
          label="Storage used"
          value="—"
          trend="Coming in Phase 4"
        />
        <StatCard
          label="Credits this period"
          value="—"
          trend="Coming in Phase 4"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickLinkCard
          href="/admin/users"
          icon={<Users size={20} strokeWidth={1.8} />}
          title="Users"
          description="Manage accounts, roles, and invites"
        />
        <QuickLinkCard
          href="/admin/security"
          icon={<Cpu size={20} strokeWidth={1.8} />}
          title="Security"
          description="Audit log and access events"
        />
        <QuickLinkCard
          href="/admin/settings"
          icon={<HardDrive size={20} strokeWidth={1.8} />}
          title="Settings"
          description="Instance configuration and providers"
        />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
        <h3 className="text-sm font-medium text-[var(--foreground)]">
          Instance Info
        </h3>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Version</dt>
            <dd className="font-mono text-[var(--foreground)]">
              {process.env.npm_package_version || '0.1.1'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Node Env</dt>
            <dd className="font-mono text-[var(--foreground)]">
              {process.env.NODE_ENV || 'development'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Admin IDs</dt>
            <dd className="font-mono text-[var(--foreground)]">
              {(process.env.OVERLAY_ADMIN_USER_IDS || '').split(',').filter(Boolean).length} configured
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Deployment</dt>
            <dd className="font-mono text-[var(--foreground)]">
              {process.env.VERCEL ? 'Vercel' : 'Self-hosted'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

function QuickLinkCard({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <a
      href={href}
      className="flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm transition-colors hover:bg-[var(--surface-subtle)]"
    >
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)]">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-medium text-[var(--foreground)]">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      </div>
    </a>
  )
}
