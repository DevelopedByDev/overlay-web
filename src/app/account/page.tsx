'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { RefreshCw, ArrowRight, Check, AlertCircle } from 'lucide-react'

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

function ProgressBar({
  used,
  total,
  label,
  showAsPercentage = false
}: {
  used: number
  total: number
  label: string
  showAsPercentage?: boolean
}) {
  const remaining = Math.max(0, total - used)
  const percentage = total > 0 ? (remaining / total) * 100 : 0
  const isLow = percentage <= 20
  const isEmpty = percentage <= 0

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">{label}</span>
        <span className={isEmpty ? 'text-red-500' : isLow ? 'text-amber-500' : ''}>
          {showAsPercentage
            ? `${Math.round(percentage)}% remaining`
            : `$${remaining.toFixed(2)} / $${total}`}
        </span>
      </div>
      <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-zinc-800'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

const MIN_ADDON_AMOUNT = 10
const MAX_ADDON_AMOUNT = 100

function AccountPageContent() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [addonAmount, setAddonAmount] = useState<string>('20')
  const [autoRenew, setAutoRenew] = useState<boolean>(false)

  // Extract userId from URL params and store in localStorage
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  useEffect(() => {
    const urlUserId = searchParams.get('userId')
    if (urlUserId) {
      localStorage.setItem('userId', urlUserId)
      setCurrentUserId(urlUserId)
      console.log('[Account] Stored userId from URL:', urlUserId)
    } else {
      // Try to get from localStorage
      const storedUserId = localStorage.getItem('userId')
      setCurrentUserId(storedUserId)
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

  // Fetch entitlements when userId is available
  useEffect(() => {
    if (currentUserId === null) return // Wait for userId to be determined

    async function fetchEntitlements() {
      try {
        const userId = currentUserId || 'demo-user'
        console.log('[Account] Fetching entitlements for userId:', userId)

        const response = await fetch(`/api/entitlements?userId=${userId}`)
        if (response.ok) {
          const data = await response.json()
          console.log('[Account] Received entitlements:', data)
          setEntitlements(data)
        }
      } catch (error) {
        console.error('Failed to fetch entitlements:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEntitlements()
  }, [currentUserId])

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
    const amount = parseFloat(addonAmount)
    if (amount < MIN_ADDON_AMOUNT || amount > MAX_ADDON_AMOUNT) {
      setMessage({ type: 'error', text: `Amount must be between $${MIN_ADDON_AMOUNT} and $${MAX_ADDON_AMOUNT}` })
      return
    }

    setActionLoading('refill')
    try {
      const userId = localStorage.getItem('userId') || 'demo-user'
      const email = '' // User's email if available

      const response = await fetch('/api/checkout/addon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email, amount, autoRenew })
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start checkout' })
      }
    } catch (error) {
      console.error('Addon checkout error:', error)
      setMessage({ type: 'error', text: 'Failed to start checkout' })
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

              {/* Usage Card (Pro/Max only) */}
              {data.tier !== 'free' && (
                <div className="glass-dark rounded-2xl p-6">
                  <h2 className="text-lg font-medium mb-4">Usage This Period</h2>

                  <ProgressBar
                    used={data.usage.tokenCostAccrued}
                    total={data.limits.tokenBudget}
                    label="Subscription"
                    showAsPercentage={true}
                  />

                  {/* Add-on Credits Usage Bar */}
                  {data.refillCredits > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-zinc-500">Add-on</span>
                        <span>${data.refillCredits.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                        <div className="h-full w-full bg-emerald-500 rounded-full" />
                      </div>
                    </div>
                  )}

                  {/* Purchase Add-on Credits */}
                  <div className="mt-6 pt-4 border-t border-zinc-200">
                    <p className="text-xs text-zinc-500 mb-3">Purchase add-on credits</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Amount Input */}
                      <div className="flex items-center bg-white border border-zinc-200 rounded-lg px-3 w-24">
                        <span className="text-zinc-400 text-sm">$</span>
                        <input
                          type="number"
                          min={MIN_ADDON_AMOUNT}
                          max={MAX_ADDON_AMOUNT}
                          step="5"
                          value={addonAmount}
                          onChange={(e) => setAddonAmount(e.target.value)}
                          className="flex-1 py-2 px-1 bg-transparent border-none outline-none text-sm w-full"
                        />
                      </div>

                      {/* Auto-Renew Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-500">
                        <div
                          onClick={() => setAutoRenew(!autoRenew)}
                          className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${
                            autoRenew ? 'bg-zinc-800' : 'bg-zinc-200'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow ${
                              autoRenew ? 'left-4' : 'left-0.5'
                            }`}
                          />
                        </div>
                        Auto-refill
                      </label>

                      {/* Purchase Button */}
                      <button
                        onClick={handlePurchaseRefill}
                        disabled={
                          actionLoading === 'refill' ||
                          parseFloat(addonAmount) < MIN_ADDON_AMOUNT ||
                          parseFloat(addonAmount) > MAX_ADDON_AMOUNT
                        }
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading === 'refill' ? 'Processing...' : 'Purchase'}
                      </button>

                      {/* Manage Billing Button */}
                      <button
                        onClick={handleManageBilling}
                        disabled={actionLoading === 'billing'}
                        className="px-4 py-2 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                      >
                        {actionLoading === 'billing' ? 'Opening...' : 'Manage Subscription'}
                      </button>
                    </div>

                    {addonAmount &&
                      (parseFloat(addonAmount) < MIN_ADDON_AMOUNT ||
                        parseFloat(addonAmount) > MAX_ADDON_AMOUNT) && (
                        <p className="text-xs text-red-500 mt-2">$10 - $100</p>
                      )}
                  </div>
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
