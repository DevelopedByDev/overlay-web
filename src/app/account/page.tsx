'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CreditCard, RefreshCw, Settings, ArrowRight, Check, AlertCircle } from 'lucide-react'

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  autoRefillEnabled: boolean
  limits: {
    askPerDay: number
    agentPerDay: number
    writePerDay: number
    tokenBudget: number
    transcriptionSecondsPerWeek: number
  }
  usage: {
    ask: number
    agent: number
    write: number
    tokenCostAccrued: number
    transcriptionSeconds: number
  }
  remaining: {
    ask: number
    agent: number
    write: number
    tokenBudget: number
    transcriptionSeconds: number
  }
  refillCredits: number
  billingPeriodEnd?: number
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const isLow = percentage >= 80
  const isEmpty = percentage >= 100

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--muted)]">{label}</span>
        <span className={isEmpty ? 'text-red-500' : isLow ? 'text-amber-500' : ''}>
          {max === Infinity ? '∞' : `${value.toFixed(2)} / $${max}`}
        </span>
      </div>
      <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function AccountPageContent() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Extract userId from URL params and store in localStorage
  useEffect(() => {
    const userId = searchParams.get('userId')
    if (userId) {
      localStorage.setItem('userId', userId)
      console.log('[Account] Stored userId from URL:', userId)
    }
  }, [searchParams])

  // Check for success/error params and auto-trigger deep link
  useEffect(() => {
    if (searchParams.get('success')) {
      setMessage({ type: 'success', text: 'Subscription activated successfully!' })
      // If open_app param is set, attempt to open the desktop app
      if (searchParams.get('open_app') === 'true') {
        // Small delay to ensure the page is loaded before redirecting
        setTimeout(() => {
          window.location.href = 'overlay://subscription-updated'
        }, 1500)
      }
    } else if (searchParams.get('refill') === 'success') {
      setMessage({ type: 'success', text: 'Refill credits added to your account!' })
    } else if (searchParams.get('canceled')) {
      setMessage({ type: 'error', text: 'Checkout was canceled.' })
    }
  }, [searchParams])

  // Handler for manual "Open in App" button
  const handleOpenInApp = () => {
    window.location.href = 'overlay://subscription-updated'
  }

  // Fetch entitlements
  useEffect(() => {
    async function fetchEntitlements() {
      try {
        // Get userId from localStorage (set from URL param or previous session)
        const userId = localStorage.getItem('userId') || 'demo-user'

        const response = await fetch(`/api/entitlements?userId=${userId}`)
        if (response.ok) {
          const data = await response.json()
          setEntitlements(data)
        }
      } catch (error) {
        console.error('Failed to fetch entitlements:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEntitlements()
  }, [])

  const handleManageBilling = async () => {
    setActionLoading('billing')
    try {
      const sessionId = searchParams.get('session_id')
      const userId = localStorage.getItem('userId') || 'demo-user'

      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionId })
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to open billing portal' })
      }
    } catch (error) {
      console.error('Portal error:', error)
      setMessage({ type: 'error', text: 'Failed to open billing portal' })
    } finally {
      setActionLoading(null)
    }
  }

  const handlePurchaseRefill = async () => {
    setActionLoading('refill')
    try {
      const userId = localStorage.getItem('userId') || 'demo-user'

      const response = await fetch('/api/checkout/refill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start refill checkout' })
      }
    } catch (error) {
      console.error('Refill error:', error)
      setMessage({ type: 'error', text: 'Failed to start refill checkout' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleAutoRefill = async () => {
    if (!entitlements) return

    setActionLoading('autorefill')
    try {
      const userId = localStorage.getItem('userId') || 'demo-user'
      const enabled = !entitlements.autoRefillEnabled

      const response = await fetch('/api/auto-refill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, enabled })
      })

      if (response.ok) {
        setEntitlements({ ...entitlements, autoRefillEnabled: enabled })
        setMessage({
          type: 'success',
          text: enabled ? 'Auto-refill enabled' : 'Auto-refill disabled'
        })
      }
    } catch (error) {
      console.error('Auto-refill toggle error:', error)
      setMessage({ type: 'error', text: 'Failed to update auto-refill setting' })
    } finally {
      setActionLoading(null)
    }
  }

  // Demo data for when not connected
  const demoEntitlements: Entitlements = {
    tier: 'pro',
    status: 'active',
    autoRefillEnabled: false,
    limits: {
      askPerDay: Infinity,
      agentPerDay: Infinity,
      writePerDay: Infinity,
      tokenBudget: 10,
      transcriptionSecondsPerWeek: Infinity
    },
    usage: {
      ask: 12,
      agent: 5,
      write: 8,
      tokenCostAccrued: 3.45,
      transcriptionSeconds: 0
    },
    remaining: {
      ask: Infinity,
      agent: Infinity,
      write: Infinity,
      tokenBudget: 6.55,
      transcriptionSeconds: Infinity
    },
    refillCredits: 0,
    billingPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  }

  const data = entitlements || demoEntitlements

  return (
    <div className="min-h-screen gradient-bg">
      <div className="liquid-glass" />

      {/* Header */}
      <header className="relative z-10 py-6 px-8">
        <nav className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-serif">
            overlay
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/pricing"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Pricing
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Message Banner */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.type === 'success' ? (
                <Check className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <p className="text-sm">{message.text}</p>
              <div className="ml-auto flex items-center gap-3">
                {message.type === 'success' && (
                  <button
                    onClick={handleOpenInApp}
                    className="text-sm font-medium bg-emerald-600 text-white px-3 py-1 rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Open in App
                  </button>
                )}
                <button
                  onClick={() => setMessage(null)}
                  className="text-sm opacity-60 hover:opacity-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <h1 className="text-3xl font-serif mb-8">Account</h1>

          {loading ? (
            <div className="text-center py-16">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[var(--muted)]" />
              <p className="mt-4 text-[var(--muted)]">Loading your account...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Subscription Card */}
              <div className="glass-dark rounded-2xl p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-medium mb-1">
                      {data.tier.charAt(0).toUpperCase() + data.tier.slice(1)} Plan
                    </h2>
                    <p className="text-sm text-[var(--muted)]">
                      {data.status === 'active' && data.billingPeriodEnd
                        ? `Renews ${formatDate(data.billingPeriodEnd)}`
                        : data.status === 'canceled'
                          ? 'Subscription canceled'
                          : data.status === 'past_due'
                            ? 'Payment past due'
                            : 'Active'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        data.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : data.status === 'past_due'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-zinc-100 text-zinc-800'
                      }`}
                    >
                      {data.status}
                    </span>
                  </div>
                </div>

                {data.tier !== 'free' && (
                  <button
                    onClick={handleManageBilling}
                    disabled={actionLoading === 'billing'}
                    className="flex items-center gap-2 text-sm text-[var(--foreground)] hover:opacity-70 transition-opacity disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    {actionLoading === 'billing' ? 'Opening...' : 'Manage billing'}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}

                {data.tier === 'free' && (
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Upgrade to Pro
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>

              {/* Token Usage Card (Pro/Max only) */}
              {data.tier !== 'free' && (
                <div className="glass-dark rounded-2xl p-6">
                  <h2 className="text-lg font-medium mb-4">Token Usage</h2>

                  <ProgressBar
                    value={data.usage.tokenCostAccrued}
                    max={data.limits.tokenBudget}
                    label="Premium model usage"
                  />

                  {data.refillCredits > 0 && (
                    <p className="mt-3 text-sm text-emerald-600">
                      + ${data.refillCredits.toFixed(2)} refill credits available
                    </p>
                  )}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={handlePurchaseRefill}
                      disabled={actionLoading === 'refill'}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--border)] hover:bg-[var(--muted-light)] hover:text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${actionLoading === 'refill' ? 'animate-spin' : ''}`}
                      />
                      {actionLoading === 'refill'
                        ? 'Loading...'
                        : `Purchase refill (+$${data.tier === 'pro' ? 5 : 50} for $${data.tier === 'pro' ? 11 : 55})`}
                    </button>

                    <button
                      onClick={handleToggleAutoRefill}
                      disabled={actionLoading === 'autorefill'}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                        data.autoRefillEnabled
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-[var(--border)] hover:bg-[var(--muted-light)] hover:text-white'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      {data.autoRefillEnabled ? 'Auto-refill ON' : 'Enable auto-refill'}
                    </button>
                  </div>

                  <p className="mt-4 text-xs text-[var(--muted)]">
                    Auto-refill automatically purchases more credits when your balance drops below
                    10%.
                  </p>
                </div>
              )}

              {/* Daily Usage (Free tier) */}
              {data.tier === 'free' && (
                <div className="glass-dark rounded-2xl p-6">
                  <h2 className="text-lg font-medium mb-4">Daily Usage</h2>

                  <div className="grid gap-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Ask messages</span>
                      <span className="text-sm font-medium">
                        {data.usage.ask} / {data.limits.askPerDay} used
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Agent messages</span>
                      <span className="text-sm font-medium">
                        {data.usage.agent} / {data.limits.agentPerDay} used
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Write messages</span>
                      <span className="text-sm font-medium">
                        {data.usage.write} / {data.limits.writePerDay} used
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Transcription</span>
                      <span className="text-sm font-medium">
                        {Math.floor(data.usage.transcriptionSeconds / 60)}m /{' '}
                        {Math.floor(data.limits.transcriptionSecondsPerWeek / 60)}m this week
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-[var(--muted)]">
                    Usage resets daily at midnight UTC. Upgrade for unlimited usage.
                  </p>
                </div>
              )}

              {/* Quick Links */}
              <div className="glass-dark rounded-2xl p-6">
                <h2 className="text-lg font-medium mb-4">Quick Links</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Link
                    href="/#download"
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--border)] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[var(--border)] flex items-center justify-center">
                      📥
                    </div>
                    <div>
                      <p className="text-sm font-medium">Download App</p>
                      <p className="text-xs text-[var(--muted)]">Get the latest version</p>
                    </div>
                  </Link>

                  <Link
                    href="/pricing"
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--border)] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[var(--border)] flex items-center justify-center">
                      💎
                    </div>
                    <div>
                      <p className="text-sm font-medium">View Plans</p>
                      <p className="text-xs text-[var(--muted)]">Compare all tiers</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-8 border-t border-[var(--border)] mt-16">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-[var(--muted)]">
          <p>© 2026 overlay</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen gradient-bg flex items-center justify-center">
          <div className="liquid-glass" />
          <div className="relative z-10 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[var(--muted)]" />
            <p className="mt-4 text-[var(--muted)]">Loading...</p>
          </div>
        </div>
      }
    >
      <AccountPageContent />
    </Suspense>
  )
}
