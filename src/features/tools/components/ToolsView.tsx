'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Braces,
  Check,
  ChevronDown,
  KeyRound,
  Loader2,
  Plus,
  Search,
  Server,
  X,
} from 'lucide-react'
import {
  DEFAULT_CONNECTOR_CATALOG,
  createMcpCreateRequest,
  createMcpSummaryFromForm,
  createMcpTestRequest,
  createMcpUpdateRequest,
  filterConnectorCatalog,
  filterMcpServers,
  formatMcpTestResult,
  integrationRegistryToConnectorCatalog,
  mergeConnectorCatalogEntries,
  removeMcpServerSummary,
  updateMcpSummaryFromForm,
  upsertMcpServerSummary,
  type AppBootstrapResponse,
  type ConnectorCatalogItem,
  type McpServerFormValues,
  type McpServerSummary,
  type McpTestResultState,
  type OverlayModelProviderRegistration,
  type TestMcpServerResponse,
} from '@overlay/app-core'
import { connectorFromIntegrationSummary, MCPS_CHANGED_EVENT, EXTENSIONS_CHANGED_EVENT } from '@overlay/app-core/extensions'
import { IntegrationLogo, McpServerDialog } from '@overlay/modules-react/extensions'
import { overlayAppClient } from '@/shared/app/overlay-app-client'

type ToolsTab = 'apps' | 'custom-api' | 'custom-mcp'

type McpDialogState = {
  mode: 'create' | 'edit'
  server?: McpServerSummary
}

const TABS: Array<{ id: ToolsTab; label: string }> = [
  { id: 'apps', label: 'Apps' },
  { id: 'custom-api', label: 'Custom API' },
  { id: 'custom-mcp', label: 'Custom MCP' },
]

const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  anthropic: 'Use Claude models for writing, reasoning, and agent workflows',
  google: 'Use Google Gemini models for multimodal AI tasks',
  openai: 'Use GPT models for text, vision, and tool-using agents',
  openrouter: 'Route requests across multiple model providers',
}

function resolveTab(value: string | null): ToolsTab {
  if (value === 'custom-api' || value === 'api' || value === 'apis') return 'custom-api'
  if (value === 'custom-mcp' || value === 'mcp' || value === 'mcps') return 'custom-mcp'
  return 'apps'
}

function providerDescription(provider: OverlayModelProviderRegistration): string {
  return provider.description ?? PROVIDER_DESCRIPTIONS[provider.id] ?? `Configure ${provider.label} as an AI model provider`
}

