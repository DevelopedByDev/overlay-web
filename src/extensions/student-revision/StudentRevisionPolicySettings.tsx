'use client'

import {
  SettingsActionRow,
  SettingsCard,
  SettingsGroup,
} from '@overlay/modules-react/settings'
import { BookOpen, ShieldCheck, Target } from 'lucide-react'

export function StudentRevisionPolicySettings() {
  return (
    <>
      <SettingsGroup>
        <SettingsActionRow
          icon={<ShieldCheck size={18} strokeWidth={1.8} />}
          title="Approved-source mode"
          description="Keep revision answers grounded in school-uploaded files, rubrics, notes, and approved resources."
          action={<PolicyBadge label="On" />}
        />
        <SettingsActionRow
          icon={<BookOpen size={18} strokeWidth={1.8} />}
          title="Practice generation"
          description="Allow students to generate worksheets, flashcards, and mock questions from approved topics."
          action={<PolicyBadge label="On" />}
        />
        <SettingsActionRow
          icon={<Target size={18} strokeWidth={1.8} />}
          title="Parent-safe summaries"
          description="Limit parent-facing summaries to strengths, focus areas, and next actions."
          action={<PolicyBadge label="Draft" />}
        />
      </SettingsGroup>
      <SettingsCard title="Extension status">
        <p>
          Student Revision is registered through the local extension registry. Enterprise deployments can replace this panel with school-specific policy controls.
        </p>
      </SettingsCard>
    </>
  )
}

function PolicyBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex min-w-14 justify-center rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]">
      {label}
    </span>
  )
}
