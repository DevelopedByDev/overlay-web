'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'

interface NavbarProps {
  scrollYProgress: { get: () => number }
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
  const [isPastHero, setIsPastHero] = useState(false)

  // Check auth state on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()
        setAuthState(data)
      } catch {
        setAuthState({ authenticated: false })
      }
    }
    checkAuth()
  }, [])

  // Track scroll position to change navbar layout
  useEffect(() => {
    const checkPosition = () => {
      const progress = scrollYProgress.get()
      setIsPastHero(progress > 0.06)
    }
    
    // Check immediately
    checkPosition()
    
    // Set up interval to check
    const interval = setInterval(checkPosition, 50)
    
    return () => clearInterval(interval)
  }, [scrollYProgress])

  const linkClass = 'text-sm text-zinc-500 hover:text-zinc-900 transition-colors'
  const navLinks = (
    <div className="flex items-center gap-6">
      <Link href="/manifesto" className={linkClass}>
        manifesto
      </Link>
      <a
        href="https://x.com/dsllwn/status/2015923879668044002"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        demo
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
    <nav className="fixed top-0 left-0 right-0 z-50 py-6 px-8">
      <div className="max-w-6xl mx-auto relative h-10">
        <AnimatePresence>
          {isPastHero && (
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.3 }}
              className="absolute left-0 top-1/2 -translate-y-1/2"
            >
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/assets/overlay-logo.png"
                  alt="Overlay"
                  width={28}
                  height={28}
                />
                <span className="font-serif text-xl">overlay</span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={false}
          animate={{ opacity: isPastHero ? 0 : 1, x: isPastHero ? 120 : 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          style={{ pointerEvents: isPastHero ? 'none' : 'auto' }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          {navLinks}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -120 }}
          animate={{ opacity: isPastHero ? 1 : 0, x: isPastHero ? 0 : -120 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          style={{ pointerEvents: isPastHero ? 'auto' : 'none' }}
          className="absolute right-0 top-1/2 -translate-y-1/2"
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
        href="https://x.com/dsllwn/status/2015923879668044002"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-[#0a0a0a] transition-colors duration-300"
      >
        demo
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