export default function ToolsView({ userId: _userId }: { userId: string }) {
  void _userId
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = resolveTab(searchParams?.get('view') ?? null)
  const projectId = searchParams?.get('projectId')?.trim() || null

  const [activeTab, setActiveTab] = useState<ToolsTab>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [apps, setApps] = useState<ConnectorCatalogItem[]>(() => [...DEFAULT_CONNECTOR_CATALOG])
  const [modelProviders, setModelProviders] = useState<OverlayModelProviderRegistration[]>([])
  const [mcpServers, setMcpServers] = useState<McpServerSummary[]>([])
  const [appsLoading, setAppsLoading] = useState(true)
  const [mcpLoading, setMcpLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [mcpDialog, setMcpDialog] = useState<McpDialogState | null>(null)
  const createRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setActiveTab(resolveTab(searchParams?.get('view') ?? null))
  }, [searchParams])

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (createRef.current && !createRef.current.contains(event.target as Node)) {
        setCreateOpen(false)
      }
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [])

  const loadCatalog = useCallback(async () => {
    setAppsLoading(true)
    try {
      const [bootstrapRes, catalogRes] = await Promise.allSettled([
        overlayAppClient.bootstrap.getResponse(),
        overlayAppClient.integrations.getResponse({ action: 'search', limit: 100 }),
      ])

      let nextApps: ConnectorCatalogItem[] = [...DEFAULT_CONNECTOR_CATALOG]

      if (bootstrapRes.status === 'fulfilled' && bootstrapRes.value.ok) {
        const bootstrap = (await bootstrapRes.value.json()) as AppBootstrapResponse
        nextApps = mergeConnectorCatalogEntries(
          nextApps,
          integrationRegistryToConnectorCatalog(bootstrap.integrationRegistry ?? []),
        )
        setModelProviders([...(bootstrap.modelProviderRegistry ?? [])])
      }

      if (catalogRes.status === 'fulfilled' && catalogRes.value.ok) {
        const catalog = await catalogRes.value.json().catch(() => ({ items: [] })) as { items?: unknown[] }
        const items = (Array.isArray(catalog.items) ? catalog.items : []).map((item) => connectorFromIntegrationSummary(item as Parameters<typeof connectorFromIntegrationSummary>[0]))
        nextApps = mergeConnectorCatalogEntries(nextApps, items)
      }

      setApps(nextApps)
    } finally {
      setAppsLoading(false)
    }
  }, [])

  const loadMcpServers = useCallback(async () => {
    if (!projectId) {
      setMcpServers([])
      setMcpLoading(false)
      return
    }
    setMcpLoading(true)
    try {
      setMcpServers(await overlayAppClient.mcpServers.get<McpServerSummary[]>({ projectId }))
    } catch {
      setMcpServers([])
    } finally {
      setMcpLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadCatalog()
    void loadMcpServers()
  }, [loadCatalog, loadMcpServers])

  const setTab = useCallback((tab: ToolsTab) => {
    setActiveTab(tab)
    setSearchQuery('')
    const view = tab === 'apps' ? 'apps' : tab === 'custom-api' ? 'custom-api' : 'mcps'
    const params = new URLSearchParams()
    params.set('view', view)
    if (projectId) params.set('projectId', projectId)
    router.replace(`/app/tools?${params.toString()}`)
  }, [projectId, router])

  const filteredApps = useMemo(
    () => filterConnectorCatalog(apps, searchQuery),
    [apps, searchQuery],
  )

  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return modelProviders
    return modelProviders.filter((provider) =>
      [provider.label, provider.providerKey, providerDescription(provider)]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [modelProviders, searchQuery])

  const filteredMcpServers = useMemo(
    () => filterMcpServers(mcpServers, searchQuery),
    [mcpServers, searchQuery],
  )

  const dispatchMcpsChanged = useCallback(() => {
    window.dispatchEvent(new CustomEvent(MCPS_CHANGED_EVENT))
    window.dispatchEvent(new CustomEvent(EXTENSIONS_CHANGED_EVENT))
  }, [])

  async function handleSaveMcp(values: McpServerFormValues): Promise<boolean> {
    if (!projectId) return false
    if (mcpDialog?.mode === 'edit' && mcpDialog.server) {
      const res = await overlayAppClient.mcpServers.updateResponse(createMcpUpdateRequest(mcpDialog.server._id, values, projectId))
      if (!res.ok) return false
      setMcpServers((prev) => upsertMcpServerSummary(prev, updateMcpSummaryFromForm(mcpDialog.server!, values)))
      dispatchMcpsChanged()
      return true
    }

    const res = await overlayAppClient.mcpServers.createResponse(createMcpCreateRequest(values, projectId))
    if (!res.ok) return false
    const { id } = (await res.json()) as { id: string }
    setMcpServers((prev) => upsertMcpServerSummary(prev, createMcpSummaryFromForm(id, values, projectId)))
    dispatchMcpsChanged()
    return true
  }

  async function handleDeleteMcp(server: McpServerSummary): Promise<boolean> {
    if (!projectId) return false
    const res = await overlayAppClient.mcpServers.deleteResponse({ mcpServerId: server._id, projectId })
    if (!res.ok) return false
    setMcpServers((prev) => removeMcpServerSummary(prev, server._id))
    dispatchMcpsChanged()
    return true
  }

  async function handleTestMcp(values: McpServerFormValues): Promise<McpTestResultState> {
    try {
      const res = await overlayAppClient.mcpServers.testResponse(createMcpTestRequest(values))
      const data = await res.json().catch(() => ({ error: 'Invalid response' })) as TestMcpServerResponse
      return formatMcpTestResult(data, res.ok)
    } catch {
      return { ok: false, message: 'Connection failed' }
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--background)] text-[var(--foreground)]">
      <div className="shrink-0 border-b border-[var(--border)] px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Connectors</h1>
          <div ref={createRef} className="relative">
            <button
              type="button"
              onClick={() => setCreateOpen((value) => !value)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-sm font-medium transition-colors hover:bg-[var(--border)]"
            >
              Create
              <ChevronDown size={14} className="text-[var(--muted)]" />
            </button>
            {createOpen ? (
              <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-lg">
                <CreateMenuItem icon={<KeyRound size={15} />} label="Custom API" onClick={() => { setCreateOpen(false); setTab('custom-api') }} />
                <CreateMenuItem
                  icon={<Server size={15} />}
                  label="Custom MCP"
                  onClick={() => {
                    setCreateOpen(false)
                    setTab('custom-mcp')
                    if (projectId) setMcpDialog({ mode: 'create' })
                  }}
                />
                <CreateMenuItem icon={<Braces size={15} />} label="Import MCP by JSON" onClick={() => { setCreateOpen(false); setTab('custom-mcp') }} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex h-10 items-center gap-2 rounded-md bg-[var(--surface-subtle)] px-3 text-[var(--muted)]">
          <Search size={16} strokeWidth={1.75} className="shrink-0" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search connectors"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--foreground)]"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        <div className="mt-5 flex items-center gap-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {activeTab === 'apps' ? (
          <CatalogGrid
            loading={appsLoading}
            emptyTitle="No apps found"
            items={filteredApps.map((app) => ({
              key: app.slug,
              title: app.name,
              description: app.description,
              icon: <IntegrationLogo logoUrl={app.logoUrl} name={app.name} size={40} />,
              action: <PlusAction title="Connect from a project" />,
            }))}
          />
        ) : null}

        {activeTab === 'custom-api' ? (
          <CatalogGrid
            loading={appsLoading}
            emptyTitle="No APIs found"
            items={filteredProviders.map((provider) => ({
              key: provider.id,
              title: provider.label,
              description: providerDescription(provider),
              icon: <ProviderIcon label={provider.label} />,
              action: <Check size={17} className="text-[var(--foreground)]" />,
            }))}
          />
        ) : null}

        {activeTab === 'custom-mcp' && !projectId ? (
          <ProjectScopedMcpNotice />
        ) : null}

        {activeTab === 'custom-mcp' && projectId ? (
          <CatalogGrid
            loading={mcpLoading}
            emptyTitle="No MCP servers found"
            emptyAction={(
              <button
                type="button"
                onClick={() => setMcpDialog({ mode: 'create' })}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
              >
                <Plus size={13} />
                Add MCP
              </button>
            )}
            items={filteredMcpServers.map((server) => ({
              key: server._id,
              title: server.name || 'Untitled',
              description: server.description || server.url,
              icon: <ProviderIcon label={server.name || 'M'} icon={<Server size={18} />} />,
              action: server.enabled
                ? <Check size={17} className="text-[var(--foreground)]" />
                : <span className="rounded border border-[var(--border)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Off</span>,
              onClick: () => setMcpDialog({ mode: 'edit', server }),
            }))}
          />
        ) : null}
      </div>

      {mcpDialog ? (
        <McpServerDialog
          state={mcpDialog}
          onClose={() => setMcpDialog(null)}
          onSave={handleSaveMcp}
          onDelete={handleDeleteMcp}
          onTest={handleTestMcp}
        />
      ) : null}
    </div>
  )
}

