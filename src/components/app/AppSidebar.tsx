'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  MessageSquare, BookOpen, Bot, Brain, Wrench, LogOut, User,
  Smartphone, Puzzle, MessageCircle, Monitor, ChevronUp, AlertCircle,
  FolderOpen, Cpu, Images,
} from 'lucide-react'
import type { AuthUser } from '@/lib/workos-auth'
import { useAsyncSessions } from '@/lib/async-sessions-store'
import ProjectsSidebar from './ProjectsSidebar'
import ToolsSidebar from './ToolsSidebar'
import ComputerSidebar from './ComputerSidebar'

const NAV_ITEMS = [
  { href: '/app/projects', label: 'Projects', icon: FolderOpen },
  { href: '/app/chat', label: 'Chat', icon: MessageSquare },
  { href: '/app/outputs', label: 'Outputs', icon: Images },
  { href: '/app/notes', label: 'Notes', icon: BookOpen },
  { href: '/app/knowledge', label: 'Knowledge', icon: Brain },
  { href: '/app/tools', label: 'Tools', icon: Wrench },
  { href: '/app/computer', label: 'Computer', icon: Cpu },
]

const APP_LINKS = [
  { label: 'Mobile App', icon: Smartphone },
  { label: 'Chrome Extension', icon: Puzzle },
  { label: 'Slack App', icon: MessageCircle },
  { label: 'Desktop App', icon: Monitor, href: 'https://getoverlay.io' },
]

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
  dailyUsage: { ask: number; write: number; agent: number }
}

function UsageBar({ entitlements }: { entitlements: Entitlements | null }) {
  if (!entitlements) {
    return <p className="text-[11px] text-[#aaa]">Loading...</p>
  }

  const { tier, creditsUsed, creditsTotal, dailyUsage } = entitlements

  if (tier === 'free') {
    const used = dailyUsage.ask + dailyUsage.write + dailyUsage.agent
    const pct = Math.min(100, Math.round((used / 15) * 100))
    const exhausted = used >= 15
    const warning = pct >= 80
    return (
      <div className={`flex flex-col gap-1 text-xs ${exhausted ? 'text-red-500' : warning ? 'text-amber-500' : 'text-[#aaa]'}`}>
        <div className="flex items-center justify-between">
          <span>{used}/15 weekly messages</span>
          {exhausted && <AlertCircle size={11} />}
        </div>
        <div className="h-1 rounded-full bg-[#e5e5e5] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${exhausted ? 'bg-red-400' : warning ? 'bg-amber-400' : 'bg-[#0a0a0a]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {exhausted && <span className="text-red-500 font-medium text-[10px]">Limit reached — upgrade to Pro</span>}
      </div>
    )
  }

  const creditsTotalCents = creditsTotal * 100
  if (creditsTotalCents <= 0) return <p className="text-[11px] text-[#aaa]">No credit limit set</p>
  const usedPctRaw = Math.min(100, (creditsUsed / creditsTotalCents) * 100)
  const remainingPctRaw = Math.max(0, 100 - usedPctRaw)
  const exhausted = remainingPctRaw <= 0
  const warning = usedPctRaw >= 80

  return (
    <div className={`flex flex-col gap-1 text-xs ${exhausted ? 'text-red-500' : warning ? 'text-amber-500' : 'text-[#aaa]'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="tabular-nums">
          {remainingPctRaw.toFixed(1)}% remaining
          <span className="text-[10px] opacity-70"> · {usedPctRaw.toFixed(1)}% used</span>
        </span>
        {exhausted && <AlertCircle size={11} />}
      </div>
      <div className="h-1 rounded-full bg-[#e5e5e5] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${exhausted ? 'bg-red-400' : warning ? 'bg-amber-400' : 'bg-[#0a0a0a]'}`}
          style={{ width: `${remainingPctRaw}%` }}
        />
      </div>
    </div>
  )
}

export default function AppSidebar({ user, accessToken }: { user: AuthUser; accessToken: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const displayName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email
  const { totalUnread } = useAsyncSessions()

  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const effectivePendingHref = pendingHref && !pathname.startsWith(pendingHref) ? pendingHref : null

  const projectsOpen = pathname.startsWith('/app/projects')
  const toolsOpen = pathname.startsWith('/app/tools')
  const computerOpen = pathname.startsWith('/app/computer')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const loadEntitlements = useCallback(async () => {
    try {
      const res = await fetch('/api/app/subscription')
      if (res.ok) setEntitlements(await res.json())
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!accountMenuOpen) return
    const initialId = window.setTimeout(() => { void loadEntitlements() }, 0)
    const intervalId = window.setInterval(() => { void loadEntitlements() }, 30_000)
    return () => {
      window.clearTimeout(initialId)
      window.clearInterval(intervalId)
    }
  }, [accountMenuOpen, loadEntitlements])

  useEffect(() => {
    function onSubscriptionRefresh() {
      void loadEntitlements()
    }
    window.addEventListener('overlay:subscription-refresh', onSubscriptionRefresh)
    return () => window.removeEventListener('overlay:subscription-refresh', onSubscriptionRefresh)
  }, [loadEntitlements])

  // Close menu on outside click
  useEffect(() => {
    if (!accountMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [accountMenuOpen])

  async function handleSignOut() {
    await fetch('/api/auth/sign-out', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <>
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
          const active = effectivePendingHref ? effectivePendingHref === href : pathname.startsWith(href)
          const isPending = effectivePendingHref === href
          const unreadCount = href === '/app/chat' ? totalUnread : 0
          return (
            <button
              key={href}
              type="button"
              onClick={() => {
                if (pathname.startsWith(href)) return
                setPendingHref(href)
                router.push(href)
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-[#0a0a0a] text-[#fafafa]'
                  : 'text-[#525252] hover:bg-[#f0f0f0] hover:text-[#0a0a0a]'
              }`}
            >
              <Icon size={15} />
              <span className="flex-1 text-left">{label}</span>
              {isPending ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[#fafafa]/30 border-t-[#fafafa] animate-spin shrink-0" />
              ) : unreadCount > 0 ? (
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-medium ${
                  active ? 'bg-[#fafafa] text-[#0a0a0a]' : 'bg-[#0a0a0a] text-[#fafafa]'
                }`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </button>
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

        {/* Account button with popover */}
        <div ref={menuRef} className="relative pt-2 border-t border-[#e5e5e5]">
          {/* Account menu popover */}
          {accountMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-[#e5e5e5] rounded-lg shadow-lg py-1 z-50">
              <Link
                href="/account"
                onClick={() => setAccountMenuOpen(false)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors"
              >
                <User size={13} />
                Account
              </Link>
              <div className="px-3 py-2 border-t border-[#f0f0f0]">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#aaa] mb-2">Usage</p>
                <UsageBar entitlements={entitlements} />
              </div>
              <div className="border-t border-[#f0f0f0]">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors"
                >
                  <LogOut size={13} />
                  Sign out
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-[#525252] hover:bg-[#f0f0f0] hover:text-[#0a0a0a] transition-colors"
          >
            <User size={13} />
            <span className="flex-1 truncate text-left">{displayName}</span>
            <ChevronUp size={11} className={`shrink-0 transition-transform ${accountMenuOpen ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>
    </aside>
    {projectsOpen && <ProjectsSidebar />}
    {toolsOpen && <ToolsSidebar />}
    {computerOpen && <ComputerSidebar userId={user.id} accessToken={accessToken} />}
    </>
  )
}
