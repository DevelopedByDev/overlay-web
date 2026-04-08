'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Moon, PanelsLeftRight, Sun } from 'lucide-react'
import { useAppSettings } from '@/components/app/AppSettingsProvider'

const SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'account', label: 'Account' },
  { id: 'customization', label: 'Customization' },
  { id: 'models', label: 'Models' },
  { id: 'contact', label: 'Contact' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

const SECTION_IDS = new Set<string>(SECTIONS.map((s) => s.id))

function SettingsToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
        checked
          ? 'border-[var(--foreground)] bg-[var(--foreground)]'
          : 'border-[var(--border)] bg-[var(--surface-subtle)]'
      } ${disabled ? 'cursor-wait opacity-70' : ''}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-[var(--surface-elevated)] transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function SettingRow({
  icon,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)]">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-[var(--foreground)]">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
        </div>
      </div>
      <SettingsToggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  )
}

function SectionPlaceholder({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
      <h2 className="text-sm font-medium text-[var(--foreground)]">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawSection = searchParams?.get('section') ?? 'general'
  const section: SectionId = SECTION_IDS.has(rawSection) ? (rawSection as SectionId) : 'general'

  const {
    settings,
    isLoading,
    isSaving,
    updateSettings,
  } = useAppSettings()

  const busy = isLoading || isSaving

  const sectionLabel = useMemo(
    () => SECTIONS.find((s) => s.id === section)?.label ?? 'General',
    [section],
  )

  useEffect(() => {
    if (!SECTION_IDS.has(rawSection)) {
      router.replace(`/app/settings?section=${section}`)
    }
  }, [rawSection, section, router])

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="flex h-16 shrink-0 items-center border-b border-[var(--border)] px-6">
        <h1 className="text-sm font-medium text-[var(--foreground)]">Settings</h1>
        <span className="mx-2 text-[var(--muted-light)]">·</span>
        <span className="text-sm text-[var(--muted)]">{sectionLabel}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {section === 'general' && (
            <>
              <SettingRow
                icon={settings.theme === 'dark' ? <Moon size={18} strokeWidth={1.8} /> : <Sun size={18} strokeWidth={1.8} />}
                title="Dark mode"
                description="Toggle the app between light and dark appearance."
                checked={settings.theme === 'dark'}
                disabled={busy}
                onChange={() => void updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
              />
              <SettingRow
                icon={<PanelsLeftRight size={18} strokeWidth={1.8} />}
                title="Secondary sidebar"
                description="Keep route-specific secondary sidebars enabled. When off, the app will use the single-sidebar layout once that rollout is completed."
                checked={settings.useSecondarySidebar}
                disabled={busy}
                onChange={() => void updateSettings({ useSecondarySidebar: !settings.useSecondarySidebar })}
              />
            </>
          )}

          {section === 'account' && (
            <SectionPlaceholder title="Account">
              <p>
                Manage your profile, billing, and subscription on the account portal.
              </p>
              <Link
                href="/account"
                className="mt-4 inline-flex text-sm font-medium text-[var(--foreground)] underline underline-offset-4 hover:opacity-90"
              >
                Open account →
              </Link>
            </SectionPlaceholder>
          )}

          {section === 'customization' && (
            <SectionPlaceholder title="Customization">
              <p>Additional appearance and layout options will appear here as they ship.</p>
            </SectionPlaceholder>
          )}

          {section === 'models' && (
            <SectionPlaceholder title="Models">
              <p>
                Default chat models are chosen from the composer on each conversation. Use the model menu in chat to
                switch models or compare answers in Ask mode.
              </p>
              <Link
                href="/app/chat"
                className="mt-4 inline-flex text-sm font-medium text-[var(--foreground)] underline underline-offset-4 hover:opacity-90"
              >
                Go to chat →
              </Link>
            </SectionPlaceholder>
          )}

          {section === 'contact' && (
            <SectionPlaceholder title="Contact">
              <p className="flex items-start gap-2">
                <Mail size={16} className="mt-0.5 shrink-0 text-[var(--muted)]" strokeWidth={1.75} />
                <span>
                  Questions or feedback? Email{' '}
                  <a
                    href="mailto:support@getoverlay.io"
                    className="font-medium text-[var(--foreground)] underline underline-offset-4 hover:opacity-90"
                  >
                    support@getoverlay.io
                  </a>
                  .
                </span>
              </p>
            </SectionPlaceholder>
          )}
        </div>
      </div>
    </div>
  )
}