function ProjectScopedMcpNotice() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center text-center">
      <p className="text-sm font-medium text-[var(--foreground)]">Open a project to manage MCPs</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--muted)]">
        MCP servers are configured per project from Integrations settings.
      </p>
    </div>
  )
}

function CreateMenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
    >
      <span className="text-[var(--muted)]">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

function CatalogGrid({
  loading,
  emptyTitle,
  emptyAction,
  items,
}: {
  loading: boolean
  emptyTitle: string
  emptyAction?: React.ReactNode
  items: Array<{
    key: string
    title: string
    description?: string
    icon: React.ReactNode
    action: React.ReactNode
    onClick?: () => void
  }>
}) {
  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-[var(--muted)]">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center text-center">
        <p className="text-sm font-medium text-[var(--foreground)]">{emptyTitle}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">Try a different search.</p>
        {emptyAction}
      </div>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const content = (
          <>
            {item.icon}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[var(--foreground)]">{item.title}</span>
              {item.description ? (
                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--muted)]">{item.description}</span>
              ) : null}
            </span>
            <span className="shrink-0">{item.action}</span>
          </>
        )

        const className = "group flex min-h-[96px] items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-muted)]"

        return item.onClick ? (
          <button key={item.key} type="button" onClick={item.onClick} className={className}>
            {content}
          </button>
        ) : (
          <article key={item.key} className={className}>
            {content}
          </article>
        )
      })}
    </div>
  )
}

function ProviderIcon({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] text-sm font-semibold text-[var(--foreground)]">
      {icon ?? label.charAt(0).toUpperCase()}
    </span>
  )
}

function PlusAction({ title }: { title: string }) {
  return (
    <span
      title={title}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--foreground)] transition-colors group-hover:bg-[var(--surface-subtle)]"
    >
      <Plus size={17} />
    </span>
  )
}
