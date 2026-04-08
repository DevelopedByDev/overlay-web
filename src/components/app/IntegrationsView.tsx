'use client'

import { useState, useEffect, useCallback, useRef, UIEvent } from 'react'
import { Loader2, Plus, X, Search } from 'lucide-react'
import { IntegrationDialogRowSkeleton, IntegrationListSkeleton } from '@/components/ui/Skeleton'

interface Integration {
  id: string
  composioId: string
  name: string
  description: string
  icon: string // emoji fallback
  logoUrl?: string | null
}

const INTEGRATIONS: Integration[] = [
  { id: 'gmail', composioId: 'gmail', name: 'Gmail', description: 'Compose, send, and search emails', icon: '📧' },
  { id: 'google-calendar', composioId: 'googlecalendar', name: 'Google Calendar', description: 'Read and create calendar events', icon: '📅' },
  { id: 'google-sheets', composioId: 'googlesheets', name: 'Google Sheets', description: 'Read, update, and create spreadsheets', icon: '📊' },
  { id: 'google-drive', composioId: 'googledrive', name: 'Google Drive', description: 'Search and manage Drive files', icon: '📁' },
  { id: 'notion', composioId: 'notion', name: 'Notion', description: 'Create pages and manage workspace', icon: '📝' },
  { id: 'outlook', composioId: 'outlook', name: 'Outlook', description: 'Send emails and manage calendar', icon: '📨' },
  { id: 'x-twitter', composioId: 'twitter', name: 'X (Twitter)', description: 'Post tweets and manage your account', icon: '🐦' },
  { id: 'asana', composioId: 'asana', name: 'Asana', description: 'Create tasks and manage projects', icon: '✅' },
  { id: 'linkedin', composioId: 'linkedin', name: 'LinkedIn', description: 'Manage posts and profile actions', icon: '💼' },
]

// ── Logo component ─────────────────────────────────────────────────────────────

