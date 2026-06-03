'use client'

import { Suspense, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MarketingNavbar } from '@/features/marketing/components/MarketingNavbar'
import { LandingThemeProvider } from '@/contexts/LandingThemeContext'

type AuthPageChromeProps = {
  children: ReactNode
  footer?: boolean
}

export function SimpleAuthPageChrome({
  children,
  footer = true,
}: AuthPageChromeProps) {
  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      <div className="liquid-glass" />

      <header className="relative z-10 py-6 px-8">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image
            src="/assets/overlay-logo.png"
            alt="Overlay"
            width={32}
            height={32}
          />
          <span className="text-xl font-serif">overlay</span>
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        {children}
      </main>

      {footer ? (
        <footer className="relative z-10 py-6 px-8 text-center text-sm text-[var(--muted)]">
          <p>© 2026 overlay</p>
        </footer>
      ) : null}
    </div>
  )
}

type LandingAuthPageChromeProps = {
  children: ReactNode
  footerClassName?: string
  mainClassName?: string
  footer?: boolean
}

export function LandingAuthPageChrome({
  children,
  footer = true,
  footerClassName = 'relative z-10 mt-auto flex justify-center border-t px-8 py-6 text-sm sm:justify-start',
  mainClassName = 'relative z-10 flex-1 flex items-center justify-center px-6 py-12',
}: LandingAuthPageChromeProps) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--background)] text-[var(--foreground)]">
      <MarketingNavbar />

      <main className={mainClassName}>{children}</main>

      {footer ? (
        <footer className={footerClassName}>
          <p>© 2026 overlay</p>
        </footer>
      ) : null}
    </div>
  )
}

export function AuthLoadingScreen({
  tone = 'landing',
}: {
  tone?: 'landing' | 'simple'
}) {
  const spinnerClass =
    tone === 'simple'
      ? 'w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin mx-auto'
      : 'mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted)] border-t-transparent'
  const textClass = 'mt-4 text-[var(--muted)]'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
      <div className="relative z-10 text-center">
        <div className={spinnerClass} />
        <p className={textClass}>Loading...</p>
      </div>
    </div>
  )
}

export function LandingAuthBoundary({ children }: { children: ReactNode }) {
  return (
    <LandingThemeProvider>
      <Suspense fallback={<AuthLoadingScreen tone="landing" />}>
        {children}
      </Suspense>
    </LandingThemeProvider>
  )
}
