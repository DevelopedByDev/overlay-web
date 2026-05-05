'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  MessageSquare, FileText, LogOut, User,
  Puzzle, Monitor, Smartphone, Chrome, ChevronUp, AlertCircle, Plug, Sparkles, Server, Package,
  FolderOpen, Loader2, Menu, X, ArrowUp, Settings, ChevronDown, ChevronLeft, ChevronRight, Search,
  Workflow,
} from 'lucide-react'
import type { AuthUser } from '@/lib/workos-auth'
import { useAuth } from '@/contexts/AuthContext'
import { useGuestGate } from './GuestGateProvider'
import { useAsyncSessions } from '@/lib/async-sessions-store'
import { readNewChatModelFieldsFromStorage } from '@/lib/chat-model-prefs'
import { dispatchChatCreated } from '@/lib/chat-title'
import { upsertCachedChat } from '@/lib/chat-list-cache'
import { useAppSettings } from './AppSettingsProvider'
import { formatBytes } from '@/lib/storage-limits'
import {
  AutomationsInlinePanel,
  ChatInlinePanel,
  FilesInlinePanel,
  InlineNavChildren,
  ProjectsInlinePanel,
  toolsInlineItems,
} from './AppSidebarInlinePanels'
import ProjectsSidebar from './ProjectsSidebar'
import ToolsSidebar from './ToolsSidebar'

const NAV_ITEMS: Array<{
  href?: string
  label: string
  icon: LucideIcon
  disabled?: boolean
}> = [
  { href: '/app/chat', label: 'Chat', icon: MessageSquare },
  { href: '/app/files', label: 'Files', icon: FileText },
  { href: '/app/tools', label: 'Extensions', icon: Puzzle },
  { href: '/app/projects', label: 'Projects', icon: FolderOpen },
  { href: '/app/automations', label: 'Automations', icon: Workflow },
]

const PROFILE_APP_LINKS = [
  { label: 'Desktop App', icon: Monitor },
  { label: 'Mobile App', icon: Smartphone },
  { label: 'Chrome Extension', icon: Chrome },
] as const

const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'account', label: 'Account' },
  { id: 'customization', label: 'Customization' },
  { id: 'memories', label: 'Memories' },
  { id: 'models', label: 'Models' },
  { id: 'contact', label: 'Contact' },
] as const

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'overlay:app-sidebar-collapsed'
const SIDEBAR_COLLAPSED_EVENT = 'overlay:sidebar-collapsed-change'

function getSidebarCollapsedSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function subscribeToSidebarCollapsed(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const onStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_COLLAPSED_STORAGE_KEY) onStoreChange()
  }
  const onLocalChange = () => onStoreChange()

  window.addEventListener('storage', onStorage)
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onLocalChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onLocalChange)
  }
}

function setStoredSidebarCollapsed(next: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? 'true' : 'false')
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT))
  } catch {
    // ignore
  }
}

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  planKind?: 'free' | 'paid'
  creditsUsed: number
  creditsTotal: number
  budgetUsedCents?: number
  budgetTotalCents?: number
  budgetRemainingCents?: number
  dailyUsage: { ask: number; write: number; agent: number }
  overlayStorageBytesUsed: number
  overlayStorageBytesLimit: number
}

