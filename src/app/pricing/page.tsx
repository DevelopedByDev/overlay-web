'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check, X, Zap, Crown, Sparkles } from 'lucide-react'

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
    description: 'Get started with essential features',
    icon: Zap,
    features: [
      { name: 'Unlimited notes (non-AI)', included: true },
      { name: 'Unlimited browser (non-AI)', included: true },
      { name: '10 min cloud transcription/week', included: true },
      { name: '5 Ask messages/day', included: true },
      { name: '5 Agent messages/day', included: true },
      { name: '5 Write messages/day', included: true },
      { name: 'Trinity Large + Auto models only', included: true },
      { name: 'Premium AI models', included: false },
      { name: 'Cloud sync', included: false },
      { name: 'Priority support', included: false }
    ],
    cta: 'Download Free',
    ctaLink: '/#download',
    highlighted: false
  },
  {
    name: 'Pro',
    price: '$20',
    period: '/month',
    description: 'For power users who need more',
    icon: Crown,
    features: [
      { name: 'Everything in Free', included: true },
      { name: 'Unlimited transcription', included: true },
      { name: 'Unlimited Trinity/Auto usage', included: true },
      { name: 'Premium AI models', included: true, detail: '$10 token budget/mo' },
      { name: 'Prompt caching (save up to 90%)', included: true },
      { name: 'Refill option (+$5 for $11)', included: true },
      { name: 'Auto-refill available', included: true },
      { name: 'Cloud jobs (coming soon)', included: true },
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
    description: 'For teams and heavy users',
    icon: Sparkles,
    features: [
      { name: 'Everything in Pro', included: true },
      { name: 'Premium AI models', included: true, detail: '$100 token budget/mo' },
      { name: 'Refill option (+$50 for $55)', included: true },
      { name: '10x cloud jobs', included: true },
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

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const searchParams = useSearchParams()

  // Extract userId from URL params and store in localStorage
  useEffect(() => {
    const userId = searchParams.get('userId')
    if (userId) {
      localStorage.setItem('userId', userId)
      console.log('[Pricing] Stored userId from URL:', userId)
    }
  }, [searchParams])

  const handleSubscribe = async (tier: string) => {
    setLoading(tier)
    try {
      // Get userId from localStorage (set from URL param or previous session)
      const userId = localStorage.getItem('userId')
      
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, userId })
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        console.error('No checkout URL returned')
        alert('Failed to start checkout. Please try again.')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to start checkout. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen gradient-bg">
      <div className="liquid-glass" />

      {/* Header */}
      <header className="relative z-10 py-6 px-8">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-serif">
            overlay
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              Home
            </Link>
            <Link href="/account" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              Account
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-8 py-16">
        <div className="max-w-7xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-serif mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto">
              Start free, upgrade when you need more. All plans include the core overlay experience.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {tiers.map((tier) => {
              const Icon = tier.icon
              return (
                <div
                  key={tier.name}
                  className={`relative rounded-2xl p-8 transition-all duration-300 ${
                    tier.highlighted
                      ? 'glass border-2 border-[var(--foreground)] scale-105 shadow-xl'
                      : 'glass-dark hover:shadow-lg'
                  }`}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--foreground)] text-[var(--background)] text-xs font-medium px-3 py-1 rounded-full">
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${tier.highlighted ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-[var(--border)]'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-medium">{tier.name}</h2>
                  </div>

                  <div className="mb-4">
                    <span className="text-4xl font-serif">{tier.price}</span>
                    <span className="text-[var(--muted)]">{tier.period}</span>
                  </div>

                  <p className="text-sm text-[var(--muted)] mb-6">{tier.description}</p>

                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        {feature.included ? (
                          <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-[var(--muted-light)] mt-0.5 flex-shrink-0" />
                        )}
                        <span className={`text-sm ${feature.included ? '' : 'text-[var(--muted-light)]'}`}>
                          {feature.name}
                          {feature.detail && (
                            <span className="text-(--muted) ml-1">({feature.detail})</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {tier.ctaLink ? (
                    <Link
                      href={tier.ctaLink}
                      className={`block w-full py-3 px-4 rounded-lg text-center text-sm font-medium transition-all ${
                        tier.highlighted
                          ? 'bg-[var(--foreground)] text-[var(--background)] hover:opacity-90'
                          : 'bg-[var(--border)] hover:bg-[var(--muted-light)] hover:text-white'
                      }`}
                    >
                      {tier.cta}
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(tier.ctaAction!)}
                      disabled={loading === tier.ctaAction}
                      className={`block w-full py-3 px-4 rounded-lg text-center text-sm font-medium transition-all disabled:opacity-50 ${
                        tier.highlighted
                          ? 'bg-[var(--foreground)] text-background hover:opacity-90'
                          : 'bg-[var(--border)] hover:bg-(--muted-light) hover:text-white'
                      }`}
                    >
                      {loading === tier.ctaAction ? 'Loading...' : tier.cta}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Token Budget Explanation */}
          <div className="mt-16 max-w-3xl mx-auto">
            <div className="glass-dark rounded-2xl p-8">
              <h3 className="text-xl font-serif mb-4">How token budgets work</h3>
              <div className="space-y-4 text-sm text-(--muted)">
                <p>
                  Premium AI models (Claude, GPT-5, Gemini Pro, etc.) are billed by tokens used.
                  Your monthly token budget lets you use these models flexibly.
                </p>
                <p>
                  <strong className="text-foreground">Prompt caching</strong> can reduce costs by up to 90% for repeated context.
                  We automatically enable caching for all supported models.
                </p>
                <p>
                  <strong className="text-foreground">Example:</strong> $10 budget ≈ 3.3M input tokens on Claude Sonnet,
                  or 66M tokens on GPT-OSS-20b with caching.
                </p>
                <p>
                  Running low? Purchase a refill anytime, or enable auto-refill to never run out.
                </p>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mt-16 max-w-3xl mx-auto">
            <h3 className="text-2xl font-serif text-center mb-8">Frequently Asked Questions</h3>
            <div className="space-y-4">
              {[
                {
                  q: 'Can I cancel anytime?',
                  a: 'Yes! Cancel your subscription at any time. You\'ll keep access until the end of your billing period.'
                },
                {
                  q: 'What happens to unused tokens?',
                  a: 'Token budgets reset at the start of each billing period. Refill credits do not expire during your subscription.'
                },
                {
                  q: 'Which models are included in Free?',
                  a: 'Free users get unlimited access to Trinity Large and Auto. These are capable models for many tasks.'
                },
                {
                  q: 'Do I need to enter payment info for Free?',
                  a: 'No. Just download the app and start using it. Upgrade when you\'re ready.'
                }
              ].map((faq, idx) => (
                <div key={idx} className="glass-dark rounded-xl p-6">
                  <h4 className="font-medium mb-2">{faq.q}</h4>
                  <p className="text-sm text-[var(--muted)]">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-8 border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-[var(--muted)]">
          <p>© 2026 overlay</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
