'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export function PageNavbar() {
  const { isAuthenticated } = useAuth()
  const linkClass = 'text-sm text-zinc-500 hover:text-zinc-900 transition-colors'
  const appHref = isAuthenticated ? '/app/chat' : '/auth/sign-in?redirect=%2Fapp%2Fchat'

  return (
    <header className="relative z-10 py-6 px-8">
      <nav className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/home" className="flex items-center gap-2">
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
          {isAuthenticated ? (
            <Link href="/account" className={linkClass}>
              account
            </Link>
          ) : (
            <Link href="/auth/sign-in" className={linkClass}>
              sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
