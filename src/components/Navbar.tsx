'use client'

import { useState, useEffect } from 'react'
import { MotionValue } from 'framer-motion'
import { Menu, Monitor, Moon, Star, Sun, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { LANDING_THEME_STORAGE_KEY } from '@/lib/landingThemeConstants'

interface NavbarProps {
  scrollYProgress?: MotionValue<number>
  /** Landing page only — called when effective theme changes */
  onThemeChange?: (theme: 'light' | 'dark') => void
  /** Initial theme (from parent's persisted state, avoids flash) */
  initialTheme?: 'light' | 'dark'
}

interface AuthState {
  authenticated: boolean
}

type ThemeMode = 'light' | 'dark' | 'system'

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function Navbar({ onThemeChange, initialTheme = 'light' }: NavbarProps) {
  const [authState, setAuthState] = useState<AuthState>({ authenticated: false })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>('light')
  const [stars, setStars] = useState<number | null>(null)

  // Init theme from localStorage
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANDING_THEME_STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') {
        setThemeMode(stored)
      } else if (stored === 'system' || !stored) {
        setThemeMode('system')
      }
    } catch { /* ignore */ }
  }, [])

  // Derive effective theme from mode
  const getEffectiveTheme = (mode: ThemeMode): 'light' | 'dark' => {
    if (mode === 'system') {
      try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      } catch {
        return 'light'
      }
    }
    return mode
  }

  // Notify parent when theme changes
  useEffect(() => {
    const effective = getEffectiveTheme(themeMode)
    onThemeChange?.(effective)

    try {
      if (themeMode === 'system') {
        window.localStorage.removeItem(LANDING_THEME_STORAGE_KEY)
      } else {
        window.localStorage.setItem(LANDING_THEME_STORAGE_KEY, themeMode)
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode])

  // Also listen to system preference changes when in 'system' mode
  useEffect(() => {
    if (themeMode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => onThemeChange?.(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode])

  const cycleTheme = () => {
    setThemeMode(prev => {
      if (prev === 'light') return 'dark'
      if (prev === 'dark') return 'system'
      // 'system': jump to opposite of current effective so first click is always visible
      return getEffectiveTheme('system') === 'light' ? 'dark' : 'light'
    })
  }

  // Auth check
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/session')
        const contentType = response.headers.get('content-type') || ''
        if (!response.ok || !contentType.includes('application/json')) return
        const data = await response.json()
        setAuthState(data)
      } catch { /* ignore */ }
    }
    checkAuth()
  }, [])

  // GitHub stars
  useEffect(() => {
    fetch('https://api.github.com/repos/DevelopedByDev/overlay-web')
      .then(r => r.json())
      .then(d => { if (typeof d.stargazers_count === 'number') setStars(d.stargazers_count) })
      .catch(() => { /* ignore */ })
  }, [])

  // Use initialTheme for SSR-safe rendering until useEffect fires
  const isDark = initialTheme === 'dark'
  const appHref = authState.authenticated ? '/app/chat' : '/auth/sign-in?redirect=%2Fapp%2Fchat'

  const navBg = isDark ? 'bg-[#0a0a0a]' : 'bg-[#fafafa]'
  const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200'
  const linkClass = isDark
    ? 'text-sm text-zinc-400 transition-colors hover:text-zinc-100'
    : 'text-sm text-zinc-500 transition-colors hover:text-zinc-900'
  const logoClass = isDark ? 'font-serif text-lg text-zinc-100' : 'font-serif text-lg text-zinc-900'
  const iconClass = isDark ? 'h-4 w-4 text-zinc-400' : 'h-4 w-4 text-zinc-500'

  const ThemeIcon = themeMode === 'light' ? Sun : themeMode === 'dark' ? Moon : Monitor

  const navLinks = [
    { href: appHref, label: 'app' },
    { href: '/manifesto', label: 'manifesto' },
    { href: '/pricing', label: 'pricing' },
    { href: authState.authenticated ? '/account' : '/auth/sign-in', label: authState.authenticated ? 'account' : 'sign in' },
  ]

  return (
    <nav className={`fixed left-0 right-0 top-0 z-50 border-b ${borderColor} ${navBg} font-serif`}>
      {/* Desktop */}
      <div className="relative mx-auto hidden max-w-6xl items-center justify-between px-8 py-4 md:flex">
        {/* Left: Logo */}
        <Link href="/home" className="flex items-center gap-2.5">
          <Image src="/assets/overlay-logo.png" alt="Overlay" width={22} height={22} />
          <span className={logoClass}>overlay</span>
        </Link>

        {/* Center: Nav links (absolutely centered) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6">
          {navLinks.map(({ href, label }) => (
            <Link key={label} href={href} className={linkClass}>{label}</Link>
          ))}
        </div>

        {/* Right: GitHub stars + theme toggle */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/DevelopedByDev/overlay-web"
            target="_blank"
            rel="noopener noreferrer"
            className={`overlay-interactive inline-flex items-center gap-1.5 border px-3 py-1.5 ${borderColor} ${linkClass}`}
          >
            <Star className={iconClass} />
            {stars !== null && <span className="text-xs">{formatStars(stars)}</span>}
          </a>
          <button
            type="button"
            onClick={cycleTheme}
            aria-label="Toggle theme"
            className={`overlay-interactive inline-flex items-center justify-center border p-2 ${borderColor}`}
          >
            <ThemeIcon className={iconClass} />
          </button>
        </div>
      </div>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between px-4 py-3 md:hidden">
        <Link href="/home" className="flex items-center gap-2">
          <Image src="/assets/overlay-logo.png" alt="Overlay" width={20} height={20} />
          <span className={logoClass}>overlay</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycleTheme}
            aria-label="Toggle theme"
            className={`overlay-interactive inline-flex items-center justify-center border p-2 ${borderColor}`}
          >
            <ThemeIcon className={iconClass} />
          </button>
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileMenuOpen(v => !v)}
            className={`overlay-interactive inline-flex h-9 w-9 items-center justify-center border ${borderColor} ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className={`border-t ${borderColor} ${navBg} md:hidden`}>
          <div className="flex flex-col px-4 py-2">
            {navLinks.map(({ href, label }) => (
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
              className={`flex items-center gap-2 py-3 text-base ${isDark ? 'text-zinc-300 hover:text-zinc-100' : 'text-zinc-600 hover:text-zinc-900'} transition-colors`}
            >
              <Star className="h-4 w-4" />
              {stars !== null ? `${formatStars(stars)} stars` : 'github'}
            </a>
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
        if (!response.ok || !contentType.includes('application/json')) return
        const data = await response.json()
        setAuthState(data)
      } catch { /* ignore */ }
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
