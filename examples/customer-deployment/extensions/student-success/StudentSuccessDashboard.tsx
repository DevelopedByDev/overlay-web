'use client'

import {
  AppScreenBody,
  AppScreenHeader,
  AppScreenShell,
} from '@overlay/modules-react/shell'
import { GraduationCap } from 'lucide-react'

export function StudentSuccessDashboard() {
  return (
    <AppScreenShell
      header={
        <AppScreenHeader
          title="Student Success"
          subtitle="Customer extension"
          description="A school-owned dashboard for revision planning, weak-topic queues, and support actions."
          leading={<GraduationCap size={18} strokeWidth={1.8} className="text-[var(--muted)]" />}
        />
      }
    >
      <AppScreenBody padding="md" maxWidth="xl" className="bg-[var(--surface-muted)]">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['At-risk topics', '3'],
            ['Support actions', '18'],
            ['Parent summaries', '6'],
          ].map(([label, value]) => (
            <article key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
              <p className="text-xs text-[var(--muted)]">{label}</p>
              <p className="mt-3 text-2xl font-medium text-[var(--foreground)]">{value}</p>
            </article>
          ))}
        </div>
      </AppScreenBody>
    </AppScreenShell>
  )
}
