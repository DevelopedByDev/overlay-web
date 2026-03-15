'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, BookOpen, Bot, LogOut, User, Smartphone, Puzzle, MessageCircle, Monitor } from 'lucide-react'
import type { AuthUser } from '@/lib/workos-auth'

const NAV_ITEMS = [
  { href: '/app/chat', label: 'Chats', icon: MessageSquare },
  { href: '/app/agent', label: 'Agents', icon: Bot },
  { href: '/app/notes', label: 'Notes', icon: BookOpen },
]

const APP_LINKS = [
  { label: 'Mobile App', icon: Smartphone },
  { label: 'Chrome Extension', icon: Puzzle },
  { label: 'Slack App', icon: MessageCircle },
  { label: 'Desktop App', icon: Monitor, href: 'https://getoverlay.io' },
]

export default function AppSidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname()
  const displayName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email

  async function handleSignOut() {
    await fetch('/api/auth/sign-out', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <aside className="w-56 h-full flex flex-col border-r border-[#e5e5e5] bg-[#fafafa]">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-[#e5e5e5] px-5">
        <Link href="/app/chat" className="flex items-center gap-2">
          <Image
            src="/assets/overlay-logo.png"
            alt="Overlay"
            width={24}
            height={24}
          />
          <span
            className="text-xl font-medium tracking-tight"
            style={{ fontFamily: 'var(--font-instrument-serif)' }}
          >
            overlay
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-[#0a0a0a] text-[#fafafa]'
                  : 'text-[#525252] hover:bg-[#f0f0f0] hover:text-[#0a0a0a]'
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[#e5e5e5] space-y-3">
        <div className="space-y-1">
          <p className="px-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#888]">
            Apps
          </p>
          <div className="space-y-1">
            {APP_LINKS.map(({ label, icon: Icon, href }) =>
              href ? (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-[#525252] hover:bg-[#f0f0f0] hover:text-[#0a0a0a] transition-colors"
                >
                  <Icon size={13} />
                  {label}
                </a>
              ) : (
                <button
                  key={label}
                  type="button"
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-[#a3a3a3] cursor-default"
                >
                  <Icon size={13} />
                  {label}
                </button>
              )
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-[#e5e5e5] flex items-center gap-1">
          <Link
            href="/account"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[#525252] transition-colors hover:bg-[#f0f0f0] hover:text-[#0a0a0a]"
          >
            <User size={13} />
            <span className="truncate">{displayName}</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="shrink-0 flex items-center rounded-md px-2 py-1.5 text-xs text-[#525252] transition-colors hover:bg-[#f0f0f0] hover:text-[#0a0a0a]"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
