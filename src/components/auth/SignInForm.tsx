'use client'

import { useState } from 'react'

interface SignInFormProps {
  redirectTo: string
  onClose?: () => void
}

export function SignInForm({ redirectTo, onClose }: SignInFormProps) {
  const [ssoLoading, setSsoLoading] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  function handleSSO(provider: 'google' | 'apple' | 'microsoft') {
    setSsoLoading(provider)
    window.location.href = `/api/auth/sso/${provider}?redirect=${encodeURIComponent(redirectTo)}`
  }

  function handleEmailContinue() {
    if (email.trim()) {
      sessionStorage.setItem('overlay_signin_email', email.trim())
    }
    const dest = `/auth/sign-in?redirect=${encodeURIComponent(redirectTo)}`
    window.location.href = dest
  }

  const ssoBtn =
    'w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 border bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-subtle)]'

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => handleSSO('google')}
        disabled={ssoLoading !== null}
        className={ssoBtn}
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {ssoLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <button
        type="button"
        onClick={() => handleSSO('apple')}
        disabled={ssoLoading !== null}
        className={ssoBtn}
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
        {ssoLoading === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
      </button>

      <button
        type="button"
        onClick={() => handleSSO('microsoft')}
        disabled={ssoLoading !== null}
        className={ssoBtn}
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
          <path fill="#F25022" d="M1 1h10v10H1z" />
          <path fill="#00A4EF" d="M1 13h10v10H1z" />
          <path fill="#7FBA00" d="M13 1h10v10H13z" />
          <path fill="#FFB900" d="M13 13h10v10H13z" />
        </svg>
        {ssoLoading === 'microsoft' ? 'Redirecting…' : 'Continue with Microsoft'}
      </button>

      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--border)]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-[var(--surface-elevated)] text-[var(--muted)]">or</span>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleEmailContinue() }}
          placeholder="Enter your email"
          className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--muted)] transition-colors"
        />
        <button
          type="button"
          onClick={handleEmailContinue}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-elevated)] whitespace-nowrap"
        >
          Continue
        </button>
      </div>

      {onClose && (
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
