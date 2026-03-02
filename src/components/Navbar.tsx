'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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
  const [isVisible, setIsVisible] = useState(false)

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

  // Track scroll position to show/hide navbar
  useEffect(() => {
    const checkVisibility = () => {
      const progress = scrollYProgress.get()
      setIsVisible(progress > 0.06)
    }
    
    // Check immediately
    checkVisibility()
    
    // Set up interval to check (since we can't directly subscribe to MotionValue in this way)
    const interval = setInterval(checkVisibility, 100)
    
    return () => clearInterval(interval)
  }, [scrollYProgress])

  if (!isVisible) return null

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
    >
      <div className="max-w-6xl mx-auto">
        <div className="backdrop-blur-xl bg-white/80 border border-[var(--border)] rounded-2xl px-6 py-3 flex items-center justify-between shadow-lg">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/assets/overlay-logo.png"
              alt="Overlay"
              width={28}
              height={28}
            />
            <span className="font-serif text-lg">overlay</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            <Link
              href="/manifesto"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              manifesto
            </Link>
            <a
              href="https://x.com/dsllwn/status/2015923879668044002"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              demo
            </a>
            <Link
              href="/pricing"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              pricing
            </Link>
            {authState.authenticated ? (
              <Link
                href="/account"
                className="text-sm px-4 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                account
              </Link>
            ) : (
              <Link
                href="/auth/sign-in"
                className="text-sm px-4 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
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
