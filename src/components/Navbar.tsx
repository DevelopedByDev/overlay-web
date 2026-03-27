'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, MotionValue, useTransform, useMotionValue } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

interface NavbarProps {
  scrollYProgress: MotionValue<number>
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

export function Navbar({ scrollYProgress }: NavbarProps) {
  const [authState, setAuthState] = useState<AuthState>({ authenticated: false })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navShiftDistance = useMotionValue(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const navLinksRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const updateMeasurements = () => {
      const containerWidth = containerRef.current?.offsetWidth ?? 0
      const navWidth = navLinksRef.current?.offsetWidth ?? 0
      const nextDistance = Math.max((containerWidth - navWidth) / 2, 0)
      navShiftDistance.set(nextDistance)
    }

    updateMeasurements()

    const observer = new ResizeObserver(updateMeasurements)

    if (containerRef.current) observer.observe(containerRef.current)
    if (navLinksRef.current) observer.observe(navLinksRef.current)

    window.addEventListener('resize', updateMeasurements)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateMeasurements)
    }
  }, [navShiftDistance])

  const navLayoutProgress = useTransform(scrollYProgress, [0, 0.06], [0, 1])
  const navLinksX = useTransform(() => navLayoutProgress.get() * navShiftDistance.get())
  const logoOpacity = useTransform(scrollYProgress, [0.028, 0.06], [0, 1])
  const logoX = useTransform(scrollYProgress, [0.028, 0.06], [-12, 0])
  const logoPointerEvents = useTransform(scrollYProgress, (value) => (value >= 0.03 ? 'auto' : 'none'))

  const linkClass = 'text-sm text-zinc-500 hover:text-zinc-900 transition-colors'
  const mobileLinkClass = 'block rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-base text-[#3f3f46] transition-colors hover:text-[#0a0a0a]'
  const appHref = authState.authenticated ? '/app/chat' : '/auth/sign-in?redirect=%2Fapp%2Fchat'

  const navLinks = (
    <div ref={navLinksRef} className="flex items-center gap-3 sm:gap-5 md:gap-6">
      <Link href={appHref} className={linkClass}>
        app
      </Link>
      <Link href="/manifesto" className={linkClass}>
        manifesto
      </Link>
      <a
        href="https://github.com/DevelopedByDev/overlay-web"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        github
      </a>
      <Link href="/pricing" className={linkClass}>
        pricing
      </Link>
      {authState.authenticated ? (
        <Link href="/account" className={linkClass}>
          account
        </Link>
      ) : (
        <Link href="/auth/sign-in" className={linkClass}>
          sign in
        </Link>
      )}
    </div>
  )

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 px-4 py-4 md:px-8 md:py-6">
      <div ref={containerRef} className="mx-auto h-10 max-w-6xl md:relative">
        <div className="flex h-full items-center justify-between rounded-full border border-[#e5e5e5] bg-white/85 px-4 shadow-[0_10px_30px_rgba(10,10,10,0.06)] backdrop-blur md:hidden">
          <Link href="/home" className="flex items-center gap-2">
            <Image src="/assets/overlay-logo.png" alt="Overlay" width={22} height={22} />
            <span className="font-serif text-lg">overlay</span>
          </Link>
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e5e5] text-[#52525b]"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="mt-3 rounded-[28px] border border-[#e5e5e5] bg-[#fafafa]/95 p-3 shadow-[0_24px_64px_rgba(10,10,10,0.12)] backdrop-blur md:hidden">
            <div className="grid gap-2">
              <Link href={appHref} className={mobileLinkClass} onClick={() => setMobileMenuOpen(false)}>
                app
              </Link>
              <Link href="/manifesto" className={mobileLinkClass} onClick={() => setMobileMenuOpen(false)}>
                manifesto
              </Link>
              <a
                href="https://github.com/DevelopedByDev/overlay-web"
                target="_blank"
                rel="noopener noreferrer"
                className={mobileLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                github
              </a>
              <Link href="/pricing" className={mobileLinkClass} onClick={() => setMobileMenuOpen(false)}>
                pricing
              </Link>
              <Link
                href={authState.authenticated ? '/account' : '/auth/sign-in'}
                className="block rounded-2xl bg-[#0a0a0a] px-4 py-3 text-base text-white transition-colors hover:bg-[#27272a]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {authState.authenticated ? 'account' : 'sign in'}
              </Link>
            </div>
          </div>
        ) : null}

        <motion.div
          style={{ opacity: logoOpacity, x: logoX, pointerEvents: logoPointerEvents }}
          className="absolute left-0 top-1/2 hidden -translate-y-1/2 md:block"
        >
          <Link href="/home" className="flex items-center gap-2">
            <Image src="/assets/overlay-logo.png" alt="Overlay" width={28} height={28} />
            <span className="font-serif text-xl">overlay</span>
          </Link>
        </motion.div>

        <motion.div
          style={{ x: navLinksX, pointerEvents: 'auto' }}
          className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block"
        >
          {navLinks}
        </motion.div>
      </div>
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
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#71717a]">
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
