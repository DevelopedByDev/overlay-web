'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, CreditCard, GaugeCircle, MessageSquare, PlusCircle, Wallet } from 'lucide-react'
import { TopUpPreferenceControl } from '@/components/billing/TopUpPreferenceControl'
import { PageNavbar } from '@/components/PageNavbar'
import { useAuth } from '@/contexts/AuthContext'
import { LandingThemeProvider, useLandingTheme } from '@/contexts/LandingThemeContext'
import {
  PAID_PLAN_MAX_AMOUNT_CENTS,
  PAID_PLAN_MIN_AMOUNT_CENTS,
  PAID_PLAN_STEP_AMOUNT_CENTS,
  centsToDollarAmount,
  formatDollarAmount,
  getStorageLimitBytes,
} from '@/lib/billing-pricing'
import {
  marketingBody,
  marketingFeatureText,
  marketingHeading,
  marketingMuted,
  marketingPageTitle,
  marketingPanel,
} from '@/lib/landingPageStyles'
import { formatBytes } from '@/lib/storage-limits'

function UserIdExtractor() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const userId = searchParams?.get('userId')
    if (userId) {
      localStorage.setItem('userId', userId)
    }
  }, [searchParams])

  return null
}

function PricingContent() {
  const router = useRouter()
  const { isLandingDark } = useLandingTheme()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [selectedPlanAmountCents, setSelectedPlanAmountCents] = useState(2_000)
  const [topUpAmountCents, setTopUpAmountCents] = useState(800)
  const [autoTopUpEnabled, setAutoTopUpEnabled] = useState(false)
  const [currentPlanKind, setCurrentPlanKind] = useState<'free' | 'paid'>('free')
  const [currentPlanAmountCents, setCurrentPlanAmountCents] = useState(0)
  const [loading, setLoading] = useState<'checkout' | 'portal' | 'topup-settings' | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return

    let active = true
    setSubscriptionLoading(true)

    void Promise.all([
      fetch(`/api/subscription?userId=${encodeURIComponent(user.id)}`).then(async (response) => {
        if (!response.ok) return null
        return await response.json()
      }),
      fetch('/api/subscription/settings').then(async (response) => {
        if (!response.ok) return null
        return await response.json()
      }),
    ])
      .then(([subscriptionData, settingsData]) => {
        if (!active) return
        if (subscriptionData) {
          const planKind = subscriptionData.planKind === 'paid' ? 'paid' : 'free'
          const planAmountCents = Math.max(0, Math.round(Number(subscriptionData.planAmountCents ?? 0)))
          setCurrentPlanKind(planKind)
          setCurrentPlanAmountCents(planAmountCents)
          if (planKind === 'paid' && planAmountCents >= PAID_PLAN_MIN_AMOUNT_CENTS) {
            setSelectedPlanAmountCents(planAmountCents)
          }
        }
        if (settingsData) {
          setTopUpAmountCents(Math.max(settingsData.topUpMinAmountCents ?? 800, settingsData.topUpAmountCents ?? settingsData.autoTopUpAmountCents ?? 800))
          setAutoTopUpEnabled(Boolean(settingsData.autoTopUpEnabled))
        }
      })
      .catch((fetchError) => {
        console.error('[Pricing] Failed to fetch subscription:', fetchError)
      })
      .finally(() => {
        if (active) setSubscriptionLoading(false)
      })

    return () => {
      active = false
    }
  }, [isAuthenticated, user?.id])

  const selectedPlanDollars = centsToDollarAmount(selectedPlanAmountCents)
  const selectedStorageBytes = useMemo(
    () => getStorageLimitBytes({ planKind: 'paid', planAmountCents: selectedPlanAmountCents }),
    [selectedPlanAmountCents],
  )
  const isCurrentPaidSelection =
    currentPlanKind === 'paid' && currentPlanAmountCents === selectedPlanAmountCents

  const theme = {
    title: marketingPageTitle(isLandingDark),
    heading: marketingHeading(isLandingDark),
    body: marketingBody(isLandingDark),
    muted: marketingMuted(isLandingDark),
    panel: marketingPanel(isLandingDark),
    heroGlow: '',
    primaryButton: isLandingDark
      ? 'overlay-interactive border border-zinc-100 bg-zinc-100 text-zinc-900'
      : 'overlay-interactive border border-zinc-900 bg-zinc-900 text-white',
    secondaryButton: isLandingDark
      ? 'overlay-interactive border border-zinc-700 bg-zinc-900 text-zinc-100'
      : 'overlay-interactive border border-zinc-200 bg-white text-zinc-900',
    badge: isLandingDark
      ? 'bg-zinc-100 text-zinc-900'
      : 'bg-zinc-900 text-white',
    iconChip: isLandingDark
      ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-700 bg-zinc-950 text-zinc-100'
      : 'inline-flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-50 text-zinc-900',
    elevatedCard: isLandingDark
      ? 'border border-zinc-800 bg-zinc-950 p-4'
      : 'border border-zinc-200 bg-white p-4',
    subtleCard: isLandingDark
      ? 'border border-zinc-800 bg-zinc-950 p-4'
      : 'border border-zinc-200 bg-zinc-50 p-4',
    featurePanel: isLandingDark
      ? 'border border-zinc-800 bg-zinc-950 p-6'
      : 'border border-zinc-200 bg-zinc-50 p-6',
    sliderTrack: isLandingDark
      ? 'mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-zinc-100'
      : 'mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900',
    currentPlanPill: isLandingDark
      ? 'inline-flex items-center justify-center border border-emerald-700/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200'
      : 'inline-flex items-center justify-center border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800',
  }

  async function handleSubscribe() {
    if (!isAuthenticated || !user) {
      router.push(`/auth/sign-in?redirect=${encodeURIComponent('/pricing')}`)
      return
    }

    setLoading('checkout')
    setError(null)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planAmountCents: selectedPlanAmountCents,
          topUpAmountCents,
          autoTopUpEnabled,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/auth/sign-in?redirect=${encodeURIComponent('/pricing')}`)
          return
        }
        setError(data.error || 'Failed to start checkout.')
        return
      }

      if (data.url) {
        window.location.href = data.url
        return
      }

      setError('No checkout URL returned. Please try again.')
    } catch (checkoutError) {
      console.error('[Pricing] Checkout error:', checkoutError)
      setError('Failed to start checkout. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  async function handleManageBilling() {
    setLoading('portal')
    setError(null)

    try {
      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      if (!response.ok || !data.url) {
        setError(data.error || 'Failed to open billing portal.')
        return
      }
      window.location.href = data.url
    } catch (portalError) {
      console.error('[Pricing] Portal error:', portalError)
      setError('Failed to open billing portal.')
    } finally {
      setLoading(null)
    }
  }

  async function handleSaveTopUpPreference() {
    setLoading('topup-settings')
    setError(null)

    try {
      const response = await fetch('/api/subscription/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topUpAmountCents,
          autoTopUpEnabled,
          grantOffSessionConsent: autoTopUpEnabled,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || 'Failed to save top-up preference.')
      }
    } catch (saveError) {
      console.error('[Pricing] Top-up settings error:', saveError)
      setError('Failed to save top-up preference.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col" style={{ background: 'var(--background)' }}>
      <Suspense fallback={null}>
        <UserIdExtractor />
      </Suspense>

      <PageNavbar />

      <main className="relative z-10 flex-1 px-4 py-10 md:px-8 md:py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <div className="text-center">
            <h1 className={`text-3xl font-serif md:text-4xl ${theme.title}`}>Plans</h1>
            <p className={`mx-auto mt-3 max-w-xl text-base ${theme.muted}`}>
              Free for core chat and workspace. Paid adds every premium feature—pick a monthly budget ($8–$200).
            </p>
            {!authLoading && !isAuthenticated ? (
              <div className="mt-6 inline-flex items-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                Sign in to start a paid plan.
                <Link href="/auth/sign-in?redirect=/pricing" className="font-medium underline">
                  Sign in →
                </Link>
              </div>
            ) : null}
            {error ? (
              <div className="mt-6 inline-flex bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
            <section className={theme.panel}>
              <div className="flex items-center gap-3">
                <div className={theme.iconChip}>
                  <MessageSquare className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <h2 className={`text-xl font-medium ${theme.heading}`}>Free</h2>
                  <p className={`text-sm ${theme.muted}`}>Auto model and core workspace.</p>
                </div>
              </div>

              <div className="mt-5">
                <div className={`text-4xl font-serif ${theme.title}`}>$0</div>
                <p className={`mt-2 text-sm ${theme.body}`}>No card required.</p>
              </div>

              <ul className="mt-6 space-y-3">
                {[
                  'Unlimited Auto model messages',
                  'Notes, chats, knowledge, projects, and automations',
                  'Basic AI tools and core workspace flows',
                  '10 MB of file storage',
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isLandingDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <span className={`text-sm ${marketingFeatureText(isLandingDark, true)}`}>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={isAuthenticated ? '/app/chat' : '/auth/sign-in?redirect=%2Fapp%2Fchat'}
                className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${theme.secondaryButton}`}
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>

            <section className={`${theme.panel} relative overflow-hidden`}>
              <div className={`pointer-events-none absolute inset-0 ${theme.heroGlow}`} />
              <div className="absolute right-6 top-6">
                <div className={`rounded-full px-3 py-1 text-xs font-medium ${theme.badge}`}>All premium features included</div>
              </div>

              <div className="relative flex items-center gap-3">
                <div className={theme.iconChip}>
                  <CreditCard className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <h2 className={`text-xl font-medium ${theme.heading}`}>Paid</h2>
                  <p className={`text-sm ${theme.muted}`}>Full product—you choose the monthly budget.</p>
                </div>
              </div>

              <div className="relative mt-8 grid gap-6 md:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <div className={theme.elevatedCard}>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className={`text-5xl font-serif ${theme.title}`}>{formatDollarAmount(selectedPlanAmountCents)}</div>
                      <div className={`pb-2 text-sm ${theme.muted}`}>per month</div>
                    </div>
                    <p className={`mt-3 max-w-xl text-sm leading-relaxed ${theme.body}`}>
                      One paid plan, all premium access. The only thing that changes is how much monthly budget and storage you want available.
                    </p>
                  </div>

                  <div className={`mt-5 ${theme.subtleCard}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={theme.muted}>Choose your monthly budget</span>
                      <span className={theme.heading}>{formatDollarAmount(selectedPlanAmountCents)}</span>
                    </div>
                    <input
                      type="range"
                      min={PAID_PLAN_MIN_AMOUNT_CENTS / 100}
                      max={PAID_PLAN_MAX_AMOUNT_CENTS / 100}
                      step={PAID_PLAN_STEP_AMOUNT_CENTS / 100}
                      value={selectedPlanDollars}
                      onChange={(event) => {
                        setSelectedPlanAmountCents(Math.round(Number(event.target.value) * 100))
                      }}
                      className={theme.sliderTrack}
                    />
                    <div className={`mt-2 flex items-center justify-between text-xs ${theme.muted}`}>
                      <span>$8</span>
                      <span>$200</span>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className={theme.elevatedCard}>
                      <p className={`text-xs uppercase tracking-[0.18em] ${theme.muted}`}>Monthly budget</p>
                      <p className={`mt-2 text-lg font-medium ${theme.heading}`}>{formatDollarAmount(selectedPlanAmountCents)}</p>
                    </div>
                    <div className={theme.elevatedCard}>
                      <p className={`text-xs uppercase tracking-[0.18em] ${theme.muted}`}>File storage</p>
                      <p className={`mt-2 text-lg font-medium ${theme.heading}`}>{formatBytes(selectedStorageBytes)}</p>
                    </div>
                    <div className={theme.elevatedCard}>
                      <p className={`text-xs uppercase tracking-[0.18em] ${theme.muted}`}>Top-ups</p>
                      <p className={`mt-2 text-lg font-medium ${theme.heading}`}>${(topUpAmountCents / 100).toFixed(0)}</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <TopUpPreferenceControl
                      variant="marketing"
                      isDark={isLandingDark}
                      title="Future top-up amount"
                      description="Set the amount used for future recharges. This is not charged during signup."
                      amountCents={topUpAmountCents}
                      minAmountCents={800}
                      maxAmountCents={20_000}
                      stepAmountCents={100}
                      onAmountChange={setTopUpAmountCents}
                      autoTopUpEnabled={autoTopUpEnabled}
                      onAutoTopUpEnabledChange={setAutoTopUpEnabled}
                      checkboxDescription="If enabled, the same amount will recharge automatically whenever your cumulative budget reaches zero."
                    />
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    {currentPlanKind === 'paid' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleManageBilling()}
                          disabled={loading === 'portal' || subscriptionLoading}
                          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${theme.primaryButton}`}
                        >
                          {loading === 'portal'
                            ? 'Opening billing portal...'
                            : isCurrentPaidSelection
                              ? 'Current plan'
                              : 'Change plan in billing portal'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveTopUpPreference()}
                          disabled={loading === 'topup-settings' || subscriptionLoading}
                          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${theme.secondaryButton}`}
                        >
                          {loading === 'topup-settings' ? 'Saving preference...' : 'Save top-up preference'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSubscribe()}
                        disabled={loading === 'checkout' || subscriptionLoading}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${theme.primaryButton}`}
                      >
                        {loading === 'checkout' ? 'Starting checkout...' : `Start ${formatDollarAmount(selectedPlanAmountCents)}/month`}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}

                    {currentPlanKind === 'paid' ? (
                      <div
                        className={theme.currentPlanPill}
                      >
                        Current plan: {formatDollarAmount(currentPlanAmountCents)}/month
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className={theme.featurePanel}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className={`text-sm font-medium ${theme.heading}`}>Every paid plan includes</h3>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${theme.badge}`}>Same access at every level</span>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {[
                        'Premium chat models',
                        'Daytona sandboxes',
                        'Browser tasks',
                        'Image generation',
                        'Video generation',
                        'Advanced agents and premium workflows',
                        'Future paid features as they launch',
                      ].map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isLandingDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                          <span className={`text-sm ${marketingFeatureText(isLandingDark, true)}`}>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className={theme.panel}>
            <h2 className={`text-sm font-medium ${theme.heading}`}>How billing works</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                {
                  Icon: Wallet,
                  label: 'Monthly budget',
                  hint: 'Your plan amount is what you can spend each cycle.',
                },
                {
                  Icon: GaugeCircle,
                  label: 'Usage draws it down',
                  hint: 'Priced features use budget with a small markup.',
                },
                {
                  Icon: PlusCircle,
                  label: 'Top up if needed',
                  hint: 'Add one-time budget from your account anytime.',
                },
              ].map(({ Icon, label, hint }) => (
                <div
                  key={label}
                  className={`flex gap-3 ${theme.subtleCard}`}
                >
                  <div className={theme.iconChip}>
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${theme.heading}`}>{label}</p>
                    <p className={`mt-1 text-xs leading-relaxed ${theme.muted}`}>{hint}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className={`mt-5 text-sm ${theme.body}`}>
              Manage billing in{' '}
              <Link href="/account" className={`font-medium underline underline-offset-4 ${theme.heading}`}>
                Account
              </Link>
              . You can use the same top-up amount there or let it recharge automatically.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}

export default function PricingPage() {
  return (
    <LandingThemeProvider>
      <PricingContent />
    </LandingThemeProvider>
  )
}
