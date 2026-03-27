'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { RefreshCw, ArrowRight, Check, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PageNavbar } from '@/components/PageNavbar'

// Always use overlay:// for deep links (registered in WorkOS for both environments)
const APP_PROTOCOL = 'overlay'

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
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

function AccountPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams?.get('session_id') ?? null
  const successParam = searchParams?.get('success')
  const canceledParam = searchParams?.get('canceled')
  const desktopCodeChallenge = searchParams?.get('desktop_code_challenge')?.trim() || ''
  const [loading, setLoading] = useState(true)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  /** Set when /api/entitlements fails (e.g. Convex cannot verify WorkOS JWT) — avoids showing fake "free" defaults. */
  const [entitlementsError, setEntitlementsError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Get userId from AuthContext (session-based)
  const { user, isLoading: authLoading, isAuthenticated, signOut, refreshSession } = useAuth()
  const currentUserId = user?.id || null
  const [signingOut, setSigningOut] = useState(false)
  const [sessionCheckComplete, setSessionCheckComplete] = useState(false)

  // Refresh session on mount to ensure we have the latest session state
  // This fixes the race condition when redirecting from auth callback
  useEffect(() => {
    let mounted = true
    const checkSession = async () => {
      // If already authenticated or auth is still loading, skip refresh
      if (isAuthenticated || authLoading) {
        if (mounted) {
          setSessionCheckComplete(true)
        }
        return
      }
      // Give a small delay for cookies to be fully set after redirect
      await new Promise(resolve => setTimeout(resolve, 100))
      await refreshSession()
      if (mounted) {
        setSessionCheckComplete(true)
      }
    }
    checkSession()
    return () => { mounted = false }
  }, [isAuthenticated, authLoading, refreshSession])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
      setSigningOut(false)
    }
  }

  // Check for success/error params, verify checkout, and auto-trigger deep link
  useEffect(() => {
    if (successParam && sessionId) {
      // Verify the checkout session and update subscription in Convex
      async function verifyCheckout() {
        try {
          const response = await fetch('/api/checkout/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          })
          
          if (response.ok) {
            const data = await response.json()
            setMessage({ type: 'success', text: `Subscription to ${data.tier} plan activated successfully!` })
            // Refresh entitlements after verification
            const entResponse = await fetch('/api/entitlements')
            if (entResponse.ok) {
              const entData = await entResponse.json()
              setEntitlements(entData)
              setEntitlementsError(null)
            }
          } else {
            setMessage({ type: 'success', text: 'Subscription activated successfully!' })
          }
        } catch (error) {
          console.error('[Account] Checkout verification error:', error)
          setMessage({ type: 'success', text: 'Subscription activated successfully!' })
        }
      }
      
      verifyCheckout()
    } else if (canceledParam) {
      setMessage({ type: 'error', text: 'Checkout was canceled.' })
    }
  }, [canceledParam, currentUserId, sessionId, successParam])

  // Handler for manual "Open in App" button
  // This generates a deep link with auth tokens so the desktop app signs in with the current account
  const handleOpenInApp = async () => {
    setActionLoading('openApp')
    try {
      const response = await fetch('/api/auth/desktop-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          desktopCodeChallenge ? { codeChallenge: desktopCodeChallenge } : {}
        )
      })
      if (!response.ok) {
        console.error('[Account] Failed to generate desktop link')
        triggerDeepLink(`${APP_PROTOCOL}://subscription-updated`)
        return
      }

      const { deepLink } = await response.json()
      const tokenMatch = deepLink.match(/[?&]token=([^&]+)/)
      const token = tokenMatch?.[1]

      // In dev mode, the Electron app runs a local HTTP server because macOS deep links
      // are unreliable for child processes (electron-vite spawns Electron as a subprocess,
      // so Launch Services never fires open-url on the running instance).
      if (token) {
        try {
          const localRes = await fetch(`http://localhost:45738/auth?token=${token}`, {
            signal: AbortSignal.timeout(1500),
          })
          if (localRes.ok) {
            console.log('[Account] Auth handled via local dev server')
            return
          }
        } catch {
          // Dev server not available — fall through to deep link (production path)
        }
      }

      console.log('[Account] Opening desktop app via deep link')
      triggerDeepLink(deepLink)
    } catch (error) {
      console.error('[Account] Error generating desktop link:', error)
      triggerDeepLink(`${APP_PROTOCOL}://subscription-updated`)
    } finally {
      setActionLoading(null)
    }
  }

  // Trigger deep link - now uses short URLs that work reliably
  const triggerDeepLink = (url: string) => {
    console.log('[Account] Triggering deep link:', url)
    // Direct navigation works for short URLs
    window.location.href = url
  }

  // Fetch entitlements when userId is available
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return
    
    // If not authenticated, stop loading
    if (!isAuthenticated || !currentUserId) {
      setLoading(false)
      return
    }

    async function fetchEntitlements() {
      try {
        setEntitlementsError(null)
        const response = await fetch('/api/entitlements')
        if (response.ok) {
          const data = await response.json()
          console.log('[Account] Received entitlements:', data)
          setEntitlements(data)
        } else {
          const errBody = await response.json().catch(() => ({})) as { error?: string }
          setEntitlements(null)
          setEntitlementsError(
            errBody.error ||
              (response.status === 401
                ? 'We could not verify your session with the server. Sign out and sign in again, and ensure Convex has the same WorkOS client IDs as this app.'
                : 'Could not load your plan. Try again in a moment.'),
          )
        }
      } catch (error) {
        console.error('Failed to fetch entitlements:', error)
        setEntitlements(null)
        setEntitlementsError('Could not load your plan. Check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchEntitlements()
  }, [currentUserId, authLoading, isAuthenticated])

  const handleManageBilling = async () => {
    setActionLoading('billing')
    try {
      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
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

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      <div className="liquid-glass" />

      {/* Header */}
      <PageNavbar />

      {/* Main Content */}
      <main className="relative z-10 flex-1 px-4 py-6 md:px-8 md:py-8">
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
              <div className="ml-auto flex flex-wrap items-center gap-3">
                {message.type === 'success' && (
                  <>
                    <button
                      onClick={handleOpenInApp}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                    >
                      Open in desktop app
                    </button>
                    <button
                      onClick={() => router.push('/app/chat')}
                      className="rounded-lg border border-emerald-300 px-3 py-1 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100/70"
                    >
                      Open web app
                    </button>
                  </>
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

          <h1 className="text-3xl font-serif mb-8">account</h1>

          {loading || authLoading || !sessionCheckComplete ? (
            <div className="text-center py-16">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-zinc-400" />
              <p className="mt-4 text-zinc-500">Loading your account...</p>
            </div>
          ) : !isAuthenticated ? (
            <div className="text-center py-16">
              <div className="glass-dark rounded-2xl p-8 max-w-md mx-auto">
                <h2 className="text-xl font-serif mb-2">Sign in to view your account</h2>
                <p className="text-zinc-500 mb-6">
                  Access your subscription details, usage statistics, and billing information.
                </p>
                <Link
                  href="/auth/sign-in"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
                >
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {entitlementsError && (
                <div className="p-4 rounded-xl flex items-start gap-3 bg-amber-50 text-amber-900 border border-amber-200">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-sm space-y-2">
                    <p className="font-medium">Plan information unavailable</p>
                    <p className="text-amber-800/90">{entitlementsError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setLoading(true)
                        void fetch('/api/entitlements')
                          .then(async (res) => {
                            if (res.ok) {
                              setEntitlements(await res.json())
                              setEntitlementsError(null)
                            } else {
                              const body = await res.json().catch(() => ({})) as { error?: string }
                              setEntitlements(null)
                              setEntitlementsError(body.error || 'Still could not load your plan.')
                            }
                          })
                          .catch(() => {
                            setEntitlementsError('Could not load your plan.')
                          })
                          .finally(() => setLoading(false))
                      }}
                      className="text-sm font-medium text-amber-950 underline hover:no-underline"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* User Profile Card */}
              <div className="glass-dark rounded-2xl p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center text-lg font-medium">
                      {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <h2 className="text-lg font-medium">
                        {user?.firstName && user?.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user?.email}
                      </h2>
                      <p className="text-sm text-zinc-500">{user?.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="w-full rounded-lg px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 sm:w-auto"
                  >
                    {signingOut ? 'Signing out...' : 'Sign out'}
                  </button>
                </div>
              </div>

              <div className="glass-dark rounded-2xl p-6">
                <p className="mb-1 text-sm text-zinc-500">Continue with Overlay</p>
                <p className="mb-4 text-sm text-zinc-500">
                  Open the desktop app for the native overlay workflow, or continue in the web app from here.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={handleOpenInApp}
                    disabled={actionLoading === 'openApp'}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {actionLoading === 'openApp' ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Opening...
                      </>
                    ) : (
                      <>
                        Open in desktop app
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  <Link
                    href="/app/chat"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                  >
                    Open web app
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {entitlements && (
                <>
                  {/* Subscription Card */}
                  <div className="glass-dark rounded-2xl p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h2 className="text-lg font-medium mb-1">
                          {entitlements.tier.charAt(0).toUpperCase() + entitlements.tier.slice(1)} Plan
                        </h2>
                        <p className="text-sm text-(--muted)">
                          {entitlements.status === 'active' && entitlements.billingPeriodEnd
                            ? `Renews ${formatDate(entitlements.billingPeriodEnd)}`
                            : entitlements.status === 'canceled'
                              ? 'Subscription canceled'
                              : entitlements.status === 'past_due'
                                ? 'Payment past due'
                                : 'Active'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            entitlements.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : entitlements.status === 'past_due'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-zinc-100 text-zinc-800'
                          }`}
                        >
                          {entitlements.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {entitlements.tier === 'free' && (
                        <Link
                          href="/pricing"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-[var(--background)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                          Upgrade to Pro
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Usage Card (Pro/Max only) */}
                  {entitlements.tier !== 'free' && (
                    <div className="glass-dark rounded-2xl p-6">
                      <h2 className="text-lg font-medium mb-4">Usage This Period</h2>

                      <ProgressBar
                        used={entitlements.usage.tokenCostAccrued}
                        total={entitlements.limits.tokenBudget}
                        label="Subscription"
                        showAsPercentage={true}
                      />

                      <div className="mt-6 pt-4 border-t border-zinc-200">
                        <button
                          onClick={handleManageBilling}
                          disabled={actionLoading === 'billing'}
                          className="px-4 py-2 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                        >
                          {actionLoading === 'billing' ? 'Opening...' : 'Manage Subscription'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Weekly Usage (Free tier) */}
                  {entitlements.tier === 'free' && (
                    <div className="glass-dark rounded-2xl p-6">
                      <h2 className="text-lg font-medium mb-4">Weekly Usage</h2>

                      <div className="space-y-4">
                        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                          <p className="text-sm font-medium text-zinc-900">Auto model requests</p>
                          <p className="mt-1 text-sm text-zinc-500">
                            Unlimited on the free tier when you use Auto.
                          </p>
                        </div>

                        <ProgressBar
                          used={entitlements.usage.transcriptionSeconds}
                          total={entitlements.limits.transcriptionSecondsPerWeek}
                          label="Transcription"
                          showAsPercentage={true}
                        />
                      </div>

                      <p className="mt-4 text-xs text-[var(--muted)]">
                        Auto is unlimited on free. Upgrade to Pro to use premium models.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-8 border-t border-zinc-200 mt-auto">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-[var(--muted)]">
          <p>© 2026 overlay</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">
              terms
            </Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">
              privacy
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
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-(--muted)" />
            <p className="mt-4 text-(--muted)">Loading...</p>
          </div>
        </div>
      }
    >
      <AccountPageContent />
    </Suspense>
  )
}
