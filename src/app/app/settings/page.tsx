'use client'

// Compatibility wrapper: canonical settings registry metadata lives in @overlay/app-core,
// with reusable panel rendering primitives in @overlay/modules-react.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Mail, Moon, PanelsLeftRight, Sun, Play, Palette, ShieldCheck } from 'lucide-react'
import { TopUpPreferenceControl } from '@/features/billing/components/TopUpPreferenceControl'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { SettingsSectionSkeleton } from '@/components/ui/Skeleton'
import { LIGHT_PRESETS, DARK_PRESETS } from '@/shared/app/themes'
import { overlayAppClient } from '@/shared/app/overlay-app-client'
import { overlayAppShell } from '@/overlay.config'
import type { BillingSettings } from '@overlay/app-core'
import { normalizeTopUpDraft, resolveSettingsPanel } from '@overlay/app-core/settings-account'
import {
  SettingRow,
  SettingsActionRow,
  SettingsCard,
  SettingsPageShell,
  SettingsTopUpCard,
  ThemePresetRow,
} from '@overlay/modules-react/settings'
import dynamic from 'next/dynamic'

const MemoriesView = dynamic(() => import('@/features/knowledge/components/MemoriesView'))

const SECTIONS = overlayAppShell.settingsSections
const SETTINGS_PANELS = overlayAppShell.settingsPanels

const DEFAULT_SECTION_ID = SECTIONS[0]?.id ?? 'general'
const SECTION_IDS = new Set<string>(SECTIONS.map((s) => s.id))
const IMPLEMENTED_SECTION_IDS = new Set<string>([
  'general',
  'account',
  'customization',
  'memories',
  'models',
  'contact',
])

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawSection = searchParams?.get('section') ?? DEFAULT_SECTION_ID
  const section = SECTION_IDS.has(rawSection) ? rawSection : DEFAULT_SECTION_ID

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
  const registeredPanel = useMemo(
    () => resolveSettingsPanel(SETTINGS_PANELS, section),
    [section],
  )

  useEffect(() => {
    if (!SECTION_IDS.has(rawSection)) {
      router.replace(`/app/settings?section=${section}`)
    }
  }, [rawSection, section, router])

  useEffect(() => {
    if (section !== 'account' && section !== 'general') return
    let active = true
    void overlayAppClient.subscription.getSettingsResponse()
      .then(async (response) => {
        if (!response.ok) return null
        return await response.json()
      })
      .then((data) => {
        if (active && data) {
          const draft = normalizeTopUpDraft(data)
          setBillingSettings(data)
          setTopUpDraftCents(draft.topUpAmountCents)
          setAutoTopUpEnabledDraft(draft.autoTopUpEnabled)
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
      const response = await overlayAppClient.subscription.updateSettingsResponse(next)
      if (!response.ok) return
      const refreshed = await overlayAppClient.subscription.getSettingsResponse()
      if (refreshed.ok) {
        const data = await refreshed.json()
        const draft = normalizeTopUpDraft(data)
        setBillingSettings(data)
        setTopUpDraftCents(draft.topUpAmountCents)
        setAutoTopUpEnabledDraft(draft.autoTopUpEnabled)
      }
    } finally {
      setBillingBusy(false)
    }
  }

  return (
    <SettingsPageShell activeLabel={sectionLabel}>
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
              <SettingRow
                icon={<ShieldCheck size={18} strokeWidth={1.8} />}
                title="Only allow ZDR models"
                description={
                  billingSettings?.planKind === 'free'
                    ? 'Free models do not support zero data retention, so this is available on paid plans only.'
                    : 'Hide non-ZDR text models from the chat model picker and block stale requests that use them.'
                }
                checked={billingSettings?.planKind === 'free' ? false : settings.onlyAllowZdrModels}
                disabled={busy || billingSettings?.planKind === 'free'}
                onChange={() => void updateSettings({ onlyAllowZdrModels: !settings.onlyAllowZdrModels })}
              />
              <SettingsActionRow
                icon={<Play size={18} strokeWidth={1.8} />}
                title="Onboarding tour"
                description="Replay the guided walkthrough that highlights the key features of the app."
                action={
                  <button
                    type="button"
                    onClick={() => { void overlayAppClient.onboarding.resetResponse().then(() => router.push('/app/chat?tour=replay')) }}
                    className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-elevated)]"
                  >
                    Replay tour
                  </button>
                }
              />
            </>
          )}

          {!isLoading && section === 'account' && (
            <>
              <SettingsCard title="Billing">
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
              </SettingsCard>

              {billingSettings?.planKind === 'paid' ? (
                <SettingsTopUpCard>
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
                </SettingsTopUpCard>
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
              <ThemePresetRow
                label="Light theme"
                description="Choose the color preset used when the app is in light mode."
                presets={LIGHT_PRESETS}
                value={settings.lightThemePreset}
                disabled={busy}
                icon={<Palette size={18} strokeWidth={1.8} />}
                onChange={(id) => void updateSettings({ lightThemePreset: id })}
              />
              <ThemePresetRow
                label="Dark theme"
                description="Choose the color preset used when the app is in dark mode."
                presets={DARK_PRESETS}
                value={settings.darkThemePreset}
                disabled={busy}
                icon={<Palette size={18} strokeWidth={1.8} />}
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
            <SettingsCard title="Models">
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
            </SettingsCard>
          )}

          {!isLoading && section === 'contact' && (
            <SettingsCard title="Contact">
              <p className="flex items-start gap-2">
                <Mail size={16} className="mt-0.5 shrink-0 text-[var(--muted)]" strokeWidth={1.75} />
                <span>
                  Questions or feedback? Email the founder:{' '}
                  <a
                    href={`mailto:${overlayAppShell.brand.supportEmail ?? 'divyansh@layernorm.co'}`}
                    className="font-medium text-[var(--foreground)] underline underline-offset-4 hover:opacity-90"
                  >
                    {overlayAppShell.brand.supportEmail ?? 'divyansh@layernorm.co'}
                  </a>
                  .
                </span>
              </p>
            </SettingsCard>
          )}

          {!isLoading && !IMPLEMENTED_SECTION_IDS.has(section) && (
            <SettingsCard title={registeredPanel?.label ?? sectionLabel}>
              <p>
                {registeredPanel
                  ? `The settings panel ${registeredPanel.componentKey} is registered in the app shell but does not have a local web renderer yet.`
                  : 'This settings section is registered in the app shell but does not have a web implementation yet.'}
              </p>
            </SettingsCard>
          )}
    </SettingsPageShell>
  )
}
