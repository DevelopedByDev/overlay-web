'use client'

import { useState, useEffect } from 'react'
import { MotionValue } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

interface NavbarProps {
  scrollYProgress: MotionValue<number>
  /** Marketing /home only — theme toggle + chrome */
  landingTheme?: 'light' | 'dark'
  onLandingThemeToggle?: () => void
  navLogoOpacity?: MotionValue<number>
  navLogoX?: MotionValue<number>
}

interface AuthState {
  authenticated: boolean
  user?: {
    id: string
    email: string
    firstName?: string
    lastName?: string
  }
}

export function Navbar({
  landingTheme = 'light',
  onLandingThemeToggle,
}: NavbarProps) {
  const [authState, setAuthState] = useState<AuthState>({ authenticated: false })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/session')
        const contentType = response.headers.get('content-type') || ''
        if (!response.ok || !contentType.includes('application/json')) {
          setAuthState({ authenticated: false })
          return
        }
        const data = await response.json()
        setAuthState(data)
      } catch {
        setAuthState({ authenticated: false })
      }
    }
    checkAuth()
  }, [])

  const isDark = landingTheme === 'dark'
  const appHref = authState.authenticated ? '/app/chat' : '/auth/sign-in?redirect=%2Fapp%2Fchat'

  const navBg = isDark ? 'bg-[#0a0a0a]' : 'bg-[#fafafa]'
  const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200'
  const linkClass = isDark
    ? 'text-sm text-zinc-400 transition-colors hover:text-zinc-100'
    : 'text-sm text-zinc-500 transition-colors hover:text-zinc-900'
  const logoClass = isDark ? 'font-serif text-lg text-zinc-100' : 'font-serif text-lg text-zinc-900'

  return (
    <nav className={`fixed left-0 right-0 top-0 z-50 border-b ${borderColor} ${navBg} font-serif`}>
      {/* Desktop */}
      <div className="mx-auto hidden max-w-6xl items-center justify-between px-8 py-4 md:flex">
        <Link href="/home" className="flex items-center gap-2.5">
          <Image src="/assets/overlay-logo.png" alt="Overlay" width={22} height={22} />
          <span className={logoClass}>overlay</span>
        </Link>

        <div className="flex items-center gap-6">
          <Link href={appHref} className={linkClass}>app</Link>
          <Link href="/manifesto" className={linkClass}>manifesto</Link>
          <a
            href="https://github.com/DevelopedByDev/overlay-web"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            github
          </a>
          <Link href="/pricing" className={linkClass}>pricing</Link>
          {authState.authenticated ? (
            <Link href="/account" className={linkClass}>account</Link>
          ) : (
            <Link href="/auth/sign-in" className={linkClass}>sign in</Link>
          )}
          {onLandingThemeToggle ? (
            <button type="button" onClick={onLandingThemeToggle} className={linkClass}>
              {landingTheme === 'light' ? 'dark' : 'light'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between px-4 py-3 md:hidden">
        <Link href="/home" className="flex items-center gap-2">
          <Image src="/assets/overlay-logo.png" alt="Overlay" width={20} height={20} />
          <span className={logoClass}>overlay</span>
        </Link>
        <button
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMobileMenuOpen((v) => !v)}
          className={`overlay-interactive inline-flex h-9 w-9 items-center justify-center border ${borderColor} ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className={`border-t ${borderColor} ${navBg} md:hidden`}>
          <div className="flex flex-col px-4 py-2">
            {[
              { href: appHref, label: 'app' },
              { href: '/manifesto', label: 'manifesto' },
              { href: '/pricing', label: 'pricing' },
            ].map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={`border-b py-3 text-base ${borderColor} ${isDark ? 'text-zinc-300 hover:text-zinc-100' : 'text-zinc-600 hover:text-zinc-900'} transition-colors`}
              >
                {label}
              </Link>
            ))}
            <a
              href="https://github.com/DevelopedByDev/overlay-web"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className={`border-b py-3 text-base ${borderColor} ${isDark ? 'text-zinc-300 hover:text-zinc-100' : 'text-zinc-600 hover:text-zinc-900'} transition-colors`}
            >
              github
            </a>
            <Link
              href={authState.authenticated ? '/account' : '/auth/sign-in'}
              onClick={() => setMobileMenuOpen(false)}
              className={`border-b py-3 text-base ${borderColor} ${isDark ? 'text-zinc-300 hover:text-zinc-100' : 'text-zinc-600 hover:text-zinc-900'} transition-colors`}
            >
              {authState.authenticated ? 'account' : 'sign in'}
            </Link>
            {onLandingThemeToggle ? (
              <button
                type="button"
                onClick={() => { onLandingThemeToggle(); setMobileMenuOpen(false); }}
                className={`py-3 text-left text-base ${isDark ? 'text-zinc-300 hover:text-zinc-100' : 'text-zinc-600 hover:text-zinc-900'} transition-colors`}
              >
                {landingTheme === 'light' ? 'dark' : 'light'}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </nav>
  )
}

export function HeroLinks() {
  const [authState, setAuthState] = useState<AuthState>({ authenticated: false })

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/session')
        const contentType = response.headers.get('content-type') || ''
        if (!response.ok || !contentType.includes('application/json')) {
          setAuthState({ authenticated: false })
          return
        }
        const data = await response.json()
        setAuthState(data)
      } catch {
        setAuthState({ authenticated: false })
      }
    }
    checkAuth()
  }, [])

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-serif text-sm text-[#71717a]">
      <Link href="/manifesto" className="transition-colors duration-300 hover:text-[#0a0a0a]">
        manifesto
      </Link>
      <a
        href="https://github.com/DevelopedByDev/overlay-web"
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors duration-300 hover:text-[#0a0a0a]"
      >
        github
      </a>
      <Link href="/pricing" className="transition-colors duration-300 hover:text-[#0a0a0a]">
        pricing
      </Link>
      {authState.authenticated ? (
        <Link href="/account" className="transition-colors duration-300 hover:text-[#0a0a0a]">
          account
        </Link>
      ) : (
        <Link href="/auth/sign-in" className="transition-colors duration-300 hover:text-[#0a0a0a]">
          sign in
        </Link>
      )}
    </div>
  )
}
