'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PageNavbar } from '@/components/PageNavbar'

function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingVerification, setPendingVerification] = useState(false)
  const [sessionCleared, setSessionCleared] = useState(false)
  const [clearingSession, setClearingSession] = useState(false)

  // Get redirect URL from params (for desktop app auth)
  const redirectUrl = searchParams?.get('redirect') || '/account'
  const forceLogin = searchParams?.get('force') === 'true'
  const isDesktopAuth = redirectUrl.startsWith('overlay://')

  // Check for error in URL params
  useEffect(() => {
    const errorParam = searchParams?.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
  }, [searchParams])

  // Auto sign-out existing session when coming from desktop app
  // This ensures the user starts fresh and can sign in with any account
  useEffect(() => {
    if ((isDesktopAuth || forceLogin) && !sessionCleared && !clearingSession) {
      setClearingSession(true)
      const signOutExisting = async () => {
        try {
          console.log('[SignIn] Clearing existing session for desktop auth...')
          await fetch('/api/auth/sign-out', { method: 'POST' })
          console.log('[SignIn] Session cleared successfully')
        } catch (error) {
          console.error('[SignIn] Failed to clear session:', error)
        } finally {
          setSessionCleared(true)
          setClearingSession(false)
        }
      }
      signOutExisting()
    }
  }, [isDesktopAuth, forceLogin, sessionCleared, clearingSession])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setPendingVerification(false)

    try {
      const response = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (data.pendingEmailVerification) {
        setPendingVerification(true)
        setError(data.error)
        return
      }

      if (!response.ok) {
        setError(data.error || 'Sign in failed')
        return
      }

      // Success - redirect
      if (redirectUrl.startsWith('overlay://')) {
        window.location.href = redirectUrl
      } else {
        router.push(redirectUrl)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSSO = (provider: 'google' | 'apple' | 'microsoft') => {
    setSsoLoading(provider)
    // Pass force=true when coming from desktop to ensure OAuth shows sign-in screen
    const forceParam = isDesktopAuth || forceLogin ? '&force=true' : ''
    const ssoUrl = `/api/auth/sso/${provider}?redirect=${encodeURIComponent(redirectUrl)}${forceParam}`
    window.location.href = ssoUrl
  }

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      <div className="liquid-glass" />

      {/* Header */}
      <PageNavbar />

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="glass-dark rounded-2xl p-8">
            <h1 className="text-2xl font-serif text-center mb-2">Welcome back</h1>
            <p className="text-sm text-[var(--muted)] text-center mb-8">
              Sign in to your overlay account
            </p>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
                {error}
                {pendingVerification && (
                  <Link
                    href={`/auth/verify-email?email=${encodeURIComponent(email)}`}
                    className="block mt-2 text-red-600 hover:text-red-700 underline"
                  >
                    Resend verification email
                  </Link>
                )}
              </div>
            )}

            {/* SSO Buttons */}
            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleSSO('google')}
                disabled={ssoLoading !== null}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-sm font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {ssoLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
              </button>

              <button
                onClick={() => handleSSO('apple')}
                disabled={ssoLoading !== null}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-sm font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                {ssoLoading === 'apple' ? 'Redirecting...' : 'Continue with Apple'}
              </button>

              <button
                onClick={() => handleSSO('microsoft')}
                disabled={ssoLoading !== null}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-sm font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#F25022" d="M1 1h10v10H1z" />
                  <path fill="#00A4EF" d="M1 13h10v10H1z" />
                  <path fill="#7FBA00" d="M13 1h10v10H13z" />
                  <path fill="#FFB900" d="M13 13h10v10H13z" />
                </svg>
                {ssoLoading === 'microsoft' ? 'Redirecting...' : 'Continue with Microsoft'}
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-[var(--background)] text-[var(--muted)]">
                  or continue with email
                </span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-sm font-medium">
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[var(--foreground)] text-[var(--background)] rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            {/* Sign Up Link */}
            <p className="mt-6 text-center text-sm text-[var(--muted)]">
              Don&apos;t have an account?{' '}
              <Link
                href={`/auth/sign-up${redirectUrl !== '/account' ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`}
                className="text-[var(--foreground)] hover:underline font-medium"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 px-8 text-center text-sm text-[var(--muted)]">
        <p>© 2026 overlay</p>
      </footer>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen gradient-bg flex items-center justify-center">
          <div className="liquid-glass" />
          <div className="relative z-10 text-center">
            <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-[var(--muted)]">Loading...</p>
          </div>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  )
}
