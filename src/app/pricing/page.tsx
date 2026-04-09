'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X, Zap, Crown, Sparkles } from 'lucide-react'
import { PageNavbar } from '@/components/PageNavbar'
import { LandingThemeProvider, useLandingTheme } from '@/contexts/LandingThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { marketingFeatureText, marketingMuted, marketingPageTitle } from '@/lib/landingPageStyles'

interface Feature {
  name: string
  included: boolean
  detail?: string
}

interface Tier {
  name: string
  price: string
  period: string
  description: string
  icon: typeof Zap
  features: Feature[]
  cta: string
  ctaLink?: string
  ctaAction?: string
  highlighted: boolean
}

const tiers: Tier[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Start with the core web app experience',
    icon: Zap,
    features: [
      { name: 'Unlimited auto messages', included: true },
      { name: 'Notes, chats, and browser workspace', included: true },
      { name: 'Basic AI tools', included: true },
      { name: 'Standard model access', included: true },
      { name: 'Premium AI models', included: false },
      { name: 'Search, image generation, and video generation', included: false },
      { name: 'Advanced agents and premium workflows', included: false }
    ],
    cta: 'Start Free',
    ctaLink: '/auth/sign-in?redirect=%2Fapp%2Fchat',
    highlighted: false
  },
  {
    name: 'Pro',
    price: '$20',
    period: '/month',
    description: 'For people who want the full web app toolkit',
    icon: Crown,
    features: [
      { name: 'Everything in Free', included: true },
      { name: 'Search', included: true },
      { name: 'Image generation', included: true },
      { name: 'Video generation', included: true },
      { name: 'More powerful agents', included: true },
      { name: 'Premium AI models', included: true, detail: '$10 token budget/mo' },
      { name: 'Prompt caching (save up to 90%)', included: true },
      { name: 'Priority access to new tools', included: true },
      { name: 'Cloud sync', included: false },
      { name: 'Priority support', included: false }
    ],
    cta: 'Subscribe to Pro',
    ctaAction: 'pro',
    highlighted: true
  },
  {
    name: 'Max',
    price: '$100',
    period: '/month',
    description: 'Everything in Pro, plus more capacity and access',
    icon: Sparkles,
    features: [
      { name: 'Everything in Pro', included: true },
      { name: 'Premium AI models', included: true, detail: '$90 token budget/mo' },
      { name: 'Higher limits across advanced tools', included: true },
      { name: 'More agent capacity and premium workflows', included: true },
      { name: 'Cloud sync (coming soon)', included: true },
      { name: 'Priority support', included: true },
      { name: 'Early access to features', included: true },
      { name: 'Direct feedback channel', included: true }
    ],
    cta: 'Subscribe to Max',
    ctaAction: 'max',
    highlighted: false
  }
]

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
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentTier, setCurrentTier] = useState<'free' | 'pro' | 'max'>('free')
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)

  // Fetch user's current subscription
  const fetchSubscription = useCallback(async () => {
    if (!user?.id) return
    
    setSubscriptionLoading(true)
    try {
      const response = await fetch(`/api/subscription?userId=${encodeURIComponent(user.id)}`)
      if (response.ok) {
        const data = await response.json()
        if (data.tier) {
          setCurrentTier(data.tier)
        }
      }
    } catch (err) {
      console.error('[Pricing] Failed to fetch subscription:', err)
    } finally {
      setSubscriptionLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchSubscription()
    }
  }, [isAuthenticated, user?.id, fetchSubscription])

  const handleSubscribe = async (tier: string) => {
    // Require authentication before checkout
    if (!isAuthenticated || !user) {
      // Redirect to sign-in with return URL
      router.push(`/auth/sign-in?redirect=${encodeURIComponent('/pricing')}`)
      return
    }

    setLoading(tier)
    setError(null)
    
    try {
      // Use session-based checkout (API will validate session)
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          // Session expired, redirect to sign-in
          router.push(`/auth/sign-in?redirect=${encodeURIComponent('/pricing')}`)
          return
        }
        setError(data.error || 'Failed to start checkout')
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        setError('No checkout URL returned. Please try again.')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setError('Failed to start checkout. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const heroMuted = marketingMuted(isLandingDark)
  const heroTitle = marketingPageTitle(isLandingDark)
  const cardBase = (highlighted: boolean) =>
    highlighted
      ? isLandingDark
        ? 'relative scale-105 rounded-2xl border-2 border-zinc-100 bg-zinc-900/95 p-8 shadow-xl transition-all duration-300'
        : 'relative scale-105 rounded-2xl border-2 border-zinc-900 bg-white p-8 shadow-xl transition-all duration-300'
      : isLandingDark
        ? 'relative rounded-2xl border border-zinc-700 bg-zinc-900/95 p-8 shadow-lg transition-all duration-300 hover:shadow-xl'
        : 'relative rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-md'
  const tierIconWrap = (highlighted: boolean) =>
    highlighted
      ? isLandingDark
        ? 'rounded-lg bg-zinc-100 p-2 text-zinc-900'
        : 'rounded-lg bg-zinc-900 p-2 text-white'
      : isLandingDark
        ? 'rounded-lg bg-zinc-800 p-2 text-zinc-200'
        : 'rounded-lg bg-zinc-100 p-2 text-zinc-700'
  const tierName = heroTitle
  const tokenSection = isLandingDark
    ? 'mx-auto mt-16 max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-900/95 p-8 shadow-lg'
    : 'mx-auto mt-16 max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm'
  const faqCard = isLandingDark
    ? 'rounded-xl border border-zinc-700 bg-zinc-900/95 p-6'
    : 'rounded-xl border border-zinc-200 bg-white p-6 shadow-sm'
  const footBorder = isLandingDark ? 'border-zinc-800' : 'border-zinc-200'
  const footMuted = marketingMuted(isLandingDark)
  const btnPrimary = isLandingDark
    ? 'bg-zinc-100 text-zinc-900 hover:opacity-90'
    : 'bg-zinc-900 text-white hover:opacity-90'
  const btnSecondary = isLandingDark
    ? 'border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
    : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
  const btnGhost = isLandingDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-500'

  return (
    <div className="flex min-h-screen w-full flex-col gradient-bg">
      <Suspense fallback={null}>
        <UserIdExtractor />
      </Suspense>
      <div className="liquid-glass" />

      <PageNavbar />

      <main className="relative z-10 flex-1 px-8 py-16">
        <div className="max-w-7xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-16">
            <h1 className={`text-4xl md:text-5xl font-serif mb-4 ${heroTitle}`}>
              Simple, transparent pricing
            </h1>
            <p className={`text-lg max-w-2xl mx-auto ${heroMuted}`}>
              Start free, upgrade when you need more, and unlock the tools that match how you work on the web.
            </p>
            
            {/* Auth status banner */}
            {!authLoading && !isAuthenticated && (
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-800 rounded-lg text-sm">
                <span>Sign in to subscribe to a paid plan</span>
                <Link href="/auth/sign-in?redirect=/pricing" className="font-medium underline">
                  Sign in →
                </Link>
              </div>
            )}
            
            {/* Error message */}
            {error && (
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-800 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {tiers.map((tier) => {
              const Icon = tier.icon
              return (
                <div key={tier.name} className={cardBase(tier.highlighted)}>
                  {tier.highlighted && (
                    <div
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium ${
                        isLandingDark ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 text-white'
                      }`}
                    >
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className={tierIconWrap(tier.highlighted)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h2 className={`text-xl font-medium ${tierName}`}>{tier.name}</h2>
                  </div>

                  <div className="mb-4">
                    <span className={`text-4xl font-serif ${heroTitle}`}>{tier.price}</span>
                    <span className={heroMuted}>{tier.period}</span>
                  </div>

                  <p className={`mb-6 text-sm ${heroMuted}`}>{tier.description}</p>

                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        {feature.included ? (
                          <Check
                            className={`mt-0.5 h-4 w-4 shrink-0 ${isLandingDark ? 'text-emerald-400' : 'text-emerald-600'}`}
                          />
                        ) : (
                          <X className={`mt-0.5 h-4 w-4 shrink-0 ${isLandingDark ? 'text-zinc-600' : 'text-zinc-400'}`} />
                        )}
                        <span className={`text-sm ${marketingFeatureText(isLandingDark, feature.included)}`}>
                          {feature.name}
                          {feature.detail && (
                            <span className={`ml-1 ${heroMuted}`}>({feature.detail})</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {(() => {
                    const tierAction = tier.ctaAction?.toLowerCase()
                    const isCurrentTier = tierAction === currentTier
                    const isDowngrade = (currentTier === 'max' && tierAction === 'pro') || 
                                        (currentTier !== 'free' && tier.name === 'Free')
                    const canUpgrade = tierAction && !isCurrentTier && !isDowngrade
                    
                    if (isCurrentTier && isAuthenticated) {
                      return (
                        <div
                          className={`w-full rounded-lg border px-4 py-3 text-center text-sm font-medium ${
                            isLandingDark
                              ? 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200'
                              : 'border-emerald-300 bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Current Plan ✓
                        </div>
                      )
                    }
                    
                    if (isDowngrade && isAuthenticated) {
                      return (
                        <button
                          type="button"
                          disabled
                          className={`block w-full cursor-not-allowed rounded-lg px-4 py-3 text-center text-sm font-medium opacity-60 ${btnGhost}`}
                        >
                          Contact support to downgrade
                        </button>
                      )
                    }

                    if (tier.ctaLink) {
                      return (
                        <a
                          href={tier.ctaLink}
                          className={`block w-full rounded-lg px-4 py-3 text-center text-sm font-medium transition-all ${
                            tier.highlighted ? btnPrimary : btnSecondary
                          }`}
                        >
                          {tier.cta}
                        </a>
                      )
                    }
                    
                    return (
                      <button
                        type="button"
                        onClick={() => handleSubscribe(tier.ctaAction!)}
                        disabled={loading === tier.ctaAction || subscriptionLoading}
                        className={`block w-full rounded-lg px-4 py-3 text-center text-sm font-medium transition-all disabled:opacity-50 ${
                          tier.highlighted ? btnPrimary : btnSecondary
                        }`}
                      >
                        {loading === tier.ctaAction ? 'Loading...' : 
                         (canUpgrade && currentTier !== 'free' ? `Upgrade to ${tier.name}` : tier.cta)}
                      </button>
                    )
                  })()}
                </div>
              )
            })}
          </div>

          {/* Token Budget Explanation */}
          <div className="mt-16 max-w-3xl mx-auto">
            <div className={tokenSection}>
              <h3 className={`text-xl font-serif mb-4 ${heroTitle}`}>How token budgets work</h3>
              <div className={`space-y-4 text-sm ${heroMuted}`}>
                <p>
                  Premium AI models (Claude, GPT-5, Gemini Pro, etc.) are billed by tokens used.
                  Your monthly token budget lets you use these models flexibly.
                </p>
                <p>
                  <strong className={heroTitle}>Prompt caching</strong> can reduce costs by up to 90% for repeated context.
                  We automatically enable caching for all supported models.
                </p>
                <p>
                  <strong className={heroTitle}>Example:</strong> $10 budget ≈ 3.3M input tokens on Claude Sonnet,
                  or 66M tokens on GPT-OSS-20b with caching.
                </p>
                <p>
                  Token budgets reset at the start of each billing period.
                </p>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mt-16 max-w-3xl mx-auto">
            <h3 className={`text-2xl font-serif text-center mb-8 ${heroTitle}`}>Frequently Asked Questions</h3>
            <div className="space-y-4">
              {[
                {
                  q: 'Can I cancel anytime?',
                  a: 'Yes! Cancel your subscription at any time. You\'ll keep access until the end of your billing period.'
                },
                {
                  q: 'What happens to unused tokens?',
                  a: 'Token budgets reset at the start of each billing period.'
                },
                {
                  q: 'Which models are included in Free?',
                  a: 'Free includes standard model access for everyday use. Upgrade for premium model access and more advanced tools.'
                },
                {
                  q: 'Do I need to enter payment info for Free?',
                  a: 'No. Create an account and start using the web app. Upgrade when you\'re ready.'
                }
              ].map((faq, idx) => (
                <div key={idx} className={faqCard}>
                  <h4 className={`font-medium mb-2 ${tierName}`}>{faq.q}</h4>
                  <p className={`text-sm ${heroMuted}`}>{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className={`relative z-10 mt-auto border-t py-8 px-8 ${footBorder}`}>
        <div className={`max-w-7xl mx-auto flex items-center justify-between text-sm ${footMuted}`}>
          <p>© 2026 overlay</p>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className={isLandingDark ? 'transition-colors hover:text-zinc-100' : 'transition-colors hover:text-zinc-900'}
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className={isLandingDark ? 'transition-colors hover:text-zinc-100' : 'transition-colors hover:text-zinc-900'}
            >
              Privacy
            </Link>
          </div>
        </div>
      </footer>
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