function IntegrationLogo({ logoUrl, name, size = 28 }: { logoUrl?: string | null; name: string; icon?: string; size?: number }) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null)
  const hasError = !logoUrl || failedLogoUrl === logoUrl

  return (
    <span
      className="inline-flex flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]"
      style={{ width: size, height: size }}
    >
      {logoUrl && !hasError ? (
        <img
          src={logoUrl}
          alt={name}
          width={size - 10}
          height={size - 10}
          className="object-contain"
          onError={() => setFailedLogoUrl(logoUrl)}
        />
      ) : (
        <span className="text-xs font-bold text-[var(--foreground)]">{name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  )
}

// ── Integrations Dialog ────────────────────────────────────────────────────────

interface PickerItem {
  slug: string
  name: string
  description: string
  logoUrl: string | null
  isConnected: boolean
}

const SEARCH_DEBOUNCE_MS = 300

const KNOWN_NAMES: Record<string, string> = {
  gmail: 'Gmail',
  googlecalendar: 'Google Calendar',
  googlesheets: 'Google Sheets',
  googledrive: 'Google Drive',
  notion: 'Notion',
  outlook: 'Outlook',
  twitter: 'X (Twitter)',
  asana: 'Asana',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  composio: 'Composio',
}

function sanitizeName(name: string): string {
  // Fix snake_case names from Composio (e.g. "Rocket_reach" → "Rocket Reach")
  return name.replace(/_([a-z])/g, (_, c: string) => ' ' + c.toUpperCase()).replace(/_/g, ' ')
}

function resolvedName(slug: string, apiName: string): string {
  if (KNOWN_NAMES[slug]) return KNOWN_NAMES[slug]
  const base = (apiName && apiName.toLowerCase() !== slug.toLowerCase()) ? apiName : slug
  return sanitizeName(base.charAt(0).toUpperCase() + base.slice(1))
}

function truncateDescription(desc: string): string {
  const compact = desc.replace(/\s+/g, ' ').trim()
  return compact.length <= 84 ? compact : `${compact.slice(0, 83).trimEnd()}...`
}

function IntegrationsDialog({
  isOpen,
  onClose,
  onConnect,
  onDisconnect,
}: {
  isOpen: boolean
  onClose: () => void
  onConnect: (slug: string) => Promise<void>
  onDisconnect: (slug: string) => Promise<void>
}) {
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PickerItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actingSlug, setActingSlug] = useState<string | null>(null)
  const requestSeqRef = useRef(0)
  const fetchingMoreRef = useRef(false)
  const defaultCacheRef = useRef<{ items: PickerItem[]; nextCursor: string | null } | null>(null)

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [queryInput])

  const fetchPage = useCallback(async (fetchQuery: string, cursor?: string | null, append = false) => {
    const reqId = ++requestSeqRef.current
    if (append) {
      if (fetchingMoreRef.current) return
      fetchingMoreRef.current = true
      setLoadingMore(true)
    } else {
      setLoadingInitial(true)
      setError(null)
      if (fetchQuery) { setItems([]); setNextCursor(null) }
    }

    try {
      const params = new URLSearchParams({ action: 'search', limit: '12' })
      if (fetchQuery) params.set('q', fetchQuery)
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/app/integrations?${params}`)
      if (reqId !== requestSeqRef.current) return
      if (!res.ok) throw new Error('Failed to load integrations')
      const data = await res.json()
      const pageItems = Array.isArray(data?.items) ? data.items as PickerItem[] : []

      const resolve = (items: PickerItem[]) =>
        items.map((item) => ({ ...item, name: resolvedName(item.slug, item.name) }))

      setItems((prev) => {
        const merged = append ? [...prev, ...resolve(pageItems)] : resolve(pageItems)
        const map = new Map<string, PickerItem>()
        for (const item of merged) map.set(item.slug, item)
        return [...map.values()]
      })
      setNextCursor(data.nextCursor ?? null)

      if (!fetchQuery) {
        const merged = append
          ? [...(defaultCacheRef.current?.items || []), ...resolve(pageItems)]
          : resolve(pageItems)
        const map = new Map<string, PickerItem>()
        for (const item of merged) map.set(item.slug, item)
        defaultCacheRef.current = { items: [...map.values()], nextCursor: data.nextCursor ?? null }
      }
    } catch (err) {
      if (reqId === requestSeqRef.current) setError(err instanceof Error ? err.message : 'Error loading integrations')
    } finally {
      if (append) { fetchingMoreRef.current = false; setLoadingMore(false) }
      else setLoadingInitial(false)
    }
  }, [])

  // Load on open / query change
  useEffect(() => {
    if (!isOpen) return
    if (!query && defaultCacheRef.current) {
      setItems(defaultCacheRef.current.items)
      setNextCursor(defaultCacheRef.current.nextCursor)
      return
    }
    void fetchPage(query)
  }, [isOpen, query, fetchPage])

  // Reset on close
  useEffect(() => {
    if (isOpen) return
    setQueryInput('')
    setQuery('')
    setError(null)
    setActingSlug(null)
    if (defaultCacheRef.current) {
      setItems(defaultCacheRef.current.items)
      setNextCursor(defaultCacheRef.current.nextCursor)
    } else {
      setItems([])
    }
  }, [isOpen])

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const t = e.currentTarget
    if (t.scrollHeight - t.scrollTop - t.clientHeight <= 120 && nextCursor && !loadingMore && !fetchingMoreRef.current) {
      void fetchPage(query, nextCursor, true)
    }
  }, [nextCursor, loadingMore, query, fetchPage])

  const handleConnect = useCallback(async (slug: string) => {
    if (actingSlug) return
    setActingSlug(slug)
    setError(null)
    try {
      await onConnect(slug)
      setItems((prev) => prev.map((item) => item.slug === slug ? { ...item, isConnected: true } : item))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setActingSlug(null)
    }
  }, [actingSlug, onConnect])

  const handleDisconnect = useCallback(async (slug: string) => {
    if (actingSlug) return
    setActingSlug(slug)
    setError(null)
    try {
      await onDisconnect(slug)
      setItems((prev) => prev.map((item) => item.slug === slug ? { ...item, isConnected: false } : item))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setActingSlug(null)
    }
  }, [actingSlug, onDisconnect])

  if (!isOpen) return null

  const isSearching = queryInput.trim() !== query || loadingInitial
  const visibleItems = isSearching ? [] : items

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex max-h-[80vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Add Integration</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Search and connect any Composio integration</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
            <Search size={13} className="shrink-0 text-[var(--muted-light)]" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search integrations..."
              autoFocus
              className="flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-light)]"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
          {error && (
            <div className="mx-4 my-2 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--foreground)]">{error}</div>
          )}
          {isSearching && <IntegrationDialogRowSkeleton rows={8} />}
          {!isSearching && visibleItems.length === 0 && (
            <div className="py-10 text-center text-xs text-[var(--muted)]">No integrations found.</div>
          )}
          {visibleItems.map((item) => {
            const isActing = actingSlug === item.slug
            return (
              <div key={item.slug} className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-3 last:border-0">
                <span
                  className="inline-flex flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]"
                  style={{ width: 32, height: 32 }}
                >
                  {item.logoUrl ? (
                    <img src={item.logoUrl} alt={item.name} width={20} height={20} className="object-contain" />
                  ) : (
                    <span className="text-sm font-bold text-[var(--foreground)]">{item.name.charAt(0).toUpperCase()}</span>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--foreground)]">{item.name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">{truncateDescription(item.description || item.slug)}</p>
                </div>
                {item.isConnected ? (
                  <button
                    onClick={() => void handleDisconnect(item.slug)}
                    disabled={isActing}
                    className="flex-shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
                  >
                    {isActing ? <Loader2 size={11} className="animate-spin" /> : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    onClick={() => void handleConnect(item.slug)}
                    disabled={isActing}
                    className="flex-shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
                  >
                    {isActing ? <Loader2 size={11} className="animate-spin" /> : 'Connect'}
                  </button>
                )}
              </div>
            )
          })}
          {loadingMore && (
            <div className="px-5 py-4" aria-hidden>
              <div className="ui-skeleton-line mx-auto h-2 w-32 rounded-full opacity-80" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function notifyIntegrationsChanged() {
  window.dispatchEvent(new CustomEvent('overlay:integrations-changed'))
}

// ── Main integrations view ─────────────────────────────────────────────────────

export default function IntegrationsView({ userId: _userId }: { userId: string }) {
  void _userId
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [logos, setLogos] = useState<Record<string, string | null>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const loadConnected = useCallback(async () => {
    try {
      const res = await fetch('/api/app/integrations')
      if (res.ok) {
        const data = await res.json()
        setConnected(new Set(data.connected || []))
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch logo URLs for static integrations from Composio
  const loadLogos = useCallback(async () => {
    try {
      const res = await fetch('/api/app/integrations?action=search&limit=50')
      if (!res.ok) return
      const data = await res.json()
      const items = Array.isArray(data?.items) ? data.items : []
      const logoMap: Record<string, string | null> = {}
      for (const item of items) {
        logoMap[item.slug] = item.logoUrl ?? null
      }
      setLogos(logoMap)
    } catch {
      // logos are optional
    }
  }, [])

  useEffect(() => {
    loadConnected()
    loadLogos()
  }, [loadConnected, loadLogos])

  // Refresh on focus (user may have completed OAuth in another tab)
  useEffect(() => {
    const onFocus = () => loadConnected()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadConnected])

  async function handleConnect(integration: Integration) {
    if (connecting) return
    setConnectError(null)
    setConnecting(integration.composioId)

    // Pre-open blank tab synchronously so popup blocker allows it
    let oauthTab: Window | null = null
    if (!connected.has(integration.composioId)) {
      oauthTab = window.open('about:blank', '_blank')
    }

    try {
      if (connected.has(integration.composioId)) {
        const res = await fetch('/api/app/integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'disconnect', toolkit: integration.composioId }),
        })
        if (res.ok) {
          setConnected((prev) => { const next = new Set(prev); next.delete(integration.composioId); return next })
          notifyIntegrationsChanged()
        } else {
          const data = await res.json().catch(() => ({}))
          setConnectError(data.error || 'Failed to disconnect')
        }
      } else {
        const res = await fetch('/api/app/integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'connect', toolkit: integration.composioId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          oauthTab?.close()
          setConnectError(data.error || 'Failed to connect')
        } else if (data.redirectUrl) {
          if (oauthTab) oauthTab.location.href = data.redirectUrl
          else window.open(data.redirectUrl, '_blank')
        } else {
          oauthTab?.close()
          setConnectError('No OAuth URL returned — this integration may require manual setup')
        }
      }
    } catch {
      oauthTab?.close()
      setConnectError('Connection failed')
    } finally {
      setConnecting(null)
    }
  }

  // Dialog connect/disconnect handlers
  const dialogConnect = useCallback(async (slug: string) => {
    // Pre-open blank tab synchronously before async fetch (avoids popup blocker)
    const oauthTab = window.open('about:blank', '_blank')
    try {
      const res = await fetch('/api/app/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', toolkit: slug }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        oauthTab?.close()
        throw new Error(data.error || 'Failed to initiate connection')
      }
      if (data.redirectUrl) {
        if (oauthTab) oauthTab.location.href = data.redirectUrl
        else window.open(data.redirectUrl, '_blank')
        setConnected((prev) => new Set([...prev, slug]))
        notifyIntegrationsChanged()
      } else if (data.connectionId) {
        oauthTab?.close()
        setConnected((prev) => new Set([...prev, slug]))
        notifyIntegrationsChanged()
      } else {
        oauthTab?.close()
        throw new Error('No OAuth URL returned')
      }
    } catch (err) {
      oauthTab?.close()
      throw err
    }
  }, [])

  const dialogDisconnect = useCallback(async (slug: string) => {
    const res = await fetch('/api/app/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect', toolkit: slug }),
    })
    if (!res.ok) throw new Error('Failed to disconnect')
    setConnected((prev) => { const next = new Set(prev); next.delete(slug); return next })
    notifyIntegrationsChanged()
  }, [])

  const connectedList = INTEGRATIONS.filter((i) => connected.has(i.composioId))
  const availableList = INTEGRATIONS.filter((i) => !connected.has(i.composioId))

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 items-center border-b border-[var(--border)] px-6">
        <h2 className="text-sm font-medium text-[var(--foreground)]">Integrations</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <IntegrationListSkeleton rows={10} />
        ) : (
          <div className="mx-auto max-w-2xl px-6 py-6 space-y-8">
            {connectError && (
              <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                <span>{connectError}</span>
                <button onClick={() => setConnectError(null)} className="ml-2 text-red-400 hover:text-red-300">✕</button>
              </div>
            )}

            {connectedList.length > 0 && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-light)]">Connected</p>
                <div className="space-y-1">
                  {connectedList.map((integration) => (
                    <IntegrationRow
                      key={integration.id}
                      integration={integration}
                      logoUrl={logos[integration.composioId]}
                      isConnected={true}
                      isConnecting={connecting === integration.composioId}
                      onAction={handleConnect}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                {connectedList.length > 0 && (
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-light)]">Available</p>
                )}
                <button
                  onClick={() => setIsDialogOpen(true)}
                  className="ml-auto flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
                  title="Browse all integrations"
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>
              <div className="space-y-1">
                {availableList.map((integration) => (
                  <IntegrationRow
                    key={integration.id}
                    integration={integration}
                    logoUrl={logos[integration.composioId]}
                    isConnected={false}
                    isConnecting={connecting === integration.composioId}
                    onAction={handleConnect}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <IntegrationsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConnect={dialogConnect}
        onDisconnect={dialogDisconnect}
      />
    </div>
  )
}

function IntegrationRow({
  integration,
  logoUrl,
  isConnected,
  isConnecting,
  onAction,
}: {
  integration: Integration
  logoUrl?: string | null
  isConnected: boolean
  isConnecting: boolean
  onAction: (i: Integration) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-[var(--surface-muted)]">
      <div className="flex items-center gap-3 min-w-0">
        <IntegrationLogo logoUrl={logoUrl} name={integration.name} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[var(--foreground)]">{integration.name}</p>
          </div>
          <p className="truncate text-xs text-[var(--muted)]">{integration.description}</p>
        </div>
      </div>
      <button
        onClick={() => onAction(integration)}
        disabled={isConnecting}
        className={`flex-shrink-0 ml-4 text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 ${
          isConnected
            ? 'border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)] hover:bg-[var(--border)]'
            : 'border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)] hover:bg-[var(--border)]'
        }`}
      >
        {isConnecting ? (
          <Loader2 size={11} className="animate-spin" />
        ) : isConnected ? (
          'Disconnect'
        ) : (
          'Connect'
        )}
      </button>
    </div>
  )
}
