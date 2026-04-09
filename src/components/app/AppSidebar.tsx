'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback, useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  MessageSquare, BookOpen, Brain, LogOut, User,
  Puzzle, Monitor, ChevronUp, AlertCircle,
  FolderOpen, Loader2, Menu, X, ArrowUp, Workflow, Settings, ChevronDown, PanelLeftClose,
} from 'lucide-react'
import type { AuthUser } from '@/lib/workos-auth'
import { useAsyncSessions } from '@/lib/async-sessions-store'
import { DEFAULT_MODEL_ID } from '@/lib/models'
import { useAppSettings } from './AppSettingsProvider'
import {
  ChatInlinePanel,
  InlineNavChildren,
  NotesInlinePanel,
  ProjectsInlinePanel,
  knowledgeInlineItems,
  toolsInlineItems,
} from './AppSidebarInlinePanels'
import ProjectsSidebar from './ProjectsSidebar'
import ToolsSidebar from './ToolsSidebar'
import KnowledgeSidebar from './KnowledgeSidebar'

const NAV_ITEMS: Array<{
  href?: string
  label: string
  icon: LucideIcon
  disabled?: boolean
}> = [
  { href: '/app/chat', label: 'Chat', icon: MessageSquare },
  { href: '/app/notes', label: 'Notes', icon: BookOpen },
  { href: '/app/knowledge', label: 'Knowledge', icon: Brain },
  { href: '/app/tools', label: 'Extensions', icon: Puzzle },
  { href: '/app/projects', label: 'Projects', icon: FolderOpen },
  { href: '/app/automations', label: 'Automations', icon: Workflow },
]

const PROFILE_APP_LINKS = [
  { label: 'Desktop App', icon: Monitor, href: 'https://getoverlay.io' },
] as const

const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'account', label: 'Account' },
  { id: 'customization', label: 'Customization' },
  { id: 'models', label: 'Models' },
  { id: 'contact', label: 'Contact' },
] as const

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
  dailyUsage: { ask: number; write: number; agent: number }
  overlayStorageBytesUsed: number
  overlayStorageBytesLimit: number
}

