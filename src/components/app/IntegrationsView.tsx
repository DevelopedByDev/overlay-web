'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { IntegrationListSkeleton } from '@/components/ui/Skeleton'
import posthog from 'posthog-js'
import { INTEGRATIONS_BC_CHANNEL, notifyIntegrationsChanged } from '@/lib/integrations-events'
import { IntegrationsDialog } from './IntegrationsDialog'

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

const KNOWN_NAMES: Record<string, string> = {
  gmail: 'Gmail',
  googlecalendar: 'Google Calendar',
  googlesheets: 'Google Sheets',
  googledrive: 'Google Drive',
  googlemeet: 'Google Meet',
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
  return name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function resolvedName(slug: string, apiName: string): string {
  const resolvedApiName = sanitizeName(apiName)
  if (resolvedApiName) return resolvedApiName
  if (KNOWN_NAMES[slug]) return KNOWN_NAMES[slug]
  const base = sanitizeName(slug)
  return base
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

type CatalogItem = { slug: string; name: string; description: string; logoUrl: string | null; isConnected?: boolean }

function mergeCatalogEntries(current: CatalogItem[], incoming: CatalogItem[]): CatalogItem[] {
  const merged = new Map<string, CatalogItem>()
  for (const item of current) merged.set(item.slug, item)
  for (const item of incoming) {
    const existing = merged.get(item.slug)
    merged.set(item.slug, {
      ...existing,
      ...item,
      name: resolvedName(item.slug, item.name || existing?.name || ''),
      description: item.description?.trim() || existing?.description || '',
      logoUrl: item.logoUrl ?? existing?.logoUrl ?? null,
    })
  }
  return [...merged.values()]
}

const LIST_PAGE_SIZE = 8

// ── Main integrations view ─────────────────────────────────────────────────────

export default function IntegrationsView({ userId: _userId }: { userId: string }) {
  void _userId
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [logos, setLogos] = useState<Record<string, string | null>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [connectedVisible, setConnectedVisible] = useState(LIST_PAGE_SIZE)
  const [availableVisible, setAvailableVisible] = useState(LIST_PAGE_SIZE)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const loadConnected = useCallback(async () => {
    try {
      const res = await fetch('/api/app/integrations')
      if (res.ok) {
        const data = await res.json() as { connected?: string[]; items?: CatalogItem[] }
        setConnected(new Set(data.connected || []))
        const items = Array.isArray(data.items) ? data.items : []
        if (items.length > 0) {
          setCatalogItems((prev) => mergeCatalogEntries(prev, items))
          setLogos((prev) => {
            const next = { ...prev }
            for (const item of items) {
              next[item.slug] = item.logoUrl ?? null
            }
            return next
          })
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  /** Toolkit catalog for logos, descriptions, and rows not in INTEGRATIONS (e.g. connected only from chat). */
  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/app/integrations?action=search&limit=100')
      if (!res.ok) return
      const data = await res.json()
      const items = (Array.isArray(data?.items) ? data.items : []) as CatalogItem[]
      setCatalogItems((prev) => mergeCatalogEntries(prev, items))
      setLogos((prev) => {
        const next = { ...prev }
        for (const item of items) {
          next[item.slug] = item.logoUrl ?? null
        }
        return next
      })
    } catch {
      // optional
    }
  }, [])

  useEffect(() => {
    void loadConnected()
    void loadCatalog()
  }, [loadConnected, loadCatalog])

  // Refresh on focus (user may have completed OAuth in another tab)
  useEffect(() => {
    const onFocus = () => {
      void loadConnected()
      void loadCatalog()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadConnected, loadCatalog])

  useEffect(() => {
    const onIntegrationsChanged = () => {
      void loadConnected()
      void loadCatalog()
    }
    window.addEventListener('overlay:integrations-changed', onIntegrationsChanged)
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(INTEGRATIONS_BC_CHANNEL)
      bc.onmessage = onIntegrationsChanged
    } catch {
      /* ignore */
    }
    return () => {
      window.removeEventListener('overlay:integrations-changed', onIntegrationsChanged)
      bc?.close()
    }
  }, [loadConnected, loadCatalog])

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
          posthog.capture('integration_disconnected', { integration: integration.composioId, integration_name: integration.name })
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
          posthog.capture('integration_connect_initiated', { integration: integration.composioId, integration_name: integration.name })
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
        posthog.capture('integration_connect_initiated', { integration: slug })
      } else if (data.connectionId) {
        oauthTab?.close()
        setConnected((prev) => new Set([...prev, slug]))
        notifyIntegrationsChanged()
        posthog.capture('integration_connect_initiated', { integration: slug })
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
    posthog.capture('integration_disconnected', { integration: slug })
  }, [])

  const integrationForSlug = useCallback(
    (slug: string): Integration => {
      const cat = catalogItems.find((c) => c.slug === slug)
      const preset = INTEGRATIONS.find((i) => i.composioId === slug)
      if (cat) {
        return {
          id: slug,
          composioId: slug,
          name: resolvedName(slug, cat.name),
          description: cat.description?.trim() || preset?.description || 'Connected integration',
          icon: preset?.icon || '🔌',
          logoUrl: cat.logoUrl,
        }
      }
      if (preset) return preset
      return {
        id: slug,
        composioId: slug,
        name: resolvedName(slug, slug),
        description: 'Connected integration',
        icon: '🔌',
      }
    },
    [catalogItems],
  )

  const connectedRows = useMemo(() => {
    return Array.from(connected)
      .map((slug) => integrationForSlug(slug))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [connected, integrationForSlug])

  const availableList = useMemo(() => {
    const bySlug = new Map<string, Integration>()
    for (const i of INTEGRATIONS) {
      if (!connected.has(i.composioId)) bySlug.set(i.composioId, i)
    }
    for (const c of catalogItems) {
      if (connected.has(c.slug)) continue
      const existing = bySlug.get(c.slug)
      bySlug.set(c.slug, {
        id: c.slug,
        composioId: c.slug,
        name: resolvedName(c.slug, c.name || existing?.name || ''),
        description: c.description?.trim() || existing?.description || '',
        icon: existing?.icon || '🔌',
        logoUrl: c.logoUrl ?? existing?.logoUrl ?? null,
      })
    }
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [connected, catalogItems])

  useEffect(() => {
    setConnectedVisible(LIST_PAGE_SIZE)
  }, [connected.size])

  useEffect(() => {
    setAvailableVisible(LIST_PAGE_SIZE)
  }, [availableList.length])

  const searchQ = searchQuery.toLowerCase().trim()
  const filteredConnectedRows = searchQ ? connectedRows.filter((i) => i.name.toLowerCase().includes(searchQ)) : connectedRows
  const filteredAvailableList = searchQ ? availableList.filter((i) => i.name.toLowerCase().includes(searchQ)) : availableList
  const connectedShown = filteredConnectedRows.slice(0, connectedVisible)
  const availableShown = filteredAvailableList.slice(0, availableVisible)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] px-6">
        <h2 className="shrink-0 text-sm font-medium text-[var(--foreground)]">Integrations</h2>
        {searchOpen ? (
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search integrations…"
            autoFocus
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-light)] focus:border-[var(--muted)]"
          />
        ) : (
          <div className="flex-1" />
        )}
        <button
          type="button"
          title="Search integrations"
          onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearchQuery('') }}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] ${
            searchOpen ? 'border-[var(--muted)] bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''
          }`}
        >
          <Search size={14} strokeWidth={1.75} />
        </button>
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

            {filteredConnectedRows.length > 0 && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-light)]">Connected</p>
                <div className="space-y-1">
                  {connectedShown.map((integration) => (
                    <IntegrationRow
                      key={integration.composioId}
                      integration={integration}
                      logoUrl={logos[integration.composioId]}
                      isConnected={true}
                      isConnecting={connecting === integration.composioId}
                      onAction={handleConnect}
                    />
                  ))}
                </div>
                {connectedVisible < filteredConnectedRows.length ? (
                  <button
                    type="button"
                    onClick={() => setConnectedVisible((n) => n + LIST_PAGE_SIZE)}
                    className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
                  >
                    Show more
                  </button>
                ) : null}
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-light)]">Available</p>
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(true)}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
                  title="Browse all integrations"
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>
              <div className="space-y-1">
                {availableShown.map((integration) => (
                  <IntegrationRow
                    key={integration.composioId}
                    integration={integration}
                    logoUrl={logos[integration.composioId]}
                    isConnected={false}
                    isConnecting={connecting === integration.composioId}
                    onAction={handleConnect}
                  />
                ))}
              </div>
              {availableVisible < filteredAvailableList.length ? (
                <button
                  type="button"
                  onClick={() => setAvailableVisible((n) => n + LIST_PAGE_SIZE)}
                  className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
                >
                  Show more
                </button>
              ) : null}
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
