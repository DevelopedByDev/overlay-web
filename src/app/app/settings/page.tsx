'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Mail, Moon, PanelsLeftRight, Sun, Play, Palette } from 'lucide-react'
import { TopUpPreferenceControl } from '@/components/billing/TopUpPreferenceControl'
import { useAppSettings } from '@/components/app/AppSettingsProvider'
import { SettingsSectionSkeleton } from '@/components/ui/Skeleton'
import { LIGHT_PRESETS, DARK_PRESETS } from '@/lib/themes'
import type { ThemePresetId } from '@overlay/app-core'
import dynamic from 'next/dynamic'

const MemoriesView = dynamic(() => import('@/components/app/MemoriesView'))

const SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'account', label: 'Account' },
  { id: 'customization', label: 'Customization' },
  { id: 'memories', label: 'Memories' },
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

function PresetRow({
  label,
  description,
  presets,
  value,
  disabled,
  onChange,
}: {
  label: string
  description: string
  presets: { id: ThemePresetId; name: string; previewColors: { background: string; accent: string } }[]
  value: ThemePresetId
  disabled?: boolean
  onChange: (id: ThemePresetId) => void
}) {
  const active = presets.find((p) => p.id === value)
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)]">
          <Palette size={18} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-[var(--foreground)]">{label}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {active && (
          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1.5">
            <span
              className="inline-block h-3.5 w-3.5 rounded-full border border-[var(--border)]"
              style={{ backgroundColor: active.previewColors.background }}
            />
            <span
              className="inline-block h-3.5 w-3.5 rounded-full border border-[var(--border)]"
              style={{ backgroundColor: active.previewColors.accent }}
            />
          </div>
        )}
        <select
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value as ThemePresetId)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)] disabled:opacity-60"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
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

interface BillingSettings {
  planKind: 'free' | 'paid'
  autoTopUpEnabled: boolean
  topUpAmountCents: number
  autoTopUpAmountCents: number
  offSessionConsentAt?: number
  topUpMinAmountCents: number
  topUpMaxAmountCents: number
  topUpStepAmountCents: number
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawSection = searchParams?.get('section') ?? 'general'
  const section: SectionId = SECTION_IDS.has(rawSection) ? (rawSection as SectionId) : 'general'