function UsageBar({ entitlements }: { entitlements: Entitlements | null }) {
  if (!entitlements) {
    return <p className="text-[11px] text-[var(--muted-light)]">Loading...</p>
  }

  const { tier } = entitlements
  const planKind = entitlements.planKind ?? (tier === 'free' ? 'free' : 'paid')
  const budgetUsedCents = entitlements.budgetUsedCents ?? entitlements.creditsUsed
  const budgetTotalCents = entitlements.budgetTotalCents ?? entitlements.creditsTotal * 100

  if (planKind === 'free') {
    return <p className="text-[11px] text-[var(--muted-light)]">Auto model messages are unlimited. Upgrade to a paid plan to use premium models and budgeted tools.</p>
  }

  if (budgetTotalCents <= 0) return <p className="text-[11px] text-[#aaa]">No budget limit set</p>
  const usedPctRaw = Math.min(100, (budgetUsedCents / budgetTotalCents) * 100)
  const remainingPctRaw = Math.max(0, 100 - usedPctRaw)
  const exhausted = remainingPctRaw <= 0
  const warning = usedPctRaw >= 80

  return (
    <div className={`flex flex-col gap-1 text-xs ${exhausted ? 'text-red-500' : warning ? 'text-amber-500' : 'text-[var(--muted-light)]'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="tabular-nums">
          {remainingPctRaw.toFixed(1)}% remaining
          <span className="text-[10px] opacity-70">
            {' '}· ${ (budgetUsedCents / 100).toFixed(2)} / ${(budgetTotalCents / 100).toFixed(2)}
          </span>
        </span>
        {exhausted && <AlertCircle size={11} />}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className={`h-full rounded-full transition-all ${exhausted ? 'bg-red-400' : warning ? 'bg-amber-400' : 'bg-[var(--foreground)]'}`}
          style={{ width: `${remainingPctRaw}%` }}
        />
      </div>
    </div>
  )
}

function StorageBar({ entitlements }: { entitlements: Entitlements | null }) {
  if (!entitlements) {
    return <p className="text-[11px] text-[var(--muted-light)]">Loading...</p>
  }

  const usedBytes = Math.max(0, entitlements.overlayStorageBytesUsed)
  const limitBytes = Math.max(0, entitlements.overlayStorageBytesLimit)
  const remainingBytes = Math.max(0, limitBytes - usedBytes)
  const usedPct = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0
  const warning = usedPct >= 80
  const exhausted = limitBytes > 0 && remainingBytes <= 0

  return (
    <div className={`flex flex-col gap-1 text-xs ${exhausted ? 'text-red-500' : warning ? 'text-amber-500' : 'text-[var(--muted-light)]'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="tabular-nums">{formatBytes(remainingBytes)} available</span>
        <span className="shrink-0 text-[10px] opacity-70 tabular-nums">
          {formatBytes(usedBytes)} / {formatBytes(limitBytes)}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className={`h-full rounded-full transition-all ${exhausted ? 'bg-red-400' : warning ? 'bg-amber-400' : 'bg-[var(--foreground)]'}`}
          style={{ width: `${usedPct}%` }}
        />
      </div>
    </div>
  )
}

export default function AppSidebar({ user: serverUser }: { user: AuthUser | null }) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const searchParams = useSearchParams()
  const { settings } = useAppSettings()
  const { requireAuth } = useGuestGate()
  const { user: authUser, isLoading: authLoading } = useAuth()
  // Prefer server-resolved user; fall back to client auth. Never gate while loading.
  const user = serverUser ?? authUser
  const isGuestConfirmed = !authLoading && !user
  const displayName = user ? (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email) : 'Guest'
  const { totalUnread } = useAsyncSessions()

  const [pendingNav, setPendingNav] = useState<{ href: string; fromPath: string } | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false)
  const sidebarCollapsed = useSyncExternalStore(
    subscribeToSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    () => false,
  )
  const [chatPanelRefreshKey, setChatPanelRefreshKey] = useState(0)
  const [projectsPanelRefreshKey, setProjectsPanelRefreshKey] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const mobileAccountRef = useRef<HTMLDivElement>(null)

  const effectivePendingHref =
    pendingNav && pathname === pendingNav.fromPath ? pendingNav.href : null
  const projectsOpen = pathname.startsWith('/app/projects')
  const notesOpen = pathname.startsWith('/app/notes')
  const filesOpen = pathname.startsWith('/app/files')
  const filesSectionOpen = filesOpen || notesOpen
  const chatOpen = pathname.startsWith('/app/chat')
  const toolsOpen = pathname.startsWith('/app/tools')
  const automationsOpen = pathname.startsWith('/app/automations')
  const settingsPathActive = pathname.startsWith('/app/settings')
  const settingsSection = searchParams?.get('section') ?? 'general'
  const inlineSecondaryDisabled = !settings.useSecondarySidebar
  const toolsView = (() => {
    const current = searchParams?.get('view')
    if (current === 'skills') return 'skills'
    if (current === 'mcps') return 'mcps'
    if (current === 'apps') return 'apps'
    if (current === 'installed') return 'installed'
    return 'connectors'
  })()
  const loadEntitlements = useCallback(async () => {
    try {
      const res = await fetch('/api/app/subscription')
      if (res.ok) setEntitlements(await res.json())
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEntitlements()
  }, [loadEntitlements])

  useEffect(() => {
    if (!accountMenuOpen && !mobileAccountOpen && !filesSectionOpen) return
    const intervalId = window.setInterval(() => { void loadEntitlements() }, 30_000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [accountMenuOpen, mobileAccountOpen, filesSectionOpen, loadEntitlements])

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
      const t = e.target
      if (t instanceof Node && (t as HTMLElement).closest?.('input, textarea, select, [contenteditable="true"]')) {
        return
      }
      if (e.code === 'Digit7') {
        e.preventDefault()
        if (pathname.startsWith('/app/settings')) return
        if (isGuestConfirmed) { requireAuth('settings'); return }
        setMobileMenuOpen(false)
        setPendingNav({ href: '/app/settings', fromPath: pathname })
        router.push('/app/settings')
        return
      }
      const m = /^Digit([1-6])$/.exec(e.code)
      if (!m) return
      const idx = parseInt(m[1]!, 10) - 1
      const item = NAV_ITEMS[idx]
      if (!item || item.disabled || !item.href) return
      e.preventDefault()
      if (pathname.startsWith(item.href)) return
      if (isGuestConfirmed && item.href !== '/app/chat') { requireAuth('nav'); return }
      setPendingNav({ href: item.href, fromPath: pathname })
      router.push(item.href)
    }
    window.addEventListener('keydown', onNavShortcut, true)
    return () => window.removeEventListener('keydown', onNavShortcut, true)
  }, [pathname, router, user, isGuestConfirmed, requireAuth])

  /** Sub-items only while the settings route is open (avoids orphan dropdown state off-route). */
  const settingsNavExpanded = settingsPathActive

  useEffect(() => {
    if (!accountMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [accountMenuOpen])

  useEffect(() => {
    if (!mobileAccountOpen) return
    function handleClick(e: MouseEvent) {
      if (mobileAccountRef.current && !mobileAccountRef.current.contains(e.target as Node)) {
        setMobileAccountOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
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

  async function handleCreateChat() {
    if (!user) { requireAuth('send'); return }
    const models = readNewChatModelFieldsFromStorage()
    const res = await fetch('/api/app/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Chat',
        askModelIds: models.askModelIds,
        actModelId: models.actModelId,
        lastMode: models.lastMode,
      }),
    })
    if (!res.ok) return
    const data = await res.json() as { id?: string; conversation?: { _id: string; title: string; lastModified: number } }
    if (!data.id) return
    const chat = data.conversation ?? { _id: data.id, title: 'New Chat', lastModified: 0 }
    upsertCachedChat(chat)
    dispatchChatCreated({ chat })
    setChatPanelRefreshKey((value) => value + 1)
    setMobileMenuOpen(false)
    router.push(`/app/chat?id=${encodeURIComponent(data.id)}`)
  }

  async function handleCreateNote() {
    if (!user) { requireAuth('nav'); return }
    const res = await fetch('/api/app/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'note', name: 'Untitled', textContent: '' }),
    })
    if (!res.ok) return
    const data = await res.json() as { id?: string; file?: { _id: string; name?: string; content?: string; textContent?: string; createdAt?: number; updatedAt?: number } }
    if (!data.id) return
    const file = data.file
    window.dispatchEvent(new CustomEvent('overlay:notes-changed', {
      detail: {
        note: {
          _id: data.id,
          title: file?.name || 'Untitled',
          content: file?.textContent ?? file?.content ?? '',
          tags: [],
          createdAt: file?.createdAt ?? 0,
          updatedAt: file?.updatedAt ?? 0,
        },
      },
    }))
    window.dispatchEvent(new CustomEvent('overlay:files-changed'))
    setMobileMenuOpen(false)
    router.push(`/app/notes?id=${encodeURIComponent(data.id)}`)
  }

  async function handleCreateProject() {
    if (!user) { requireAuth('nav'); return }
    const res = await fetch('/api/app/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Untitled Project' }),
    })
    if (!res.ok) return
    setProjectsPanelRefreshKey((value) => value + 1)
    setMobileMenuOpen(false)
    router.push('/app/projects')
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

  const desktopBrandControl = sidebarCollapsed ? (
    <button
      type="button"
      onClick={() => setStoredSidebarCollapsed(false)}
      className="group inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-subtle)]"
      aria-label="Expand sidebar"
      title="Expand sidebar"
    >
      <Image src="/assets/overlay-logo.png" alt="" width={24} height={24} className="shrink-0 group-hover:hidden" />
      <ChevronRight size={16} className="hidden text-[var(--foreground)] group-hover:block" />
    </button>
  ) : (
    brandLink
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
        className="truncate text-lg font-medium tracking-tight text-[var(--foreground)]"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        overlay
      </span>
    </Link>
  )

  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false)
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('')

  /** Hide until loaded so paid users never see a flash of the upgrade CTA. */
  const showUpgradeCta = entitlements !== null && entitlements.tier === 'free'
  const contextualAction = inlineSecondaryDisabled
      ? chatOpen
        ? { label: 'New chat', onClick: handleCreateChat }
      : filesSectionOpen
          ? { label: 'New File', onClick: handleCreateNote }
        : projectsOpen
          ? { label: 'New project', onClick: handleCreateProject }
          : automationsOpen
            ? { label: 'New automation', onClick: () => router.push('/app/automations?new=1') }
            : null
    : null
  const hasInlineChildren = (href?: string) =>
    inlineSecondaryDisabled && href === '/app/tools'

  const sidebarContent = (
    <>
      <div
        className={`hidden h-16 min-h-16 shrink-0 items-center border-b border-[var(--border)] md:flex ${
          sidebarCollapsed ? 'justify-center px-4' : 'justify-between px-5'
        }`}
      >
        {desktopBrandControl}
        {!sidebarCollapsed ? (
          <button
            type="button"
            onClick={() => {
              setAccountMenuOpen(false)
              setStoredSidebarCollapsed(true)
            }}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
          >
            <ChevronLeft size={16} />
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <nav className="shrink-0 space-y-0.5 px-2 py-3">
          {NAV_ITEMS.map((item, navIdx) => {
            const { href, label, icon: Icon, disabled } = item
            const active =
              href &&
              (effectivePendingHref
                ? effectivePendingHref === href
                : href === '/app/files'
                  ? filesSectionOpen
                  : pathname.startsWith(href))
            const isPending = href && effectivePendingHref === href
            const unreadCount = href === '/app/chat' ? totalUnread : 0
            const shortcut = navIdx < 9 ? navIdx + 1 : null
            const showShortcut = Boolean(shortcut) && !active
            const showChevron = hasInlineChildren(href)
            const commonClass = `group flex h-9 w-full items-center rounded-md px-3 text-sm transition-colors ${
              disabled
                ? 'cursor-not-allowed text-[var(--muted-light)]'
                : active
                  ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
            } ${sidebarCollapsed ? 'justify-center' : 'gap-2.5'}`
            if (disabled) {
              return (
                <button
                  key={label}
                  type="button"
                  disabled
                  title="Coming soon"
                  aria-label={`${label} (coming soon)`}
                  className={commonClass}
                >
                  <Icon size={15} />
                  {!sidebarCollapsed ? <div className="min-w-0 flex-1 text-left">{label}</div> : null}
                </button>
              )
            }
            return (
              <div key={href}>
                <button
                  type="button"
                  onClick={() => {
                    if (!href || pathname.startsWith(href)) return
                    if (isGuestConfirmed && href !== '/app/chat') {
                      requireAuth('nav')
                      return
                    }
                    setMobileMenuOpen(false)
                    setPendingNav({ href, fromPath: pathname })
                    router.push(href)
                  }}
                  title={shortcut ? `${label} · ⌥${shortcut}` : label}
                  aria-label={label}
                  data-tour={href === '/app/chat' ? 'nav-chat' : href === '/app/files' ? 'nav-knowledge' : href === '/app/tools' ? 'nav-extensions' : undefined}
                  className={commonClass}
                >
                  {sidebarCollapsed && isPending ? (
                    <Loader2 size={14} className="shrink-0 animate-spin text-[var(--muted)]" aria-hidden />
                  ) : (
                    <Icon size={15} />
                  )}
                  {!sidebarCollapsed ? (
                    <div className="min-w-0 flex-1 text-left">
                      <div>{label}</div>
                    </div>
                  ) : null}
                  {!sidebarCollapsed && showShortcut ? (
                    <span
                      className={`shrink-0 text-[10px] font-medium tabular-nums transition-opacity ${
                        active
                          ? 'text-[var(--muted)] opacity-100'
                          : 'text-[var(--muted-light)] opacity-0 group-hover:opacity-100'
                      }`}
                      aria-hidden
                    >
                      ⌥{shortcut}
                    </span>
                  ) : null}
                  {!sidebarCollapsed && showChevron ? (
                    <span
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-opacity ${
                        active
                          ? 'text-[var(--muted)] opacity-100'
                          : 'text-[var(--muted-light)] opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
                      }`}
                      aria-hidden
                    >
                      <ChevronDown
                        size={13}
                        className={`transition-transform ${active ? '' : '-rotate-90'}`}
                      />
                    </span>
                  ) : null}
                  {!sidebarCollapsed && isPending ? (
                    <Loader2
                      size={14}
                      className="shrink-0 animate-spin text-[var(--muted)]"
                      aria-hidden
                    />
                  ) : !sidebarCollapsed && unreadCount > 0 ? (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--border)] text-[9px] font-medium text-[var(--foreground)]">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : null}
                </button>
                {!sidebarCollapsed && inlineSecondaryDisabled && href === '/app/tools' && active ? (
                  <InlineNavChildren
                    items={toolsInlineItems}
                    activeId={toolsView}
                    onSelect={(next) => {
                      setMobileMenuOpen(false)
                      router.push(`/app/tools?view=${next}`)
                    }}
                  />
                ) : null}
                {sidebarCollapsed && inlineSecondaryDisabled && href === '/app/tools' && active ? (
                  <div className="mx-2 mt-1 flex flex-col overflow-hidden rounded-md border border-[var(--border)]">
                    {([{ id: 'connectors', Icon: Plug, label: 'Connectors', locked: false }, { id: 'skills', Icon: Sparkles, label: 'Skills', locked: false }, { id: 'mcps', Icon: Server, label: 'MCPs', locked: false }, { id: 'apps', Icon: Package, label: 'Apps', locked: true }] as const).map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        title={sub.locked ? `${sub.label} · Soon` : sub.label}
                        aria-label={sub.label}
                        disabled={sub.locked}
                        onClick={() => {
                          if (sub.locked) return
                          router.push(`/app/tools?view=${sub.id}`)
                        }}
                        className={`flex h-8 items-center justify-center transition-colors ${
                          sub.locked
                            ? 'cursor-default text-[var(--muted-light)]'
                            : toolsView === sub.id
                              ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                              : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        <sub.Icon size={13} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
          <div className="mt-0.5">
            <button
              type="button"
              onClick={() => {
                if (settingsPathActive) return
                if (!user) { requireAuth('settings'); return }
                setMobileMenuOpen(false)
                setPendingNav({ href: '/app/settings', fromPath: pathname })
                router.push('/app/settings')
              }}
              title="Settings · ⌥7"
              aria-label="Settings"
              className={`group flex h-9 w-full items-center rounded-md px-3 text-sm transition-colors ${
                settingsPathActive
                  ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
              } ${sidebarCollapsed ? 'justify-center' : 'gap-2.5'}`}
            >
              <Settings size={15} />
              {!sidebarCollapsed ? <div className="min-w-0 flex-1 text-left">Settings</div> : null}
              {!sidebarCollapsed ? (
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-light)] opacity-0 transition-opacity group-hover:opacity-100 ${
                    settingsNavExpanded ? '' : '-rotate-90'
                  }`}
                  aria-hidden
                >
                  <ChevronDown size={13} />
                </span>
              ) : null}
            </button>
            {!sidebarCollapsed && settingsNavExpanded ? (
              <div className="mt-1 space-y-0.5 pl-7">
                {SETTINGS_SECTIONS.map(({ id, label }) => {
                  const active = settingsPathActive && settingsSection === id
                  return (
                    <Link
                      key={id}
                      href={`/app/settings?section=${id}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex w-full items-center rounded-md px-3 py-1.5 text-xs transition-colors ${
                        active
                          ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                          : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      <span className="flex-1 text-left">{label}</span>
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>
        </nav>

        {!sidebarCollapsed && inlineSecondaryDisabled && (chatOpen || filesSectionOpen || projectsOpen || automationsOpen) ? (
          <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--border)] px-2 py-3">
            {contextualAction && (chatOpen || filesSectionOpen) ? (
              <div className="mb-3 flex items-center gap-1.5">
                {sidebarSearchOpen ? (
                  <input
                    value={sidebarSearchQuery}
                    onChange={(e) => setSidebarSearchQuery(e.target.value)}
                    placeholder={chatOpen ? 'Search chats...' : 'Search files...'}
                    autoFocus
                    className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-light)] focus:border-[var(--muted)]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => void contextualAction.onClick()}
                    className="flex flex-1 items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                  >
                    <span className="min-w-0 flex-1 text-left text-xs">{contextualAction.label}</span>
                  </button>
                )}
                <button
                  type="button"
                  title={chatOpen ? 'Search chats' : 'Search files'}
                  onClick={() => { setSidebarSearchOpen((v) => !v); if (sidebarSearchOpen) setSidebarSearchQuery('') }}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] ${
                    sidebarSearchOpen
                      ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                      : 'bg-[var(--surface-elevated)] text-[var(--muted)]'
                  }`}
                >
                  {sidebarSearchOpen ? <X size={13} strokeWidth={1.75} /> : <Search size={13} strokeWidth={1.75} />}
                </button>
              </div>
            ) : contextualAction ? (
              <button
                type="button"
                onClick={() => void contextualAction.onClick()}
                className="mb-3 flex w-full items-center gap-2.5 rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
              >
                <span className="min-w-0 flex-1 text-left">{contextualAction.label}</span>
              </button>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {chatOpen ? (
                <ChatInlinePanel
                  refreshKey={chatPanelRefreshKey}
                  searchQuery={sidebarSearchQuery}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              ) : null}
              {filesSectionOpen ? (
                <FilesInlinePanel
                  searchQuery={sidebarSearchQuery}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              ) : null}
              {projectsOpen ? (
                <ProjectsInlinePanel
                  refreshKey={projectsPanelRefreshKey}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              ) : null}
              {automationsOpen ? (
                <AutomationsInlinePanel onNavigate={() => setMobileMenuOpen(false)} />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className={`space-y-3 border-t border-[var(--border)] py-3 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
        {showUpgradeCta && !isGuestConfirmed && (
          <Link
            href="/pricing"
            title="Upgrade to Pro"
            className={`flex w-full items-center gap-2 rounded-md border border-[#fde68a] bg-[#fffbeb] px-2.5 py-1.5 text-xs font-medium text-[#92400e] transition-colors hover:bg-[#fef3c7] ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <ArrowUp size={13} className="shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Upgrade to Pro</span>}
          </Link>
        )}
        <div ref={menuRef} className="relative">
          {accountMenuOpen && (
            <div
              className={`absolute bottom-full z-50 mb-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg ${
                sidebarCollapsed ? 'left-0 w-64' : 'left-0 right-0'
              }`}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="px-3 py-2">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Usage</p>
                <UsageBar entitlements={entitlements} />
              </div>
              <div className="border-t border-[var(--border)] px-3 py-2">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Storage</p>
                <StorageBar entitlements={entitlements} />
              </div>
              <div className="border-t border-[var(--border)]">
                <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Apps</p>
                {PROFILE_APP_LINKS.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    disabled
                    title={`${label} · Coming soon`}
                    className="flex w-full cursor-not-allowed items-center justify-between gap-2 px-3 py-2 text-xs text-[var(--muted-light)]"
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={13} />
                      {label}
                    </span>
                    <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-[var(--muted-light)]">Soon</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--border)]">
                <Link
                  href="/account"
                  onClick={() => {
                    setAccountMenuOpen(false)
                    setMobileMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                >
                  <User size={13} />
                  Account
                </Link>
                {showUpgradeCta && (
                  <Link
                    href="/pricing"
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
              <div className="border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false)
                    void handleSignOut()
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                >
                  <LogOut size={13} />
                  Sign out
                </button>
              </div>
            </div>
          )}

          {!isGuestConfirmed ? (
            <button
              type="button"
              onClick={() => setAccountMenuOpen((value) => !value)}
              className={`flex w-full items-center rounded-md px-2 py-1.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] ${
                sidebarCollapsed ? 'justify-center' : 'gap-2'
              }`}
              aria-label="Account menu"
            >
              <User size={13} />
              {!sidebarCollapsed ? <span className="flex-1 truncate text-left">{displayName}</span> : null}
              {!sidebarCollapsed ? <ChevronUp size={11} className={`shrink-0 transition-transform ${accountMenuOpen ? '' : 'rotate-180'}`} /> : null}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => requireAuth('send')}
              className={`flex w-full items-center rounded-md px-2 py-1.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] ${
                sidebarCollapsed ? 'justify-center' : 'gap-2'
              }`}
              aria-label="Sign in"
            >
              <User size={13} />
              {!sidebarCollapsed ? <span className="flex-1 text-left">Sign in</span> : null}
            </button>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--sidebar-surface)_95%,transparent)] backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open app navigation"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)]"
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
            >
              <User size={16} />
            </button>
            {mobileAccountOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="px-3 py-2">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Usage</p>
                  <UsageBar entitlements={entitlements} />
                </div>
                <div className="border-t border-[var(--border)] px-3 py-2">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Storage</p>
                  <StorageBar entitlements={entitlements} />
                </div>
                <div className="border-t border-[var(--border)]">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Apps</p>
                  {PROFILE_APP_LINKS.map(({ label, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      disabled
                      title={`${label} · Coming soon`}
                      className="flex w-full cursor-not-allowed items-center justify-between gap-2 px-3 py-2.5 text-xs text-[var(--muted-light)]"
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={13} />
                        {label}
                      </span>
                      <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-[var(--muted-light)]">Soon</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-[var(--border)]">
                  <Link
                    href="/account"
                    onClick={() => setMobileAccountOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                  >
                    <User size={13} />
                    Account
                  </Link>
                  {showUpgradeCta && (
                    <Link
                      href="/pricing"
                      onClick={() => setMobileAccountOpen(false)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold text-[#b45309] transition-colors hover:bg-[#fffbeb]"
                    >
                      <ArrowUp size={13} className="shrink-0" />
                      Upgrade
                    </Link>
                  )}
                </div>
                <div className="border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileAccountOpen(false)
                      void handleSignOut()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
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

      <aside
        className={`hidden h-full shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-surface)] transition-[width] duration-200 md:flex ${
          sidebarCollapsed ? 'w-[72px]' : 'w-56'
        }`}
      >
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
          className={`absolute inset-y-0 left-0 flex w-[82vw] max-w-[320px] flex-col border-r border-[var(--border)] bg-[var(--sidebar-surface)] shadow-[0_20px_80px_rgba(10,10,10,0.18)] transition-transform ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4">
            <div className="min-w-0 flex-1">{brandLink}</div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close app navigation"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)]"
            >
              <X size={16} />
            </button>
          </div>
          {sidebarContent}
        </aside>
      </div>

      <div className="hidden md:flex">
        {settings.useSecondarySidebar && projectsOpen ? <ProjectsSidebar /> : null}
        {settings.useSecondarySidebar && toolsOpen ? <ToolsSidebar /> : null}
      </div>
    </>
  )
}
