'use client'

import { useState, useEffect, Suspense, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { RefreshCw, ArrowRight, Check, AlertCircle } from 'lucide-react'
import { TopUpPreferenceControl } from '@/components/billing/TopUpPreferenceControl'
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection'
import { useAuth } from '@/contexts/AuthContext'
import { LandingThemeProvider, useLandingTheme } from '@/contexts/LandingThemeContext'
import { PageNavbar } from '@/components/PageNavbar'
import { formatBytes } from '@/lib/storage-limits'
import { getStoredDesktopPkceChallenge } from '@/lib/mobile-auth-client'
import {
  marketingBody,
  marketingHeading,
  marketingMuted,
  marketingPageTitle,
  marketingPanel,
  marketingPanelLg,
} from '@/lib/landingPageStyles'

// Always use overlay:// for deep links (registered in WorkOS for both environments)
const APP_PROTOCOL = 'overlay'

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  planKind: 'free' | 'paid'
  planAmountCents: number
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  autoTopUpEnabled: boolean
  autoTopUpAmountCents: number
  autoTopUpConsentGranted: boolean
  budgetUsedCents: number
  budgetTotalCents: number
  budgetRemainingCents: number
  creditsUsed: number
  creditsTotal: number
  overlayStorageBytesUsed: number
  overlayStorageBytesLimit: number
  limits: {
    askPerDay: number
    agentPerDay: number
    writePerDay: number
    tokenBudget: number
    transcriptionSecondsPerWeek: number
    overlayStorageBytes: number
  }
  usage: {
    ask: number
    agent: number
    write: number
    tokenCostAccrued: number
    transcriptionSeconds: number
    overlayStorageBytes: number
  }
  remaining: {
    ask: number
    agent: number
    write: number
    tokenBudget: number
    transcriptionSeconds: number
    overlayStorageBytes: number
  }
  billingPeriodEnd?: number
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

interface TopUpHistoryItem {
  _id: string
  amountCents: number
  source: 'manual' | 'auto'
  status: 'pending' | 'succeeded' | 'failed' | 'canceled'
  createdAt: number
  updatedAt: number
  errorMessage?: string
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatDateTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

function ProgressBar({
  used,
  total,
  label,
  showAsPercentage = false,
  isLandingDark = false,
}: {
  used: number
  total: number
  label: string
  showAsPercentage?: boolean
  isLandingDark?: boolean
}) {
  const remaining = Math.max(0, total - used)
  const percentage = total > 0 ? (remaining / total) * 100 : 0
  const isLow = percentage <= 20
  const isEmpty = percentage <= 0
  const labelCls = isLandingDark ? 'text-zinc-400' : 'text-zinc-500'
  const valueCls = isEmpty
    ? 'text-red-400'
    : isLow
      ? 'text-amber-400'
      : isLandingDark
        ? 'text-zinc-100'
        : 'text-zinc-900'
  const track = isLandingDark ? 'bg-zinc-700' : 'bg-zinc-200'
  const fill = isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : isLandingDark ? 'bg-zinc-100' : 'bg-zinc-900'

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className={labelCls}>{label}</span>
        <span className={valueCls}>
          {showAsPercentage
            ? `${Math.round(percentage)}% remaining`
            : `$${remaining.toFixed(2)} / $${total}`}
        </span>
      </div>
      <div className={`h-1.5 overflow-hidden rounded-full ${track}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${fill}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function AccountPageContent() {
  const { isLandingDark } = useLandingTheme()
  const panel = marketingPanel(isLandingDark)
  const panelLg = marketingPanelLg(isLandingDark)
  const t = {
    title: marketingPageTitle(isLandingDark),
    h: marketingHeading(isLandingDark),
    muted: marketingMuted(isLandingDark),
    body: marketingBody(isLandingDark),
  }
  const footBorder = isLandingDark ? 'border-zinc-800' : 'border-zinc-200'
  const footMuted = marketingMuted(isLandingDark)
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams?.get('session_id') ?? null
  const successParam = searchParams?.get('success')
  const canceledParam = searchParams?.get('canceled')
  const topUpSuccessParam = searchParams?.get('topup_success')
  const topUpSessionId = searchParams?.get('topup_session_id') ?? null
  const desktopCodeChallenge = searchParams?.get('desktop_code_challenge')?.trim() || getStoredDesktopPkceChallenge() || ''
  const extensionHandoff = searchParams?.get('extension_handoff') === '1'
  const chromeExtensionIdRaw = searchParams?.get('chrome_extension_id')?.trim() || ''
  const extensionHandoffSentRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  /** Set when /api/entitlements fails (e.g. Convex cannot verify WorkOS JWT) — avoids showing fake "free" defaults. */
  const [entitlementsError, setEntitlementsError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [billingSettings, setBillingSettings] = useState<BillingSettings | null>(null)
  const [topUpHistory, setTopUpHistory] = useState<TopUpHistoryItem[]>([])
  const [topUpAmountDraftCents, setTopUpAmountDraftCents] = useState(800)
  const [autoTopUpEnabledDraft, setAutoTopUpEnabledDraft] = useState(false)

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

  useEffect(() => {
    if (!extensionHandoff || !chromeExtensionIdRaw || !desktopCodeChallenge) return
    if (!isAuthenticated || !currentUserId || !sessionCheckComplete) return
    if (extensionHandoffSentRef.current) return
    if (!/^[a-p]{32}$/.test(chromeExtensionIdRaw)) return

    extensionHandoffSentRef.current = true
    let cancelled = false

    void (async () => {
      try {
        const response = await fetch('/api/auth/desktop-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codeChallenge: desktopCodeChallenge,
            chromeExtensionId: chromeExtensionIdRaw,
          }),
        })
        if (cancelled || !response.ok) {
          extensionHandoffSentRef.current = false
          return
        }
        const json = (await response.json()) as { deepLink?: string }
        const deepLink = typeof json.deepLink === 'string' ? json.deepLink : ''
        const tokenMatch = deepLink.match(/[?&]token=([^&]+)/)
        const rawToken = tokenMatch?.[1]
        const token = rawToken ? decodeURIComponent(rawToken) : ''
        if (!token || cancelled) {
          extensionHandoffSentRef.current = false
          return
        }

        const chromeRuntime = (
          typeof window !== 'undefined'
            ? (
                window as unknown as {
                  chrome?: {
                    runtime?: {
                      sendMessage: (extId: string, msg: unknown, cb?: () => void) => void
                      lastError?: { message: string }
                    }
                  }
                }
              ).chrome?.runtime
            : undefined
        )
        if (!chromeRuntime?.sendMessage) {
          extensionHandoffSentRef.current = false
          return
        }

        chromeRuntime.sendMessage(
          chromeExtensionIdRaw,
          { type: 'overlay.extension.auth.handoff', token },
          () => {
            void chromeRuntime.lastError
          },
        )
        setMessage({
          type: 'success',
          text: 'Chrome extension connected. You can return to the side panel and press Refresh if needed.',
        })
      } catch (e) {
        console.error('[Account] Extension handoff error:', e)
        extensionHandoffSentRef.current = false
      } finally {
        if (!cancelled && typeof window !== 'undefined') {
          const next = new URL(window.location.href)
          next.searchParams.delete('extension_handoff')
          next.searchParams.delete('chrome_extension_id')
          next.searchParams.delete('desktop_code_challenge')
          router.replace(`${next.pathname}${next.search}`, { scroll: false })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    chromeExtensionIdRaw,
    currentUserId,
    desktopCodeChallenge,
    extensionHandoff,
    isAuthenticated,
    router,
    sessionCheckComplete,
  ])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
      setSigningOut(false)
    }
  }

  const refreshBillingState = useCallback(async () => {
    const [entitlementsResponse, settingsResponse, topUpHistoryResponse] = await Promise.all([
      fetch('/api/entitlements'),
      fetch('/api/subscription/settings'),
      fetch('/api/topups/history'),
    ])

    if (entitlementsResponse.ok) {
      setEntitlements(await entitlementsResponse.json())
      setEntitlementsError(null)
    }

    if (settingsResponse.ok) {
      const settingsData = await settingsResponse.json()
      setBillingSettings(settingsData)
      setTopUpAmountDraftCents(settingsData.topUpAmountCents ?? settingsData.autoTopUpAmountCents ?? settingsData.topUpMinAmountCents ?? 800)
      setAutoTopUpEnabledDraft(Boolean(settingsData.autoTopUpEnabled))
    }

    if (topUpHistoryResponse.ok) {
      const data = await topUpHistoryResponse.json()
      setTopUpHistory(Array.isArray(data.items) ? data.items : [])
    }
  }, [])

  // Check for success/error params, verify checkout, and auto-trigger deep link
  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams?.toString() ?? '')
    nextParams.delete('success')
    nextParams.delete('session_id')
    nextParams.delete('canceled')
    nextParams.delete('topup_success')
    nextParams.delete('topup_session_id')
    nextParams.delete('topup_canceled')
    const nextUrl = `/account${nextParams.toString() ? `?${nextParams.toString()}` : ''}`

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
            const planLabel = typeof data.planAmountCents === 'number' ? `$${(data.planAmountCents / 100).toFixed(0)}/month` : 'paid'
            setMessage({ type: 'success', text: `Subscription to the ${planLabel} plan activated successfully.` })
            await refreshBillingState()
          } else {
            setMessage({ type: 'success', text: 'Subscription activated successfully!' })
          }
        } catch (error) {
          console.error('[Account] Checkout verification error:', error)
          setMessage({ type: 'success', text: 'Subscription activated successfully!' })
        } finally {
          router.replace(nextUrl)
        }
      }
      
      verifyCheckout()
    } else if (topUpSuccessParam && topUpSessionId) {
      async function verifyTopUp() {
        try {
          const response = await fetch('/api/topups/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: topUpSessionId }),
          })
          if (response.ok) {
            const data = await response.json()
            setMessage({ type: 'success', text: `Top-up applied: $${(Number(data.amountCents ?? 0) / 100).toFixed(2)}.` })
            await refreshBillingState()
          } else {
            setMessage({ type: 'error', text: 'We could not verify your top-up. Refresh and check again.' })
          }
        } catch (error) {
          console.error('[Account] Top-up verification error:', error)
          setMessage({ type: 'error', text: 'We could not verify your top-up. Refresh and check again.' })
        } finally {
          router.replace(nextUrl)
        }
      }

      verifyTopUp()
    } else if (canceledParam) {
      setMessage({ type: 'error', text: 'Checkout was canceled.' })
      router.replace(nextUrl)
    }
  }, [canceledParam, currentUserId, refreshBillingState, router, searchParams, sessionId, successParam, topUpSessionId, topUpSuccessParam])

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
          const localUrl = new URL('http://localhost:45738/auth')
          localUrl.searchParams.set('token', token)
          localUrl.searchParams.set('server', window.location.origin)
          const localRes = await fetch(localUrl.toString(), {
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
        const [entitlementsResponse, settingsResponse, topUpHistoryResponse] = await Promise.all([
          fetch('/api/entitlements'),
          fetch('/api/subscription/settings'),
          fetch('/api/topups/history'),
        ])

        if (entitlementsResponse.ok) {
          const data = await entitlementsResponse.json()
          console.log('[Account] Received entitlements:', data)
          setEntitlements(data)
        } else {
          const errBody = await entitlementsResponse.json().catch(() => ({})) as { error?: string }
          setEntitlements(null)
          setEntitlementsError(
            errBody.error ||
              (entitlementsResponse.status === 401
                ? 'We could not verify your session with the server. Sign out and sign in again, and ensure Convex has the same WorkOS client IDs as this app.'
                : 'Could not load your plan. Try again in a moment.'),
          )
        }

        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json()
          setBillingSettings(settingsData)
          setTopUpAmountDraftCents(settingsData.topUpAmountCents ?? settingsData.autoTopUpAmountCents ?? settingsData.topUpMinAmountCents ?? 800)
          setAutoTopUpEnabledDraft(Boolean(settingsData.autoTopUpEnabled))
        }

        if (topUpHistoryResponse.ok) {
          const data = await topUpHistoryResponse.json()
          setTopUpHistory(Array.isArray(data.items) ? data.items : [])
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

  const handleStartTopUp = async (amountCents: number, autoTopUpEnabled: boolean) => {
    setActionLoading(`topup-${amountCents}`)
    try {
      const response = await fetch('/api/topups/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents,
          autoTopUpEnabled,
          returnPath: '/account',
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.url) {
        setMessage({ type: 'error', text: data.error || 'Failed to start top-up checkout.' })
        return
      }
      window.location.href = data.url
    } catch (error) {
      console.error('[Account] Top-up checkout error:', error)
      setMessage({ type: 'error', text: 'Failed to start top-up checkout.' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleTopUpPreferenceSave = async () => {
    setActionLoading('topup-settings')
    try {
      const response = await fetch('/api/subscription/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoTopUpEnabled: autoTopUpEnabledDraft,
          topUpAmountCents: topUpAmountDraftCents,
          grantOffSessionConsent: autoTopUpEnabledDraft,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to update top-up settings.' })
        return
      }
      await refreshBillingState()
      setMessage({ type: 'success', text: 'Top-up preference updated.' })
    } catch (error) {
      console.error('[Account] Top-up settings error:', error)
      setMessage({ type: 'error', text: 'Failed to update top-up settings.' })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col gradient-bg">
      <div className="liquid-glass" />

      {/* Header */}
      <PageNavbar />

      {/* Main Content */}
      <main className="relative z-10 flex-1 px-4 pb-10 pt-28 md:px-8 md:pb-14 md:pt-32">
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

          <h1 className={`text-3xl font-serif md:text-4xl mb-8 ${t.title}`}>Account</h1>

          {loading || authLoading || !sessionCheckComplete ? (
            <div className="text-center py-16">
              <RefreshCw className={`mx-auto h-8 w-8 animate-spin ${isLandingDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
              <p className={`mt-4 ${t.muted}`}>Loading your account...</p>
            </div>
          ) : !isAuthenticated ? (
            <div className="text-center py-16">
              <div className={panelLg}>
                <h2 className={`text-xl font-serif mb-2 ${t.h}`}>Sign in to view your account</h2>
                <p className={`mb-6 ${t.muted}`}>
                  Access your subscription details, usage statistics, and billing information.
                </p>
                <Link
                  href="/auth/sign-in"
                  className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-colors ${
                    isLandingDark
                      ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800'
                  }`}
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
              <div className={panel}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-medium ${
                        isLandingDark ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-200 text-zinc-900'
                      }`}
                    >
                      {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <h2 className={`text-lg font-medium ${t.h}`}>
                        {user?.firstName && user?.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user?.email}
                      </h2>
                      <p className={`text-sm ${t.muted}`}>{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 sm:w-auto ${
                        isLandingDark
                          ? 'text-red-400 hover:bg-red-950/40 hover:text-red-300'
                          : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                      }`}
                    >
                      {signingOut ? 'Signing out...' : 'Sign out'}
                    </button>
                    <DeleteAccountSection isLandingDark={isLandingDark} />
                  </div>
                </div>
              </div>

              <div className={panel}>
                <p className={`mb-1 text-sm ${t.muted}`}>Continue with Overlay</p>
                <p className={`mb-4 text-sm ${t.body}`}>
                  Open the desktop app for the native overlay workflow, or continue in the web app from here.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={handleOpenInApp}
                    disabled={actionLoading === 'openApp'}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                      isLandingDark
                        ? 'border-zinc-600 text-zinc-200 hover:bg-zinc-800'
                        : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                    }`}
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
                    className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      isLandingDark
                        ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
                        : 'bg-zinc-900 text-white hover:bg-zinc-800'
                    }`}
                  >
                    Open web app
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {entitlements && (
                <>
                  {/* Subscription Card */}
                  <div className={panel}>
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h2 className={`text-lg font-medium mb-1 ${t.h}`}>
                          {entitlements.planKind === 'paid'
                            ? `${(entitlements.planAmountCents / 100).toFixed(0)} dollar plan`
                            : 'Free plan'}
                        </h2>
                        <p className={`text-sm ${t.muted}`}>
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
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            entitlements.status === 'active'
                              ? isLandingDark
                                ? 'bg-emerald-900/50 text-emerald-200 ring-1 ring-emerald-700/60'
                                : 'bg-emerald-100 text-emerald-800'
                              : entitlements.status === 'past_due'
                                ? isLandingDark
                                  ? 'bg-amber-900/40 text-amber-200 ring-1 ring-amber-700/50'
                                  : 'bg-amber-100 text-amber-800'
                                : isLandingDark
                                  ? 'bg-zinc-800 text-zinc-200'
                                  : 'bg-zinc-100 text-zinc-800'
                          }`}
                        >
                          {entitlements.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {entitlements.planKind === 'free' && (
                        <Link
                          href="/pricing"
                          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 ${
                            isLandingDark ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 text-white'
                          }`}
                        >
                          Upgrade to paid
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      )}
                      {entitlements.planKind === 'paid' && (
                        <>
                          <Link
                            href="/pricing?intent=change-plan"
                            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                              isLandingDark
                                ? 'border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800'
                                : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                            }`}
                          >
                            Change plan
                          </Link>
                          <button
                            onClick={handleManageBilling}
                            disabled={actionLoading === 'billing'}
                            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                              isLandingDark
                                ? 'border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                                : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                            }`}
                          >
                            {actionLoading === 'billing' ? 'Opening...' : 'Manage billing'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {entitlements.planKind === 'paid' && (
                    <div className={panel}>
                      <h2 className={`text-lg font-medium mb-4 ${t.h}`}>Usage This Period</h2>

                      <ProgressBar
                        used={entitlements.budgetUsedCents / 100}
                        total={entitlements.budgetTotalCents / 100}
                        label="Monthly budget"
                        showAsPercentage={true}
                        isLandingDark={isLandingDark}
                      />

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div
                          className={`rounded-xl border px-4 py-3 ${
                            isLandingDark ? 'border-zinc-700 bg-zinc-950/60' : 'border-zinc-200 bg-zinc-50'
                          }`}
                        >
                          <p className={`text-xs uppercase tracking-[0.18em] ${t.muted}`}>Used</p>
                          <p className={`mt-2 text-lg font-medium ${t.h}`}>${(entitlements.budgetUsedCents / 100).toFixed(2)}</p>
                        </div>
                        <div
                          className={`rounded-xl border px-4 py-3 ${
                            isLandingDark ? 'border-zinc-700 bg-zinc-950/60' : 'border-zinc-200 bg-zinc-50'
                          }`}
                        >
                          <p className={`text-xs uppercase tracking-[0.18em] ${t.muted}`}>Remaining</p>
                          <p className={`mt-2 text-lg font-medium ${t.h}`}>${(entitlements.budgetRemainingCents / 100).toFixed(2)}</p>
                        </div>
                        <div
                          className={`rounded-xl border px-4 py-3 ${
                            isLandingDark ? 'border-zinc-700 bg-zinc-950/60' : 'border-zinc-200 bg-zinc-50'
                          }`}
                        >
                          <p className={`text-xs uppercase tracking-[0.18em] ${t.muted}`}>Storage</p>
                          <p className={`mt-2 text-lg font-medium ${t.h}`}>
                            {formatBytes(entitlements.overlayStorageBytesUsed)} / {formatBytes(entitlements.overlayStorageBytesLimit)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {entitlements.planKind === 'paid' && (
                    <div className={panel}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h2 className={`text-lg font-medium ${t.h}`}>Top-ups and billing controls</h2>
                          <p className={`mt-1 text-sm ${t.muted}`}>
                            Use one top-up amount everywhere. Add it once now, or save it for future automatic recharges.
                          </p>
                        </div>
                      </div>

                      <div className="mt-5">
                        <TopUpPreferenceControl
                          variant="marketing"
                          isDark={isLandingDark}
                          title="Top-up amount"
                          description="The same amount is used for manual top-ups and, if enabled, future automatic recharges."
                          amountCents={topUpAmountDraftCents}
                          minAmountCents={billingSettings?.topUpMinAmountCents ?? 800}
                          maxAmountCents={billingSettings?.topUpMaxAmountCents ?? 20_000}
                          stepAmountCents={billingSettings?.topUpStepAmountCents ?? 100}
                          onAmountChange={setTopUpAmountDraftCents}
                          autoTopUpEnabled={autoTopUpEnabledDraft}
                          onAutoTopUpEnabledChange={setAutoTopUpEnabledDraft}
                          checkboxDescription="If enabled, this same amount will recharge automatically whenever your cumulative budget reaches zero."
                          note="Saving or checking the box authorizes off-session recharges for the selected amount."
                          footer={
                            <>
                              <button
                                type="button"
                                onClick={() => void handleStartTopUp(topUpAmountDraftCents, autoTopUpEnabledDraft)}
                                disabled={actionLoading === `topup-${topUpAmountDraftCents}`}
                                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                                  isLandingDark
                                    ? 'border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                                    : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                                }`}
                              >
                                {actionLoading === `topup-${topUpAmountDraftCents}` ? 'Opening…' : `Add $${(topUpAmountDraftCents / 100).toFixed(0)} top-up`}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleTopUpPreferenceSave()}
                                disabled={actionLoading === 'topup-settings'}
                                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                                  isLandingDark
                                    ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
                                    : 'bg-zinc-900 text-white hover:bg-zinc-800'
                                }`}
                              >
                                {actionLoading === 'topup-settings' ? 'Saving...' : 'Save top-up preference'}
                              </button>
                            </>
                          }
                        />
                      </div>

                      <div className="mt-6">
                        <h3 className={`text-sm font-medium ${t.h}`}>Recent top-ups</h3>
                        <div className="mt-3 space-y-3">
                          {topUpHistory.length === 0 ? (
                            <p className={`text-sm ${t.muted}`}>No top-ups yet.</p>
                          ) : (
                            topUpHistory.slice(0, 6).map((item) => (
                              <div
                                key={item._id}
                                className={`flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm md:flex-row md:items-center md:justify-between ${
                                  isLandingDark ? 'border-zinc-700 bg-zinc-950/60' : 'border-zinc-200 bg-zinc-50'
                                }`}
                              >
                                <div>
                                  <p className={t.h}>
                                    ${ (item.amountCents / 100).toFixed(2)} · {item.source === 'auto' ? 'Auto top-up' : 'Manual top-up'}
                                  </p>
                                  <p className={t.muted}>{formatDateTime(item.createdAt)}</p>
                                </div>
                                <div className="text-right">
                                  <p className={`${item.status === 'succeeded' ? 'text-emerald-600' : item.status === 'failed' ? 'text-red-500' : t.muted}`}>
                                    {item.status}
                                  </p>
                                  {item.errorMessage ? <p className={`max-w-xs text-xs ${t.muted}`}>{item.errorMessage}</p> : null}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {entitlements.planKind === 'free' && (
                    <div className={panel}>
                      <h2 className={`text-lg font-medium mb-4 ${t.h}`}>Weekly Usage</h2>

                      <div className="space-y-4">
                        <div
                          className={`rounded-xl border px-4 py-3 ${
                            isLandingDark
                              ? 'border-zinc-700 bg-zinc-950/60'
                              : 'border-zinc-200 bg-zinc-50'
                          }`}
                        >
                          <p className={`text-sm font-medium ${t.h}`}>Auto model requests</p>
                          <p className={`mt-1 text-sm ${t.muted}`}>
                            Unlimited on the free tier when you use Auto.
                          </p>
                        </div>

                        <ProgressBar
                          used={entitlements.usage.transcriptionSeconds}
                          total={entitlements.limits.transcriptionSecondsPerWeek}
                          label="Transcription"
                          showAsPercentage={true}
                          isLandingDark={isLandingDark}
                        />
                      </div>

                      <p className={`mt-4 text-xs ${t.muted}`}>
                        Auto is unlimited on free. Upgrade to a paid plan to use premium models, Daytona, browser tasks, and generation tools.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className={`relative z-10 mt-auto border-t py-8 px-8 ${footBorder}`}>
        <div className={`mx-auto flex max-w-4xl items-center justify-between text-sm ${footMuted}`}>
          <p>© 2026 overlay</p>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className={isLandingDark ? 'transition-colors hover:text-zinc-100' : 'transition-colors hover:text-zinc-900'}
            >
              terms
            </Link>
            <Link
              href="/privacy"
              className={isLandingDark ? 'transition-colors hover:text-zinc-100' : 'transition-colors hover:text-zinc-900'}
            >
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
    <LandingThemeProvider>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center gradient-bg">
            <div className="liquid-glass" />
            <div className="relative z-10 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-zinc-400" />
              <p className="mt-4 text-zinc-500">Loading...</p>
            </div>
          </div>
        }
      >
        <AccountPageContent />
      </Suspense>
    </LandingThemeProvider>
  )
}
