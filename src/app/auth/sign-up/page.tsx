'use client'

import { useState, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PageNavbar } from '@/components/PageNavbar'
import { LandingThemeProvider, useLandingTheme } from '@/contexts/LandingThemeContext'
import { sanitizeClientAuthRedirect } from '@/lib/auth-redirect'
import {
  persistMobilePkceChallengeFromUrl,
  resolveCodeChallengeForSso,
} from '@/lib/mobile-auth-client'
import {
  marketingAuthCard,
  marketingAuthMuted,
  marketingDividerLabel,
  marketingPrimaryField,
  marketingSsoButton,
  marketingSubmitButton,
} from '@/lib/landingPageStyles'

function SignUpContent() {
  const { isLandingDark } = useLandingTheme()
  const card = marketingAuthCard(isLandingDark)
  const muted = marketingAuthMuted(isLandingDark)
  const sso = marketingSsoButton(isLandingDark)
  const field = marketingPrimaryField(isLandingDark)
  const submit = marketingSubmitButton(isLandingDark)
  const divLabel = marketingDividerLabel(isLandingDark)
  const labelText = isLandingDark ? 'text-zinc-300' : 'text-zinc-900'
  const createLink = isLandingDark ? 'text-zinc-100 hover:underline font-medium' : 'text-zinc-900 hover:underline font-medium'
  const searchParams = useSearchParams()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [verificationTicket, setVerificationTicket] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [verified, setVerified] = useState(false)

  // Get redirect URL from params (for desktop app auth)
  const redirectUrl = sanitizeClientAuthRedirect(searchParams?.get('redirect'))

  useEffect(() => {
    persistMobilePkceChallengeFromUrl(searchParams)
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Sign up failed')
        return
      }

      // Store userId for verification and show verification UI
      if (typeof data.verificationTicket === 'string' && data.verificationTicket.trim()) {
        setVerificationTicket(data.verificationTicket)
      }
      setSuccess(true)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verificationTicket || !verificationCode) return

    setVerifying(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: verificationTicket, code: verificationCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid verification code')
        return
      }

      setVerified(true)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setVerifying(false)
    }
  }

  const handleResendCode = async () => {
    if (!verificationTicket) return

    setResending(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: verificationTicket, action: 'resend' }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to resend code')
        return
      }

      // Show success briefly
      setError(null)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setResending(false)
    }
  }

  const handleSSO = (provider: 'google' | 'apple' | 'microsoft') => {
    setSsoLoading(provider)
    const codeChallenge = resolveCodeChallengeForSso(searchParams)
    const pkceParam = codeChallenge
      ? `&codeChallenge=${encodeURIComponent(codeChallenge)}`
      : ''
    const ssoUrl = `/api/auth/sso/${provider}?redirect=${encodeURIComponent(redirectUrl)}${pkceParam}`
    window.location.href = ssoUrl
  }

  if (success) {
    // Show verified success screen
    if (verified) {
      return (
        <div className="flex min-h-screen w-full flex-col gradient-bg">
          <div className="liquid-glass" />
          <PageNavbar />
          <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
            <div className="w-full max-w-md">
              <div className={`${card} text-center`}>
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-8 h-8 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h1 className={`text-2xl font-serif mb-2 ${labelText}`}>Email verified!</h1>
                <p className={`mb-6 ${muted}`}>
                  Your account has been verified. You can now sign in.
                </p>
                <Link
                  href={`/auth/sign-in${redirectUrl !== '/account' ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`}
                  className={
                    isLandingDark
                      ? 'inline-block rounded-xl bg-zinc-100 px-8 py-3 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90'
                      : 'inline-block rounded-xl bg-zinc-900 px-8 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90'
                  }
                >
                  Sign in
                </Link>
              </div>
            </div>
          </main>
        </div>
      )
    }

    // Show verification code input
    return (
      <div className="flex min-h-screen w-full flex-col gradient-bg">
        <div className="liquid-glass" />
        <PageNavbar />
        <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className={`${card} text-center`}>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-8 h-8 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h1 className={`text-2xl font-serif mb-2 ${labelText}`}>Check your email</h1>
              <p className={`mb-6 ${muted}`}>
                We&apos;ve sent a verification code to{' '}
                <strong className={labelText}>{email}</strong>.
                Enter the code below to verify your account.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className={`${field} text-center text-lg font-mono tracking-widest`}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={verifying || verificationCode.length < 6}
                  className={submit}
                >
                  {verifying ? 'Verifying...' : 'Verify email'}
                </button>
              </form>

              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-(--muted)">
                <span>Didn&apos;t receive the code?</span>
                <button
                  onClick={handleResendCode}
                  disabled={resending}
                  className="text-foreground hover:underline font-medium disabled:opacity-50"
                >
                  {resending ? 'Sending...' : 'Resend'}
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-(--border)">
                <Link
                  href="/auth/sign-in"
                  className="text-sm text-(--muted) hover:text-foreground"
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full flex-col gradient-bg">
      <div className="liquid-glass" />

      {/* Header */}
      <PageNavbar />

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className={card}>
            <h1 className={`text-2xl font-serif text-center mb-2 ${labelText}`}>Create your account</h1>
            <p className={`text-sm text-center mb-8 ${muted}`}>
              Start your journey with overlay
            </p>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
                {error}
              </div>
            )}

            {/* SSO Buttons */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => handleSSO('google')}
                disabled={ssoLoading !== null}
                className={sso}
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
                type="button"
                onClick={() => handleSSO('apple')}
                disabled={ssoLoading !== null}
                className={sso}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                {ssoLoading === 'apple' ? 'Redirecting...' : 'Continue with Apple'}
              </button>

              <button
                type="button"
                onClick={() => handleSSO('microsoft')}
                disabled={ssoLoading !== null}
                className={sso}
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
                <div
                  className={`w-full border-t ${isLandingDark ? 'border-zinc-700' : 'border-zinc-200'}`}
                />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className={divLabel}>or create with email</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className={`block text-sm font-medium mb-2 ${labelText}`}>
                    First name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={field}
                    placeholder="John"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className={`block text-sm font-medium mb-2 ${labelText}`}>
                    Last name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={field}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className={`block text-sm font-medium mb-2 ${labelText}`}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={field}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className={`block text-sm font-medium mb-2 ${labelText}`}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className={field}
                  placeholder="••••••••"
                />
                <p className={`mt-1 text-xs ${muted}`}>
                  Must be at least 8 characters
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-2 ${labelText}`}>
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={field}
                  placeholder="••••••••"
                />
              </div>

              <button type="submit" disabled={loading} className={submit}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            {/* Terms */}
            <p className={`mt-4 text-center text-xs ${muted}`}>
              By creating an account, you agree to our{' '}
              <Link href="/terms" className={`underline ${isLandingDark ? 'hover:text-zinc-100' : 'hover:text-zinc-900'}`}>
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className={`underline ${isLandingDark ? 'hover:text-zinc-100' : 'hover:text-zinc-900'}`}>
                Privacy Policy
              </Link>
            </p>

            <p className={`mt-6 text-center text-sm ${muted}`}>
              Already have an account?{' '}
              <Link
                href={`/auth/sign-in${redirectUrl !== '/account' ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`}
                className={createLink}
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className={`relative z-10 mt-auto flex justify-center border-t px-8 py-6 text-sm sm:justify-start ${
          isLandingDark ? 'border-zinc-800 text-zinc-500' : 'border-zinc-200 text-zinc-500'
        }`}
      >
        <p>© 2026 overlay</p>
      </footer>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <LandingThemeProvider>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center gradient-bg">
            <div className="liquid-glass" />
            <div className="relative z-10 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              <p className="mt-4 text-zinc-500">Loading...</p>
            </div>
          </div>
        }
      >
        <SignUpContent />
      </Suspense>
    </LandingThemeProvider>
  )
}
