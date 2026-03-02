'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export function PageNavbar() {
  const { isAuthenticated } = useAuth()

  return (
    <header className="relative z-10 py-6 px-8">
      <nav className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/assets/overlay-logo.png"
            alt="Overlay"
            width={28}
            height={28}
          />
          <span className="font-serif text-xl">overlay</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
          <Link
            href="/manifesto"
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            manifesto
          </Link>
          <a
            href="https://x.com/dsllwn/status/2015923879668044002"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            demo
          </a>
          <Link
            href="/pricing"
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            pricing
          </Link>
          {isAuthenticated ? (
            <Link
              href="/account"
              className="text-sm px-4 py-2 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
            >
              account
            </Link>
          ) : (
            <Link
              href="/auth/sign-in"
              className="text-sm px-4 py-2 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
            >
              sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
