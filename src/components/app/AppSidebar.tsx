'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  MessageSquare, BookOpen, Brain, Wrench, LogOut, User,
  Smartphone, Puzzle, Monitor, ChevronUp, AlertCircle,
  FolderOpen, Images, Loader2, Menu, X, ArrowUp,
} from 'lucide-react'
import type { AuthUser } from '@/lib/workos-auth'
import { useAsyncSessions } from '@/lib/async-sessions-store'
import { formatBytes } from '@/lib/storage-limits'
import ProjectsSidebar from './ProjectsSidebar'
import ToolsSidebar from './ToolsSidebar'

const NAV_ITEMS = [
  { href: '/app/projects', label: 'projects', icon: FolderOpen },
  { href: '/app/chat', label: 'chat', icon: MessageSquare },
  { href: '/app/outputs', label: 'outputs', icon: Images },
  { href: '/app/notes', label: 'notes', icon: BookOpen },
  { href: '/app/knowledge', label: 'knowledge', icon: Brain },
  { href: '/app/tools', label: 'tools', icon: Wrench },
]

const APP_LINKS = [
  { label: 'Mobile App', icon: Smartphone },
  { label: 'Chrome Extension', icon: Puzzle },
  { label: 'Desktop App', icon: Monitor, href: 'https://getoverlay.io' },
]

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
  dailyUsage: { ask: number; write: number; agent: number }
  overlayStorageBytesUsed: number
  overlayStorageBytesLimit: number
  fileBandwidthBytesUsed: number
  fileBandwidthBytesLimit: number
}

function UsageBar({ entitlements }: { entitlements: Entitlements | null }) {
  if (!entitlements) {
    return <p className="text-[11px] text-[#aaa]">Loading...</p>
  }

  const { tier, creditsUsed, creditsTotal } = entitlements

  if (tier === 'free') {
    return <p className="text-[11px] text-[#aaa]">Auto model messages are unlimited. Upgrade to Pro to use premium models and credits.</p>
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
      <div className="h-1 overflow-hidden rounded-full bg-[#e5e5e5]">
        <div
          className={`h-full rounded-full transition-all ${exhausted ? 'bg-red-400' : warning ? 'bg-amber-400' : 'bg-[#0a0a0a]'}`}
          style={{ width: `${remainingPctRaw}%` }}
        />
      </div>
    </div>
  )
}

function StorageUsageCaption({ entitlements, active }: { entitlements: Entitlements | null; active: boolean }) {
  if (!entitlements) return null
  const used = Math.max(0, entitlements.overlayStorageBytesUsed ?? 0)
  const limit = Math.max(0, entitlements.overlayStorageBytesLimit ?? 0)
  if (limit <= 0) return null
  const nearLimit = used / limit >= 0.85
  return (
    <div className={`mt-0.5 text-[10px] leading-none ${active ? 'text-[#fafafa]/70' : nearLimit ? 'text-[#b45309]' : 'text-[#9a9a9a]'}`}>
      Overlay storage {formatBytes(used)} / {formatBytes(limit)}
    </div>
  )
}