  const { isAuthenticated, isLoading: authLoading } = useAuth()
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/app/chat?signin=nav')
  }, [authLoading, isAuthenticated, router])

  const {
    settings,
    isLoading,
    isSaving,
    updateSettings,
  } = useAppSettings()
  const [billingSettings, setBillingSettings] = useState<BillingSettings | null>(null)
  const [billingBusy, setBillingBusy] = useState(false)
  const [topUpDraftCents, setTopUpDraftCents] = useState(800)
  const [autoTopUpEnabledDraft, setAutoTopUpEnabledDraft] = useState(false)

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

  useEffect(() => {
    if (section !== 'account') return
    let active = true
    void fetch('/api/subscription/settings')
      .then(async (response) => {
        if (!response.ok) return null
        return await response.json()
      })
      .then((data) => {
        if (active && data) {
          setBillingSettings(data)
          setTopUpDraftCents(data.topUpAmountCents ?? data.autoTopUpAmountCents ?? data.topUpMinAmountCents ?? 800)
          setAutoTopUpEnabledDraft(Boolean(data.autoTopUpEnabled))
        }
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [section])

  async function updateBillingSettings(next: {
    autoTopUpEnabled: boolean
    topUpAmountCents: number
    grantOffSessionConsent?: boolean
  }) {
    setBillingBusy(true)
    try {
      const response = await fetch('/api/subscription/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!response.ok) return
      const refreshed = await fetch('/api/subscription/settings')
      if (refreshed.ok) {
        const data = await refreshed.json()
        setBillingSettings(data)
        setTopUpDraftCents(data.topUpAmountCents ?? data.autoTopUpAmountCents ?? data.topUpMinAmountCents ?? 800)
        setAutoTopUpEnabledDraft(Boolean(data.autoTopUpEnabled))
      }
    } finally {
      setBillingBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="flex h-16 shrink-0 items-center border-b border-[var(--border)] px-6">
        <h1 className="text-sm font-medium text-[var(--foreground)]">Settings</h1>
        <span className="mx-2 text-[var(--muted-light)]">·</span>
        <span className="text-sm text-[var(--muted)]">{sectionLabel}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {isLoading ? (
            <SettingsSectionSkeleton rows={section === 'general' ? 2 : 1} />
          ) : null}
          {!isLoading && section === 'general' && (
            <>
              <SettingRow
                icon={<PanelsLeftRight size={18} strokeWidth={1.8} />}
                title="Secondary sidebar"
                description="Keep route-specific secondary sidebars enabled. When off, the app will use the single-sidebar layout once that rollout is completed."
                checked={settings.useSecondarySidebar}
                disabled={busy}
                onChange={() => void updateSettings({ useSecondarySidebar: !settings.useSecondarySidebar })}
              />
              <SettingRow
                icon={<Play size={18} strokeWidth={1.8} />}
                title="Auto-continue"
                description="Automatically resume chats when the assistant times out or is interrupted."
                checked={settings.autoContinue}
                disabled={busy}
                onChange={() => void updateSettings({ autoContinue: !settings.autoContinue })}
              />
              <div className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)]">
                    <Play size={18} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-medium text-[var(--foreground)]">Onboarding tour</h2>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">Replay the guided walkthrough that highlights the key features of the app.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { void fetch('/api/app/onboarding/reset', { method: 'POST' }).then(() => router.push('/app/chat?tour=replay')) }}
                  className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-elevated)]"
                >
                  Replay tour
                </button>
              </div>
            </>
          )}

          {!isLoading && section === 'account' && (
            <>
              <SectionPlaceholder title="Billing">
                <p>
                  {billingSettings?.planKind === 'paid'
                    ? 'Paid plans unlock premium models, Daytona sandboxes, browser tasks, and generation tools. Adjust your recurring amount in billing, and use auto top-up here for off-session recharges.'
                    : 'You are currently on the free plan. Upgrade from the pricing page to unlock premium features and budget controls.'}
                </p>
                <Link
                  href="/account"
                  className="mt-4 inline-flex text-sm font-medium text-[var(--foreground)] underline underline-offset-4 hover:opacity-90"
                >
                  Open account →
                </Link>
              </SectionPlaceholder>

              {billingSettings?.planKind === 'paid' ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
                  <TopUpPreferenceControl
                    variant="app"
                    title="Top-up amount"
                    description="Use one amount for manual top-ups and future automatic recharges."
                    amountCents={topUpDraftCents}
                    minAmountCents={billingSettings.topUpMinAmountCents}
                    maxAmountCents={billingSettings.topUpMaxAmountCents}
                    stepAmountCents={billingSettings.topUpStepAmountCents}
                    onAmountChange={setTopUpDraftCents}
                    autoTopUpEnabled={autoTopUpEnabledDraft}
                    onAutoTopUpEnabledChange={setAutoTopUpEnabledDraft}
                    checkboxDescription="If enabled, this same amount will recharge automatically whenever your cumulative budget reaches zero."
                    note="Use Account to run a manual top-up now. Saving here updates the future recharge amount and auto-top-up preference."
                    footer={
                      <button
                        type="button"
                        disabled={billingBusy}
                        onClick={() => void updateBillingSettings({
                          autoTopUpEnabled: autoTopUpEnabledDraft,
                          topUpAmountCents: topUpDraftCents,
                          grantOffSessionConsent: autoTopUpEnabledDraft,
                        })}
                        className="inline-flex rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {billingBusy ? 'Saving...' : 'Save top-up preference'}
                      </button>
                    }
                  />
                </div>
              ) : null}
            </>
          )}

          {!isLoading && section === 'customization' && (
            <>
              <SettingRow
                icon={settings.theme === 'dark' ? <Moon size={18} strokeWidth={1.8} /> : <Sun size={18} strokeWidth={1.8} />}
                title="Dark mode"
                description="Toggle the app between light and dark appearance."
                checked={settings.theme === 'dark'}
                disabled={busy}
                onChange={() => void updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
              />
              <PresetRow
                label="Light theme"
                description="Choose the color preset used when the app is in light mode."
                presets={LIGHT_PRESETS}
                value={settings.lightThemePreset}
                disabled={busy}
                onChange={(id) => void updateSettings({ lightThemePreset: id })}
              />
              <PresetRow
                label="Dark theme"
                description="Choose the color preset used when the app is in dark mode."
                presets={DARK_PRESETS}
                value={settings.darkThemePreset}
                disabled={busy}
                onChange={(id) => void updateSettings({ darkThemePreset: id })}
              />
            </>
          )}

          {!isLoading && section === 'memories' && (
            <div className="-mx-6 -my-6 h-[calc(100vh-4rem)]">
              <MemoriesView userId="" />
            </div>
          )}

          {!isLoading && section === 'models' && (
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

          {!isLoading && section === 'contact' && (
            <SectionPlaceholder title="Contact">
              <p className="flex items-start gap-2">
                <Mail size={16} className="mt-0.5 shrink-0 text-[var(--muted)]" strokeWidth={1.75} />
                <span>
                  Questions or feedback? Email the founder:{' '}
                  <a
                    href="mailto:divyansh@layernorm.co"
                    className="font-medium text-[var(--foreground)] underline underline-offset-4 hover:opacity-90"
                  >
                    divyansh@layernorm.co
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
