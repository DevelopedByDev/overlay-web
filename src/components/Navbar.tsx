'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, MotionValue, useTransform, useMotionValue } from 'framer-motion'
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
  const navShiftDistance = useMotionValue(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const navLinksRef = useRef<HTMLDivElement>(null)

  // Check auth state on mount
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

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    if (navLinksRef.current) {
      observer.observe(navLinksRef.current)
    }

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
    <nav className="fixed top-0 left-0 right-0 z-50 py-4 px-4 md:py-6 md:px-8">
      <div ref={containerRef} className="max-w-6xl mx-auto relative h-10">
        <motion.div
          style={{ opacity: logoOpacity, x: logoX, pointerEvents: logoPointerEvents }}
          className="absolute left-0 top-1/2 -translate-y-1/2"
        >
          <Link href="/home" className="flex items-center gap-2">
            <Image
              src="/assets/overlay-logo.png"
              alt="Overlay"
              width={28}
              height={28}
            />
            <span className="font-serif text-xl">overlay</span>
          </Link>
        </motion.div>

        <motion.div
          style={{ x: navLinksX, pointerEvents: 'auto' }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          {navLinks}
        </motion.div>
      </div>
    </nav>
  )
}

export function HeroLinks() {
  const [authState, setAuthState] = useState<AuthState>({ authenticated: false })

  // Check auth state on mount
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
    <div className="flex items-center gap-6 text-sm text-[#71717a]">
      <Link
        href="/manifesto"
        className="hover:text-[#0a0a0a] transition-colors duration-300"
      >
        manifesto
      </Link>
      <a
        href="https://github.com/DevelopedByDev/overlay-web"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-[#0a0a0a] transition-colors duration-300"
      >
        github
      </a>
      <Link
        href="/pricing"
        className="hover:text-[#0a0a0a] transition-colors duration-300"
      >
        pricing
      </Link>
      {authState.authenticated ? (
        <Link
          href="/account"
          className="hover:text-[#0a0a0a] transition-colors duration-300"
        >
          account
        </Link>
      ) : (
        <Link
          href="/auth/sign-in"
          className="hover:text-[#0a0a0a] transition-colors duration-300"
        >
          sign in
        </Link>
      )}
    </div>
  )
}