export default function AppSidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const displayName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email
  const { totalUnread } = useAsyncSessions()

  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const mobileAccountRef = useRef<HTMLDivElement>(null)

  const effectivePendingHref = pendingHref && !pathname.startsWith(pendingHref) ? pendingHref : null
  const projectsOpen = pathname.startsWith('/app/projects')
  const toolsOpen = pathname.startsWith('/app/tools')
  const loadEntitlements = useCallback(async () => {
    try {
      const res = await fetch('/api/app/subscription')
      if (res.ok) setEntitlements(await res.json())
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!accountMenuOpen && !mobileAccountOpen) return
    const initialId = window.setTimeout(() => { void loadEntitlements() }, 0)
    const intervalId = window.setInterval(() => { void loadEntitlements() }, 30_000)
    return () => {
      window.clearTimeout(initialId)
      window.clearInterval(intervalId)
    }
  }, [accountMenuOpen, mobileAccountOpen, loadEntitlements])

  useEffect(() => {
    function onSubscriptionRefresh() {
      void loadEntitlements()
    }
    window.addEventListener('overlay:subscription-refresh', onSubscriptionRefresh)
    return () => window.removeEventListener('overlay:subscription-refresh', onSubscriptionRefresh)
  }, [loadEntitlements])

  useEffect(() => {
    function onNavShortcut(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.ctrlKey || e.repeat) return
      const m = /^Digit([1-6])$/.exec(e.code)
      if (!m) return
      const idx = parseInt(m[1]!, 10) - 1
      const item = NAV_ITEMS[idx]
      if (!item) return
      const t = e.target
      if (t instanceof Node && (t as HTMLElement).closest?.('input, textarea, select, [contenteditable="true"]')) {
        return
      }
      e.preventDefault()
      if (pathname.startsWith(item.href)) return
      setPendingHref(item.href)
      router.push(item.href)
    }
    window.addEventListener('keydown', onNavShortcut, true)
    return () => window.removeEventListener('keydown', onNavShortcut, true)
  }, [pathname, router])

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

  useEffect(() => {
    if (!mobileAccountOpen) return
    function handleClick(e: MouseEvent) {
      if (mobileAccountRef.current && !mobileAccountRef.current.contains(e.target as Node)) {
        setMobileAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [mobileAccountOpen])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [mobileMenuOpen])

  async function handleSignOut() {
    await fetch('/api/auth/sign-out', { method: 'POST' })
    window.location.href = '/'
  }

  const brandLink = (
    <Link
      href="/app/chat"
      className="flex min-w-0 items-center gap-2"
      onClick={() => setMobileMenuOpen(false)}
    >
      <Image src="/assets/overlay-logo.png" alt="" width={24} height={24} className="shrink-0" />
      <span
        className="truncate text-xl font-medium tracking-tight"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        overlay
      </span>
    </Link>
  )

  /** Compact brand for the fixed mobile top bar (matches sidebar identity). */
  const mobileBrandLink = (
    <Link
      href="/app/chat"
      className="flex min-w-0 max-w-[calc(100vw-8rem)] items-center gap-2"
      onClick={() => setMobileMenuOpen(false)}
    >
      <Image src="/assets/overlay-logo.png" alt="" width={22} height={22} className="shrink-0" />
      <span
        className="truncate text-lg font-medium tracking-tight text-[#0a0a0a]"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        overlay
      </span>
    </Link>
  )

  const showUpgradeCta = !entitlements || entitlements.tier === 'free'

  const sidebarContent = (
    <>
      <div className="hidden h-16 items-center border-b border-[#e5e5e5] px-5 md:flex">
        {brandLink}
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }, navIdx) => {
          const active = effectivePendingHref ? effectivePendingHref === href : pathname.startsWith(href)
          const isPending = effectivePendingHref === href
          const unreadCount = href === '/app/chat' ? totalUnread : 0
          return (
            <button
              key={href}
              type="button"
              onClick={() => {
                if (pathname.startsWith(href)) return
                setMobileMenuOpen(false)
                setPendingHref(href)
                router.push(href)
              }}
              title={`${label} · ⌥${navIdx + 1}`}
              className={`group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-[#0a0a0a] text-[#fafafa]'
                  : 'text-[#525252] hover:bg-[#f0f0f0] hover:text-[#0a0a0a]'
              }`}
            >
              <Icon size={15} />
              <div className="min-w-0 flex-1 text-left">
                <div>{label}</div>
                {href === '/app/knowledge' ? <StorageUsageCaption entitlements={entitlements} active={active} /> : null}
              </div>
              <span
                className={`shrink-0 text-[10px] font-medium tabular-nums transition-opacity ${
                  active
                    ? 'text-[#fafafa]/70 opacity-0 group-hover:opacity-100'
                    : 'text-[#a3a3a3] opacity-0 group-hover:opacity-100'
                }`}
                aria-hidden
              >
                ⌥{navIdx + 1}
              </span>
              {isPending ? (
                <Loader2
                  size={14}
                  className={`shrink-0 animate-spin ${active ? 'text-[#fafafa]' : 'text-[#525252]'}`}
                  aria-hidden
                />
              ) : unreadCount > 0 ? (
                <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium ${
                  active ? 'bg-[#fafafa] text-[#0a0a0a]' : 'bg-[#0a0a0a] text-[#fafafa]'
                }`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="space-y-3 border-t border-[#e5e5e5] px-3 py-3">
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
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[#525252] transition-colors hover:bg-[#f0f0f0] hover:text-[#0a0a0a]"
                >
                  <Icon size={13} />
                  {label}
                </a>
              ) : (
                <button
                  key={label}
                  type="button"
                  className="flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[#a3a3a3]"
                >
                  <Icon size={13} />
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        <div ref={menuRef} className="relative border-t border-[#e5e5e5] pt-2">
          {accountMenuOpen && (
            <div
              className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-lg border border-[#e5e5e5] bg-white py-1 shadow-lg"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="px-3 py-2">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#aaa]">Usage</p>
                <UsageBar entitlements={entitlements} />
              </div>
              <div className="border-t border-[#f0f0f0]">
                <Link
                  href="/account"
                  onClick={() => {
                    setAccountMenuOpen(false)
                    setMobileMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#525252] transition-colors hover:bg-[#f5f5f5]"
                >
                  <User size={13} />
                  Account
                </Link>
                {showUpgradeCta && (
                  <Link
                    href="/account"
                    onClick={() => {
                      setAccountMenuOpen(false)
                      setMobileMenuOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-[#b45309] transition-colors hover:bg-[#fffbeb]"
                  >
                    <ArrowUp size={13} className="shrink-0" />
                    Upgrade
                  </Link>
                )}
              </div>
              <div className="border-t border-[#f0f0f0]">
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false)
                    void handleSignOut()
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#525252] transition-colors hover:bg-[#f5f5f5]"
                >
                  <LogOut size={13} />
                  Sign out
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setAccountMenuOpen((value) => !value)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[#525252] transition-colors hover:bg-[#f0f0f0] hover:text-[#0a0a0a]"
          >
            <User size={13} />
            <span className="flex-1 truncate text-left">{displayName}</span>
            <ChevronUp size={11} className={`shrink-0 transition-transform ${accountMenuOpen ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 border-b border-[#e5e5e5] bg-[#fafafa]/95 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open app navigation"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[#525252]"
          >
            <Menu size={16} />
          </button>
          <div className="flex min-w-0 flex-1 justify-center px-1">{mobileBrandLink}</div>
          <div className="relative shrink-0" ref={mobileAccountRef}>
            <button
              type="button"
              onClick={() => setMobileAccountOpen((o) => !o)}
              aria-label="Account menu"
              aria-expanded={mobileAccountOpen}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[#525252] transition-colors hover:bg-[#f5f5f5]"
            >
              <User size={16} />
            </button>
            {mobileAccountOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-lg border border-[#e5e5e5] bg-white py-1 shadow-lg"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="px-3 py-2">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#aaa]">Usage</p>
                  <UsageBar entitlements={entitlements} />
                </div>
                <div className="border-t border-[#f0f0f0]">
                  <Link
                    href="/account"
                    onClick={() => setMobileAccountOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-[#525252] transition-colors hover:bg-[#f5f5f5]"
                  >
                    <User size={13} />
                    Account
                  </Link>
                  {showUpgradeCta && (
                    <Link
                      href="/account"
                      onClick={() => setMobileAccountOpen(false)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold text-[#b45309] transition-colors hover:bg-[#fffbeb]"
                    >
                      <ArrowUp size={13} className="shrink-0" />
                      Upgrade
                    </Link>
                  )}
                </div>
                <div className="border-t border-[#f0f0f0]">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileAccountOpen(false)
                      void handleSignOut()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-[#525252] transition-colors hover:bg-[#f5f5f5]"
                  >
                    <LogOut size={13} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-[#e5e5e5] bg-[#fafafa] md:flex">
        {sidebarContent}
      </aside>

      <div className={`fixed inset-0 z-50 md:hidden ${mobileMenuOpen ? '' : 'pointer-events-none'}`}>
        <button
          type="button"
          aria-label="Close app navigation"
          onClick={() => setMobileMenuOpen(false)}
          className={`absolute inset-0 bg-black/30 transition-opacity ${mobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[82vw] max-w-[320px] flex-col border-r border-[#e5e5e5] bg-[#fafafa] shadow-[0_20px_80px_rgba(10,10,10,0.18)] transition-transform ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e5e5e5] px-4">
            <div className="min-w-0 flex-1">{brandLink}</div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close app navigation"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[#525252]"
            >
              <X size={16} />
            </button>
          </div>
          {sidebarContent}
        </aside>
      </div>

      <div className="hidden md:flex">
        {projectsOpen && <ProjectsSidebar />}
        {toolsOpen && <ToolsSidebar />}
      </div>
    </>
  )
}
