'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, GaugeCircle, MessageSquare, PlusCircle, SlidersHorizontal, Wallet } from 'lucide-react'
import { PageNavbar } from '@/components/PageNavbar'
import { useAuth } from '@/contexts/AuthContext'
import { LandingThemeProvider, useLandingTheme } from '@/contexts/LandingThemeContext'
import {
  PAID_PLAN_MAX_AMOUNT_CENTS,
  PAID_PLAN_MIN_AMOUNT_CENTS,
  PAID_PLAN_STEP_AMOUNT_CENTS,
  TOP_UP_MIN_AMOUNT_CENTS,
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

const TIER_STARTER_CENTS = 800
const TIER_PRO_CENTS = 2_400
const TIER_MAX_CENTS = 9_400

type TierId = 'free' | 'starter' | 'pro' | 'max' | 'custom'

function tierIdForPaidAmount(cents: number): TierId {
  if (cents === TIER_STARTER_CENTS) return 'starter'
  if (cents === TIER_PRO_CENTS) return 'pro'
  if (cents === TIER_MAX_CENTS) return 'max'
  return 'custom'
}

const PAID_FEATURE_BULLETS = [
  'Premium chat models',
  'Daytona sandboxes',
  'Browser tasks',
  'Image and video generation',
  'Advanced agents and premium workflows',
]

const PAID_FEATURE_BULLETS_COMPACT = PAID_FEATURE_BULLETS.slice(0, 4)

function UserIdExtractor() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const userId = searchParams?.get('userId')
    if (userId) {
      sessionStorage.setItem('userId', userId)
    }
  }, [searchParams])

  return null
}