function UsageBar({ entitlements }: { entitlements: Entitlements | null }) {
  if (!entitlements) {
    return <p className="text-[11px] text-[var(--muted-light)]">Loading...</p>
  }

  const { tier, creditsUsed, creditsTotal } = entitlements

  if (tier === 'free') {
    return <p className="text-[11px] text-[var(--muted-light)]">Auto model messages are unlimited. Upgrade to Pro to use premium models and credits.</p>
  }

  const creditsTotalCents = creditsTotal * 100
  if (creditsTotalCents <= 0) return <p className="text-[11px] text-[#aaa]">No credit limit set</p>
  const usedPctRaw = Math.min(100, (creditsUsed / creditsTotalCents) * 100)
  const remainingPctRaw = Math.max(0, 100 - usedPctRaw)
  const exhausted = remainingPctRaw <= 0
  const warning = usedPctRaw >= 80

  return (
    <div className={`flex flex-col gap-1 text-xs ${exhausted ? 'text-red-500' : warning ? 'text-amber-500' : 'text-[var(--muted-light)]'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="tabular-nums">
          {remainingPctRaw.toFixed(1)}% remaining
          <span className="text-[10px] opacity-70"> · {usedPctRaw.toFixed(1)}% used</span>
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

export default function AppSidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const searchParams = useSearchParams()
  const { settings } = useAppSettings()
  const displayName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email
  const { totalUnread } = useAsyncSessions()

  const [pendingNav, setPendingNav] = useState<{ href: string; fromPath: string } | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem('overlay:app-sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })
  const [chatPanelRefreshKey, setChatPanelRefreshKey] = useState(0)
  const [notesPanelRefreshKey, setNotesPanelRefreshKey] = useState(0)
  const [projectsPanelRefreshKey, setProjectsPanelRefreshKey] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const mobileAccountRef = useRef<HTMLDivElement>(null)

  const effectivePendingHref =
    pendingNav && pathname === pendingNav.fromPath ? pendingNav.href : null
  const projectsOpen = pathname.startsWith('/app/projects')
  const notesOpen = pathname.startsWith('/app/notes')
  const chatOpen = pathname.startsWith('/app/chat')
  const toolsOpen = pathname.startsWith('/app/tools')
  const knowledgeOpen = pathname.startsWith('/app/knowledge')
  const settingsPathActive = pathname.startsWith('/app/settings')
  const settingsSection = searchParams?.get('section') ?? 'general'
  const inlineSecondaryDisabled = !settings.useSecondarySidebar
  const knowledgeView = (() => {
    const current = searchParams?.get('view')
    if (current === 'files') return 'files'
    if (current === 'outputs') return 'outputs'
    return 'memories'
  })()
  const toolsView = (() => {
    const current = searchParams?.get('view')
    if (current === 'skills') return 'skills'
    if (current === 'mcps') return 'mcps'
    if (current === 'apps') return 'apps'
    if (current === 'installed') return 'installed'
    if (current === 'all') return 'all'
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
    try {
      window.localStorage.setItem('overlay:app-sidebar-collapsed', sidebarCollapsed ? 'true' : 'false')
    } catch {
      // ignore
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!accountMenuOpen && !mobileAccountOpen && !knowledgeOpen) return
    const initialId = window.setTimeout(() => { void loadEntitlements() }, 0)
    const intervalId = window.setInterval(() => { void loadEntitlements() }, 30_000)
    return () => {
      window.clearTimeout(initialId)
      window.clearInterval(intervalId)
    }
  }, [accountMenuOpen, mobileAccountOpen, knowledgeOpen, loadEntitlements])

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
      setPendingNav({ href: item.href, fromPath: pathname })
      router.push(item.href)
    }
    window.addEventListener('keydown', onNavShortcut, true)
    return () => window.removeEventListener('keydown', onNavShortcut, true)
  }, [pathname, router])

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
    const res = await fetch('/api/app/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Chat',
        askModelIds: [DEFAULT_MODEL_ID],
        actModelId: DEFAULT_MODEL_ID,
        lastMode: 'act',
      }),
    })
    if (!res.ok) return
    const data = await res.json() as { id?: string }
    if (!data.id) return
    setChatPanelRefreshKey((value) => value + 1)
    setMobileMenuOpen(false)
    router.push(`/app/chat?id=${encodeURIComponent(data.id)}`)
  }

  async function handleCreateNote() {
    const res = await fetch('/api/app/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', content: '', tags: [] }),
    })
    if (!res.ok) return
    const data = await res.json() as { id?: string }
    if (!data.id) return
    setNotesPanelRefreshKey((value) => value + 1)
    setMobileMenuOpen(false)
    router.push(`/app/notes?id=${encodeURIComponent(data.id)}`)
  }

  async function handleCreateProject() {
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
      onClick={() => setSidebarCollapsed(false)}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-subtle)]"
      aria-label="Expand sidebar"
      title="Expand sidebar"
    >
      <Image src="/assets/overlay-logo.png" alt="" width={24} height={24} className="shrink-0" />
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

  const showUpgradeCta = !entitlements || entitlements.tier === 'free'
  const contextualAction = inlineSecondaryDisabled
    ? chatOpen
      ? { label: 'New chat', onClick: handleCreateChat }
      : notesOpen
        ? { label: 'New note', onClick: handleCreateNote }
        : projectsOpen
          ? { label: 'New project', onClick: handleCreateProject }
          : null
    : null
  const hasInlineChildren = (href?: string) =>
    inlineSecondaryDisabled && (href === '/app/knowledge' || href === '/app/tools')

  const sidebarContent = (
    <>
      <div
        className={`hidden h-16 min-h-16 shrink-0 items-center border-b border-[var(--border)] md:flex ${
          sidebarCollapsed ? 'justify-center px-3' : 'justify-between px-5'
        }`}
      >
        {desktopBrandControl}
        {!sidebarCollapsed ? (
          <button
            type="button"
            onClick={() => {
              setAccountMenuOpen(false)
              setSidebarCollapsed(true)
            }}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
          >
            <PanelLeftClose size={16} />
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <nav className={`shrink-0 space-y-0.5 py-3 ${sidebarCollapsed ? 'px-1.5' : 'px-2'}`}>
          {NAV_ITEMS.map((item, navIdx) => {
            const { href, label, icon: Icon, disabled } = item
            const active =
              href &&
              (effectivePendingHref ? effectivePendingHref === href : pathname.startsWith(href))
            const isPending = href && effectivePendingHref === href
            const unreadCount = href === '/app/chat' ? totalUnread : 0
            const shortcut = navIdx < 9 ? navIdx + 1 : null
            const showShortcut = Boolean(shortcut) && !active
            const showChevron = hasInlineChildren(href)
            const commonClass = `group flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors ${
              disabled
                ? 'cursor-not-allowed text-[var(--muted-light)]'
                : active
                  ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
            } ${sidebarCollapsed ? 'justify-center px-2.5' : 'gap-2.5'}`
            if (disabled) {
              return (
                <button
                  key={label}
                  type="button"
                  disabled
                  title="Coming soon"
                  aria-label="Automations (coming soon)"
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
                    setMobileMenuOpen(false)
                    setPendingNav({ href, fromPath: pathname })
                    router.push(href)
                  }}
                  title={shortcut ? `${label} · ⌥${shortcut}` : label}
                  aria-label={label}
                  className={commonClass}
                >
                  <Icon size={15} />
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
                  {isPending ? (
                    <Loader2
                      size={14}
                      className={`shrink-0 animate-spin ${active ? 'text-[var(--muted)]' : 'text-[var(--muted)]'}`}
                      aria-hidden
                    />
                  ) : unreadCount > 0 ? (
                    <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium ${
                      active ? 'bg-[var(--border)] text-[var(--foreground)]' : 'bg-[var(--border)] text-[var(--foreground)]'
                    }`}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : null}
                </button>
                {!sidebarCollapsed && inlineSecondaryDisabled && href === '/app/knowledge' && active ? (
                  <InlineNavChildren
                    items={knowledgeInlineItems}
                    activeId={knowledgeView}
                    onSelect={(next) => {
                      const params = new URLSearchParams(searchParams?.toString() ?? '')
                      params.set('view', next)
                      if (next !== 'outputs') params.delete('out')
                      setMobileMenuOpen(false)
                      router.push(`/app/knowledge?${params.toString()}`)
                    }}
                  />
                ) : null}
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
              </div>
            )
          })}
          <div className="mt-0.5">
            <button
              type="button"
              onClick={() => {
                if (settingsPathActive) return
                setMobileMenuOpen(false)
                setPendingNav({ href: '/app/settings', fromPath: pathname })
                router.push('/app/settings')
              }}
              title="Settings · ⌥7"
              aria-label="Settings"
              className={`group flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors ${
                settingsPathActive
                  ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
              } ${sidebarCollapsed ? 'justify-center px-2.5' : 'gap-2.5'}`}
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

        {!sidebarCollapsed && inlineSecondaryDisabled && (chatOpen || notesOpen || projectsOpen) ? (
          <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--border)] px-2 py-3">
            {contextualAction ? (
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
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              ) : null}
              {notesOpen ? (
                <NotesInlinePanel
                  refreshKey={notesPanelRefreshKey}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              ) : null}
              {projectsOpen ? (
                <ProjectsInlinePanel
                  refreshKey={projectsPanelRefreshKey}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className={`space-y-3 border-t border-[var(--border)] py-3 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
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
              <div className="border-t border-[var(--border)]">
                <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Apps</p>
                {PROFILE_APP_LINKS.map(({ label, icon: Icon, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                  >
                    <Icon size={13} />
                    {label}
                  </a>
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
                <div className="border-t border-[var(--border)]">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Apps</p>
                  {PROFILE_APP_LINKS.map(({ label, icon: Icon, href }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setMobileAccountOpen(false)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                    >
                      <Icon size={13} />
                      {label}
                    </a>
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
        {settings.useSecondarySidebar && knowledgeOpen ? <KnowledgeSidebar entitlements={entitlements} /> : null}
      </div>
    </>
  )
}
