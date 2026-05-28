'use client'

// Compatibility wrapper: account and billing transport lives behind @overlay/api-client
// while this web container keeps current billing flows and redirects unchanged.
import { useState, useEffect, Suspense, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { RefreshCw, ArrowRight } from 'lucide-react'
import { AccountBillingPanel } from '@/features/billing/components/AccountBillingPanel'
import { DeleteAccountSection } from '@/features/account/components/DeleteAccountSection'
import { useAccountBillingState } from '@/features/account/hooks/useAccountBillingState'
import { useAuth } from '@/contexts/AuthContext'
import { LandingThemeProvider, useLandingTheme } from '@/contexts/LandingThemeContext'
import { PageNavbar } from '@/components/layout/PageNavbar'
import { overlayAppClient } from '@/shared/app/overlay-app-client'
import {
  getStoredDesktopPkceChallenge,
  persistMobilePkceChallengeFromUrl,
} from '@/shared/auth/mobile-auth-client'
import {
  marketingBody,
  marketingHeading,
  marketingMuted,
  marketingPageTitle,
  marketingPanel,
  marketingPanelLg,
} from '@/features/landing/lib/landingPageStyles'
import {
  AccountContinueCard,
  AccountLoadingState,
  AccountMessageBanner,
  AccountPageFrame,
  AccountProfileCard,
  AccountSignInPrompt,
} from '@overlay/modules-react/settings'

// Always use overlay:// for deep links (registered in WorkOS for both environments)
const APP_PROTOCOL = 'overlay'
const PKCE_CHALLENGE_RE = /^[A-Za-z0-9._~-]{43,128}$/

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
  const desktopCodeChallenge = searchParams?.get('desktop_code_challenge')?.trim() || getStoredDesktopPkceChallenge() || ''
  const extensionHandoff = searchParams?.get('extension_handoff') === '1'
  const chromeExtensionIdRaw = searchParams?.get('chrome_extension_id')?.trim() || ''
  const extensionHandoffSentRef = useRef(false)

  // Get userId from AuthContext (session-based)
  const { user, isLoading: authLoading, isAuthenticated, signOut, refreshSession } = useAuth()
  const currentUserId = user?.id || null
  const [signingOut, setSigningOut] = useState(false)
  const [sessionCheckComplete, setSessionCheckComplete] = useState(false)
  const {
    actionLoading,
    autoTopUpEnabledDraft,
    billingEnabled,
    billingSettings,
    capabilitiesLoaded,
    entitlements,
    entitlementsError,
    handleManageBilling,
    handleStartTopUp,
    handleTopUpPreferenceSave,
    loading,
    message,
    retryEntitlements,
    setActionLoading,
    setAutoTopUpEnabledDraft,
    setMessage,
    setTopUpAmountDraftCents,
    topUpAmountDraftCents,
    topUpHistory,
  } = useAccountBillingState({
    authLoading,
    currentUserId,
    isAuthenticated,
    router,
    searchParams,
  })

  useEffect(() => {
    persistMobilePkceChallengeFromUrl(searchParams)
  }, [searchParams])

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
        const response = await overlayAppClient.account.desktopLinkResponse({
          codeChallenge: desktopCodeChallenge,
          chromeExtensionId: chromeExtensionIdRaw,
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
    setMessage,
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

  // Handler for manual "Open in App" button
  // This generates a deep link with auth tokens so the desktop app signs in with the current account
  const handleOpenInApp = async () => {
    setActionLoading('openApp')
    try {
      const codeChallenge = desktopCodeChallenge.trim()
      if (!PKCE_CHALLENGE_RE.test(codeChallenge)) {
        console.warn('[Account] Missing desktop auth handshake; opening desktop app without session transfer')
        triggerDeepLink(`${APP_PROTOCOL}://subscription-updated`)
        return
      }

      const response = await overlayAppClient.account.desktopLinkResponse({ codeChallenge })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        console.error('[Account] Failed to generate desktop link', {
          status: response.status,
          error: errorBody,
        })
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

  return (
    <AccountPageFrame
      header={<PageNavbar />}
      footerBorderClass={footBorder}
      footerMutedClass={footMuted}
      dark={isLandingDark}
      footer={
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
      }
    >
      {message ? (
        <AccountMessageBanner
          message={message}
          onOpenDesktop={handleOpenInApp}
          onOpenWeb={() => router.push('/app/chat')}
          onDismiss={() => setMessage(null)}
        />
      ) : null}

      <h1 className={`text-3xl font-serif md:text-4xl mb-8 ${t.title}`}>Account</h1>

      {loading || authLoading || !sessionCheckComplete || !capabilitiesLoaded ? (
        <AccountLoadingState mutedClass={t.muted} dark={isLandingDark} />
      ) : !isAuthenticated ? (
        <AccountSignInPrompt
          panelClass={panelLg}
          headingClass={t.h}
          mutedClass={t.muted}
          action={
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
          }
        />
      ) : (
        <div className="space-y-6">
          <AccountProfileCard
            panelClass={panel}
            headingClass={t.h}
            mutedClass={t.muted}
            dark={isLandingDark}
            name={user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email}
            email={user?.email}
            actions={
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
            }
          />

          <AccountContinueCard
            panelClass={panel}
            mutedClass={t.muted}
            bodyClass={t.body}
            actions={
              <>
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
              </>
            }
          />

          <AccountBillingPanel
            actionLoading={actionLoading}
            autoTopUpEnabledDraft={autoTopUpEnabledDraft}
            billingEnabled={billingEnabled}
            billingSettings={billingSettings}
            dark={isLandingDark}
            entitlements={entitlements}
            entitlementsError={entitlementsError}
            headingClass={t.h}
            mutedClass={t.muted}
            onManageBilling={handleManageBilling}
            onRetryEntitlements={retryEntitlements}
            onSaveTopUpPreference={handleTopUpPreferenceSave}
            onStartTopUp={handleStartTopUp}
            panelClass={panel}
            setAutoTopUpEnabledDraft={setAutoTopUpEnabledDraft}
            setTopUpAmountDraftCents={setTopUpAmountDraftCents}
            topUpAmountDraftCents={topUpAmountDraftCents}
            topUpHistory={topUpHistory}
          />
        </div>
      )}
    </AccountPageFrame>
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