function PricingContent() {
  const router = useRouter()
  const { isLandingDark } = useLandingTheme()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [selectedTier, setSelectedTier] = useState<TierId>('starter')
  const [selectedPlanAmountCents, setSelectedPlanAmountCents] = useState(TIER_STARTER_CENTS)
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
            setSelectedTier(tierIdForPaidAmount(planAmountCents))
          }
        }
        if (settingsData) {
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

  const theme = {
    title: marketingPageTitle(isLandingDark),
    heading: marketingHeading(isLandingDark),
    body: marketingBody(isLandingDark),
    muted: marketingMuted(isLandingDark),
    panel: marketingPanel(isLandingDark),
    heroGlow: isLandingDark
      ? 'bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_45%)]'
      : 'bg-[radial-gradient(circle_at_top_left,rgba(10,10,10,0.06),transparent_45%)]',
    primaryButton: isLandingDark
      ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
      : 'bg-zinc-900 text-white hover:bg-zinc-800',
    secondaryButton: isLandingDark
      ? 'border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800'
      : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50',
    badge: isLandingDark
      ? 'bg-zinc-100 text-zinc-900'
      : 'bg-zinc-900 text-white',
    iconChip: isLandingDark
      ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100'
      : 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-900',
    tierCard: isLandingDark
      ? 'flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-950/75 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)]'
      : 'flex h-full flex-col rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-[0_16px_40px_rgba(10,10,10,0.07)]',
    subtleCard: isLandingDark
      ? 'rounded-2xl border border-zinc-800/90 bg-zinc-950/55 p-4'
      : 'rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4',
    sliderTrack: isLandingDark
      ? 'mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-zinc-100'
      : 'mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900',
    currentPlanPill: isLandingDark
      ? 'inline-flex w-full items-center justify-center rounded-xl border border-emerald-700/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200'
      : 'inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800',
  }

  function selectTier(tier: TierId, amountCents?: number) {
    setSelectedTier(tier)
    if (tier === 'free') return
    if (tier === 'custom' && typeof amountCents === 'number') {
      setSelectedPlanAmountCents(amountCents)
      return
    }
    if (tier === 'starter') setSelectedPlanAmountCents(TIER_STARTER_CENTS)
    else if (tier === 'pro') setSelectedPlanAmountCents(TIER_PRO_CENTS)
    else if (tier === 'max') setSelectedPlanAmountCents(TIER_MAX_CENTS)
    else if (tier === 'custom') setSelectedPlanAmountCents((prev) => prev)
  }

  async function startCheckout(planAmountCents: number, tier?: TierId) {
    if (tier) {
      if (tier === 'custom') selectTier('custom', planAmountCents)
      else selectTier(tier)
    }

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
          planAmountCents,
          topUpAmountCents: TOP_UP_MIN_AMOUNT_CENTS,
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
          topUpAmountCents: TOP_UP_MIN_AMOUNT_CENTS,
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

  function paidCtaForAmount(cardAmountCents: number, cardTier: TierId) {
    const subscribedTier =
      currentPlanKind === 'paid' ? tierIdForPaidAmount(currentPlanAmountCents) : null
    const isCurrent =
      currentPlanKind === 'paid' &&
      subscribedTier === cardTier &&
      currentPlanAmountCents === cardAmountCents
    const isAnotherPaid = currentPlanKind === 'paid' && !isCurrent

    if (currentPlanKind === 'paid' && isCurrent) {
      return (
        <div className={theme.currentPlanPill}>
          {subscriptionLoading ? 'Loading plan…' : 'Current plan'}
        </div>
      )
    }

    if (currentPlanKind === 'paid' && isAnotherPaid) {
      return (
        <button
          type="button"
          onClick={() => void handleManageBilling()}
          disabled={loading === 'portal' || subscriptionLoading}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${theme.secondaryButton}`}
        >
          {loading === 'portal' ? 'Opening billing portal…' : 'Change plan in billing portal'}
        </button>
      )
    }

    return (
      <button
        type="button"
        onClick={() => void startCheckout(cardAmountCents, cardTier)}
        disabled={loading === 'checkout' || subscriptionLoading}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${theme.primaryButton}`}
      >
        {loading === 'checkout' ? 'Starting checkout…' : `Subscribe ${formatDollarAmount(cardAmountCents)}/mo`}
        <ArrowRight className="h-4 w-4" />
      </button>
    )
  }

  return (
    <div className="flex min-h-screen w-full flex-col gradient-bg">
      <Suspense fallback={null}>
        <UserIdExtractor />
      </Suspense>
      <div className="liquid-glass" />

      <PageNavbar />

      <main className="relative z-10 flex-1 px-4 pb-10 pt-28 md:px-8 md:pb-14 md:pt-32">
        <div className="mx-auto flex max-w-7xl flex-col gap-10">
          <div className="text-center">
            <p className={`text-xs font-medium uppercase tracking-[0.2em] ${theme.muted}`}>Plans and pricing</p>
            <h1 className={`mt-3 text-3xl font-serif md:text-4xl ${theme.title}`}>Choose your plan</h1>
            <p className={`mx-auto mt-3 max-w-2xl text-base leading-relaxed ${theme.muted}`}>
              Free covers core chat and workspace. Paid tiers scale your monthly budget in $1 steps—same premium product at
              every level.
            </p>
            {!authLoading && !isAuthenticated ? (
              <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
                Sign in to subscribe.
                <Link href="/auth/sign-in?redirect=/pricing" className="font-medium underline">
                  Sign in →
                </Link>
              </div>
            ) : null}
            {error ? (
              <div className="mt-6 inline-flex rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
            {/* Free */}
            <section className={theme.tierCard}>
              <div className="flex items-center gap-3">
                <div className={theme.iconChip}>
                  <MessageSquare className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <h2 className={`text-lg font-semibold ${theme.heading}`}>Free</h2>
                  <p className={`text-xs ${theme.muted}`}>Auto model and core workspace</p>
                </div>
              </div>
              <div className="mt-6">
                <div className={`text-4xl font-serif ${theme.title}`}>$0</div>
                <p className={`mt-1 text-sm ${theme.body}`}>No card required</p>
              </div>
              <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                {[
                  'Unlimited Auto model messages',
                  'Notes, chats, knowledge, projects',
                  'Basic AI tools and core flows',
                  '10 MB file storage',
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isLandingDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <span className={`text-sm leading-snug ${marketingFeatureText(isLandingDark, true)}`}>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {currentPlanKind === 'free' ? (
                  <div className={theme.currentPlanPill}>{subscriptionLoading ? 'Loading…' : 'Current plan'}</div>
                ) : (
                  <Link
                    href={isAuthenticated ? '/app/chat' : '/auth/sign-in?redirect=%2Fapp%2Fchat'}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${theme.secondaryButton}`}
                  >
                    Start free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </section>

            {/* Starter */}
            <section
              className={`${theme.tierCard} ${selectedTier === 'starter' ? 'ring-2 ring-zinc-900/15 dark:ring-white/15' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className={`text-lg font-semibold ${theme.heading}`}>Starter</h2>
                  <p className={`text-xs ${theme.muted}`}>8 × $1 budget units / mo</p>
                </div>
              </div>
              <div className="mt-6">
                <div className="flex flex-wrap items-end gap-1.5">
                  <span className={`text-4xl font-serif ${theme.title}`}>$8</span>
                  <span className={`pb-1 text-sm ${theme.muted}`}>/ month</span>
                </div>
                <p className={`mt-2 text-xs leading-relaxed ${theme.muted}`}>
                  {formatBytes(getStorageLimitBytes({ planKind: 'paid', planAmountCents: TIER_STARTER_CENTS }))} storage
                </p>
              </div>
              <ul className="mt-4 flex flex-1 flex-col gap-2">
                <li className={`text-xs font-medium ${theme.muted}`}>Everything in Free, plus:</li>
                {PAID_FEATURE_BULLETS_COMPACT.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isLandingDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <span className={`text-sm leading-snug ${marketingFeatureText(isLandingDark, true)}`}>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">{paidCtaForAmount(TIER_STARTER_CENTS, 'starter')}</div>
            </section>

            {/* Pro */}
            <section
              className={`${theme.tierCard} ${selectedTier === 'pro' ? 'ring-2 ring-zinc-900/15 dark:ring-white/15' : ''}`}
            >
              <div>
                <h2 className={`text-lg font-semibold ${theme.heading}`}>Pro</h2>
                <p className={`text-xs ${theme.muted}`}>24 × $1 budget units / mo</p>
              </div>
              <div className="mt-6">
                <div className="flex flex-wrap items-end gap-1.5">
                  <span className={`text-4xl font-serif ${theme.title}`}>$24</span>
                  <span className={`pb-1 text-sm ${theme.muted}`}>/ month</span>
                </div>
                <p className={`mt-2 text-xs leading-relaxed ${theme.muted}`}>
                  {formatBytes(getStorageLimitBytes({ planKind: 'paid', planAmountCents: TIER_PRO_CENTS }))} storage
                </p>
              </div>
              <ul className="mt-4 flex flex-1 flex-col gap-2">
                <li className={`text-xs font-medium ${theme.muted}`}>Everything in Free, plus:</li>
                {PAID_FEATURE_BULLETS_COMPACT.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isLandingDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <span className={`text-sm leading-snug ${marketingFeatureText(isLandingDark, true)}`}>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">{paidCtaForAmount(TIER_PRO_CENTS, 'pro')}</div>
            </section>

            {/* Max */}
            <section
              className={`${theme.tierCard} ${selectedTier === 'max' ? 'ring-2 ring-zinc-900/15 dark:ring-white/15' : ''}`}
            >
              <div>
                <h2 className={`text-lg font-semibold ${theme.heading}`}>Max</h2>
                <p className={`text-xs ${theme.muted}`}>94 × $1 budget units / mo</p>
              </div>
              <div className="mt-6">
                <div className="flex flex-wrap items-end gap-1.5">
                  <span className={`text-4xl font-serif ${theme.title}`}>$94</span>
                  <span className={`pb-1 text-sm ${theme.muted}`}>/ month</span>
                </div>
                <p className={`mt-2 text-xs leading-relaxed ${theme.muted}`}>
                  {formatBytes(getStorageLimitBytes({ planKind: 'paid', planAmountCents: TIER_MAX_CENTS }))} storage
                </p>
              </div>
              <ul className="mt-4 flex flex-1 flex-col gap-2">
                <li className={`text-xs font-medium ${theme.muted}`}>Everything in Free, plus:</li>
                {PAID_FEATURE_BULLETS_COMPACT.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isLandingDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <span className={`text-sm leading-snug ${marketingFeatureText(isLandingDark, true)}`}>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">{paidCtaForAmount(TIER_MAX_CENTS, 'max')}</div>
            </section>

            {/* Choose your own */}
            <section
              className={`${theme.tierCard} relative overflow-hidden ${selectedTier === 'custom' ? 'ring-2 ring-zinc-900/15 dark:ring-white/15' : ''}`}
            >
              <div className={`pointer-events-none absolute inset-0 ${theme.heroGlow}`} />
              <div className="relative flex items-center gap-3">
                <div className={theme.iconChip}>
                  <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <h2 className={`text-lg font-semibold ${theme.heading}`}>Choose my own</h2>
                  <p className={`text-xs ${theme.muted}`}>Pick any monthly budget ($8–$200)</p>
                </div>
              </div>
              <div className="relative mt-5">
                <div className="flex flex-wrap items-end gap-1.5">
                  <span className={`text-4xl font-serif ${theme.title}`}>{formatDollarAmount(selectedPlanAmountCents)}</span>
                  <span className={`pb-1 text-sm ${theme.muted}`}>/ month</span>
                </div>
                <p className={`mt-2 text-xs ${theme.muted}`}>
                  {formatBytes(selectedStorageBytes)} storage · {Math.round(selectedPlanAmountCents / 100)} × $1 units
                </p>
              </div>

              <div className={`relative mt-4 ${theme.subtleCard}`}>
                <div className="flex items-center justify-between text-xs">
                  <span className={theme.muted}>Monthly budget</span>
                  <span className={`font-medium ${theme.heading}`}>{formatDollarAmount(selectedPlanAmountCents)}</span>
                </div>
                <input
                  type="range"
                  min={PAID_PLAN_MIN_AMOUNT_CENTS / 100}
                  max={PAID_PLAN_MAX_AMOUNT_CENTS / 100}
                  step={PAID_PLAN_STEP_AMOUNT_CENTS / 100}
                  value={selectedPlanDollars}
                  onChange={(event) => {
                    const next = Math.round(Number(event.target.value) * 100)
                    selectTier('custom', next)
                  }}
                  onPointerDown={() => {
                    if (selectedTier !== 'custom') selectTier('custom', selectedPlanAmountCents)
                  }}
                  className={theme.sliderTrack}
                />
                <div className={`mt-1 flex justify-between text-[11px] ${theme.muted}`}>
                  <span>$8</span>
                  <span>$200</span>
                </div>
              </div>

              <ul className="relative mt-4 flex flex-1 flex-col gap-2">
                <li className={`text-xs font-medium ${theme.muted}`}>Everything in Free, plus:</li>
                {PAID_FEATURE_BULLETS.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isLandingDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <span className={`text-sm leading-snug ${marketingFeatureText(isLandingDark, true)}`}>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="relative mt-6">{paidCtaForAmount(selectedPlanAmountCents, 'custom')}</div>
            </section>
          </div>

          {/* Billing preferences: fixed $8 top-up, optional auto top-up */}
          <section className={theme.panel}>
            <h2 className={`text-sm font-medium ${theme.heading}`}>Top-ups</h2>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${theme.body}`}>
              One-time and automatic top-ups use <span className="font-medium">$8</span> per recharge unless you change this in{' '}
              <Link href="/account" className={`font-medium underline underline-offset-4 ${theme.heading}`}>
                Account
              </Link>
              . Automatic top-ups are off until you opt in—they never apply unless you enable them below (paid accounts only).
            </p>
            <label
              className={`mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${isLandingDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-zinc-200 bg-zinc-50/90'}`}
            >
              <input
                type="checkbox"
                checked={autoTopUpEnabled}
                onChange={(event) => setAutoTopUpEnabled(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
              />
              <div>
                <p className={`text-sm font-medium ${theme.heading}`}>Enable automatic top-ups</p>
                <p className={`mt-1 text-xs leading-relaxed ${theme.muted}`}>
                  When enabled, we add $8 when your cumulative budget reaches zero. Leave unchecked to never auto-charge—you can
                  still add budget manually.
                </p>
              </div>
            </label>
            {currentPlanKind === 'paid' ? (
              <button
                type="button"
                onClick={() => void handleSaveTopUpPreference()}
                disabled={loading === 'topup-settings' || subscriptionLoading}
                className={`mt-4 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${theme.secondaryButton}`}
              >
                {loading === 'topup-settings' ? 'Saving…' : 'Save top-up preference'}
              </button>
            ) : null}
          </section>

          <section className={theme.panel}>
            <h2 className={`text-sm font-medium ${theme.heading}`}>How billing works</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                {
                  Icon: Wallet,
                  label: 'Monthly budget',
                  hint: 'Your subscription sets how much usage budget you get each cycle.',
                },
                {
                  Icon: GaugeCircle,
                  label: 'Usage draws it down',
                  hint: 'Premium features consume budget with a small markup.',
                },
                {
                  Icon: PlusCircle,
                  label: 'Top up if needed',
                  hint: 'Add $8 (or more from Account) when you need extra headroom.',
                },
              ].map(({ Icon, label, hint }) => (
                <div key={label} className={`flex gap-3 ${theme.subtleCard}`}>
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
              Manage payment method and invoices in{' '}
              <Link href="/account" className={`font-medium underline underline-offset-4 ${theme.heading}`}>
                Account
              </Link>
              .
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
