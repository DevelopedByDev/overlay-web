'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Get userId from AuthContext (session-based)
  const { user, isLoading: authLoading, isAuthenticated, signOut, refreshSession } = useAuth()
  const currentUserId = user?.id || null
  const [signingOut, setSigningOut] = useState(false)
  const [sessionCheckComplete, setSessionCheckComplete] = useState(false)
  const [showOpenInOverlayPrompt, setShowOpenInOverlayPrompt] = useState(false)
  const [showSubscriptionUpdatedPrompt, setShowSubscriptionUpdatedPrompt] = useState(false)

  // Refresh session on mount to ensure we have the latest session state
  // This fixes the race condition when redirecting from auth callback
  useEffect(() => {
    let mounted = true
    const checkSession = async () => {
      // If already authenticated or auth is still loading, skip refresh
      if (isAuthenticated || authLoading) {
        if (mounted) {
          setSessionCheckComplete(true)
          // Show "Open in Overlay" prompt after successful sign-in
          // Check if this is a fresh sign-in using sessionStorage flag
          const hasSeenPrompt = sessionStorage.getItem('overlay_open_prompt_shown')
          if (isAuthenticated && !hasSeenPrompt) {
            setShowOpenInOverlayPrompt(true)
            sessionStorage.setItem('overlay_open_prompt_shown', 'true')
          }
        }
        return
      }
      // Give a small delay for cookies to be fully set after redirect
      await new Promise(resolve => setTimeout(resolve, 100))
      await refreshSession()
      if (mounted) {
        setSessionCheckComplete(true)
        // Show prompt if user just authenticated
        const hasSeenPrompt = sessionStorage.getItem('overlay_open_prompt_shown')
        if (isAuthenticated && !hasSeenPrompt) {
          setShowOpenInOverlayPrompt(true)
          sessionStorage.setItem('overlay_open_prompt_shown', 'true')
        }
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
    const sessionId = searchParams.get('session_id')
    
    if (searchParams.get('success') && sessionId) {
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
            if (currentUserId) {
              const entResponse = await fetch(`/api/entitlements?userId=${currentUserId}`)
              if (entResponse.ok) {
                const entData = await entResponse.json()
                setEntitlements(entData)
              }
            }
            // Show "Open in Overlay" prompt for subscription update
            setShowSubscriptionUpdatedPrompt(true)
          } else {
            setMessage({ type: 'success', text: 'Subscription activated successfully!' })
            setShowSubscriptionUpdatedPrompt(true)
          }
        } catch (error) {
          console.error('[Account] Checkout verification error:', error)
          setMessage({ type: 'success', text: 'Subscription activated successfully!' })
          setShowSubscriptionUpdatedPrompt(true)
        }
      }
      
      verifyCheckout()
    } else if (searchParams.get('canceled')) {
      setMessage({ type: 'error', text: 'Checkout was canceled.' })
    }
  }, [searchParams, currentUserId])

  // Handler for manual "Open in App" button
  // This generates a deep link with auth tokens so the desktop app signs in with the current account
  const handleOpenInApp = async () => {
    setActionLoading('openApp')
    try {
      const response = await fetch('/api/auth/desktop-link', { method: 'POST' })
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
        const response = await fetch(`/api/entitlements?userId=${currentUserId}`)
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
  }, [currentUserId, authLoading, isAuthenticated])

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

  // Demo data for when not connected
  const demoEntitlements: Entitlements = {
    tier: 'pro',
    status: 'active',
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
    billingPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  }

  const data = entitlements || demoEntitlements

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      <div className="liquid-glass" />

      {/* Open in Overlay Prompt Modal */}
      {showOpenInOverlayPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-xl">
            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-serif mb-2">Welcome to Overlay!</h2>
            <p className="text-zinc-500 mb-6">
              You&apos;re signed in. Open the desktop app to continue.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  handleOpenInApp()
                  setShowOpenInOverlayPrompt(false)
                }}
                className="w-full py-3 px-4 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
              >
                Open in Overlay
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowOpenInOverlayPrompt(false)}
                className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-700"
              >
                Stay on this page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Updated Prompt Modal */}
      {showSubscriptionUpdatedPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-xl">
            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-serif mb-2">Subscription Activated!</h2>
            <p className="text-zinc-500 mb-6">
              Your subscription has been updated. Open the desktop app to start using your new features.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  handleOpenInApp()
                  setShowSubscriptionUpdatedPrompt(false)
                }}
                className="w-full py-3 px-4 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
              >
                Open in Overlay
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowSubscriptionUpdatedPrompt(false)}
                className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-700"
              >
                Stay on this page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <PageNavbar />

      {/* Main Content */}
      <main className="relative z-10 px-8 py-8 flex-1">
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
              {/* User Profile Card */}
              <div className="glass-dark rounded-2xl p-6">
                <div className="flex items-center justify-between">
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
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {signingOut ? 'Signing out...' : 'Sign out'}
                  </button>
                </div>
              </div>

              {/* Subscription Card */}
              <div className="glass-dark rounded-2xl p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-medium mb-1">
                      {data.tier.charAt(0).toUpperCase() + data.tier.slice(1)} Plan
                    </h2>
                    <p className="text-sm text-(--muted)">
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


                <div className="flex items-center gap-3 flex-wrap">
                  {data.tier === 'free' && (
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-[var(--background)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      Upgrade to Pro
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                  
                  {/* Open in Overlay button - always visible */}
                  <button
                    onClick={handleOpenInApp}
                    disabled={actionLoading === 'openApp'}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'openApp' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Opening...
                      </>
                    ) : (
                      <>
                        Open in Overlay
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
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

                  {/* Manage Subscription */}
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
              {data.tier === 'free' && (
                <div className="glass-dark rounded-2xl p-6">
                  <h2 className="text-lg font-medium mb-4">Weekly Usage</h2>

                  <div className="space-y-4">
                    {/* Weekly Requests */}
                    {(() => {
                      const totalUsed = data.usage.ask + data.usage.agent + data.usage.write
                      const totalLimit = data.limits.askPerDay + data.limits.agentPerDay + data.limits.writePerDay
                      return (
                        <ProgressBar
                          used={totalUsed}
                          total={totalLimit}
                          label="Weekly Requests"
                          showAsPercentage={true}
                        />
                      )
                    })()}

                    {/* Transcription */}
                    <ProgressBar
                      used={data.usage.transcriptionSeconds}
                      total={data.limits.transcriptionSecondsPerWeek}
                      label="Transcription"
                      showAsPercentage={true}
                    />
                  </div>

                  <p className="mt-4 text-xs text-[var(--muted)]">
                    Usage resets weekly. Upgrade for unlimited usage.
                  </p>
                </div>
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
