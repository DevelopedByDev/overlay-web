'use client'

// Compatibility wrapper: canonical integration contracts/controllers live in
// @overlay/app-core, typed transport in @overlay/api-client, and reusable
// presentation in @overlay/modules-react.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import {
  DEFAULT_CONNECTOR_CATALOG,
  connectorFromIntegrationSummary,
  filterConnectorCatalog,
  getAvailableConnectorRows,
  getConnectedConnectorRows,
  integrationRegistryToConnectorCatalog,
  mergeConnectorCatalogEntries,
  type AppBootstrapResponse,
  type ConnectedIntegrationsResponse,
  type ConnectorCatalogItem,
  type IntegrationSearchResponse,
} from '@overlay/app-core'
import { ExtensionPageHeader, IntegrationsPanel } from '@overlay/modules-react/extensions'
import { IntegrationListSkeleton } from '@overlay/ui/feedback'
import { INTEGRATIONS_BC_CHANNEL, notifyIntegrationsChanged } from '@/features/integrations/lib/integrations-events'
import { setIntegrationLogoUrl } from '@/features/integrations/lib/integration-logo-cache'
import { IntegrationsDialog } from '@/features/integrations/components/IntegrationsDialog'
import { overlayAppClient } from '@/shared/app/overlay-app-client'

const LIST_PAGE_SIZE = 8

type IntegrationsInitialData = {
  bootstrap?: AppBootstrapResponse | null
  connected?: ConnectedIntegrationsResponse | null
  catalog?: IntegrationSearchResponse | null
}
type ProjectOption = { _id: string; name: string; updatedAt?: number; deletedAt?: number }

function buildInitialIntegrationState(initialData?: IntegrationsInitialData) {
  const connected = new Set(initialData?.connected?.connected || [])
  let catalogItems: ConnectorCatalogItem[] = []

  if (initialData?.bootstrap?.integrationRegistry) {
    catalogItems = mergeConnectorCatalogEntries(
      catalogItems,
      integrationRegistryToConnectorCatalog(initialData.bootstrap.integrationRegistry),
    )
  }

  const connectedItems = (Array.isArray(initialData?.connected?.items) ? initialData.connected.items : []).map((item) =>
    connectorFromIntegrationSummary({ ...item, isConnected: true }),
  )
  catalogItems = mergeConnectorCatalogEntries(catalogItems, connectedItems)

  const searchedItems = (Array.isArray(initialData?.catalog?.items) ? initialData.catalog.items : []).map((item) =>
    connectorFromIntegrationSummary(item),
  )
  catalogItems = mergeConnectorCatalogEntries(catalogItems, searchedItems)

  const logos: Record<string, string | null> = {}
  for (const item of catalogItems) {
    logos[item.slug] = item.logoUrl ?? null
    logos[item.composioId] = item.logoUrl ?? null
  }

  return { connected, catalogItems, logos }
}

export default function IntegrationsView({
  userId: _userId,
  initialData,
}: {
  userId: string
  initialData?: IntegrationsInitialData
}) {
  void _userId
  const searchParams = useSearchParams()
  const projectId = searchParams?.get('projectId')?.trim() || ''
  const hasInitialData = Boolean(projectId && (initialData?.bootstrap || initialData?.connected || initialData?.catalog))
  const initialState = useMemo(() => buildInitialIntegrationState(initialData), [initialData])
  const [connected, setConnected] = useState<Set<string>>(() => initialState.connected)
  const [catalogItems, setCatalogItems] = useState<ConnectorCatalogItem[]>(() => initialState.catalogItems)
  const [logos, setLogos] = useState<Record<string, string | null>>(() => initialState.logos)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(!hasInitialData)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [connectedVisible, setConnectedVisible] = useState(LIST_PAGE_SIZE)
  const [availableVisible, setAvailableVisible] = useState(LIST_PAGE_SIZE)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const rememberLogos = useCallback((items: readonly ConnectorCatalogItem[]) => {
    setLogos((prev) => {
      const next = { ...prev }
      for (const item of items) {
        next[item.slug] = item.logoUrl ?? null
        next[item.composioId] = item.logoUrl ?? null
        setIntegrationLogoUrl(item.slug, item.logoUrl ?? null)
        setIntegrationLogoUrl(item.composioId, item.logoUrl ?? null)
      }
      return next
    })
  }, [])

  useEffect(() => {
    for (const item of initialState.catalogItems) {
      setIntegrationLogoUrl(item.slug, item.logoUrl ?? null)
      setIntegrationLogoUrl(item.composioId, item.logoUrl ?? null)
    }
  }, [initialState.catalogItems])

  const loadRegistry = useCallback(async () => {
    try {
      const res = await overlayAppClient.bootstrap.getResponse()
      if (!res.ok) return
      const data = (await res.json()) as AppBootstrapResponse
      const items = integrationRegistryToConnectorCatalog(data.integrationRegistry ?? [])
      setCatalogItems((prev) => mergeConnectorCatalogEntries(prev, items))
      rememberLogos(items)
    } catch {
      // optional registry metadata
    }
  }, [rememberLogos])

  const loadConnected = useCallback(async () => {
    if (!projectId) {
      setConnected(new Set())
      setIsLoading(false)
      return
    }
    try {
      const data = await overlayAppClient.integrations.get<ConnectedIntegrationsResponse>({ projectId })
      setConnected(new Set(data.connected || []))
      const items = (Array.isArray(data.items) ? data.items : []).map((item) =>
        connectorFromIntegrationSummary({ ...item, isConnected: true }),
      )
      if (items.length > 0) {
        setCatalogItems((prev) => mergeConnectorCatalogEntries(prev, items))
        rememberLogos(items)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [projectId, rememberLogos])

  const loadCatalog = useCallback(async () => {
    try {
      const data = await overlayAppClient.integrations.get<IntegrationSearchResponse>({
        action: 'search',
        limit: 100,
        projectId: projectId || undefined,
      })
      const items = (Array.isArray(data.items) ? data.items : []).map((item) => connectorFromIntegrationSummary(item))
      setCatalogItems((prev) => mergeConnectorCatalogEntries(prev, items))
      rememberLogos(items)
    } catch {
      // optional
    }
  }, [projectId, rememberLogos])

  useEffect(() => {
    if (projectId) return
    let cancelled = false
    setProjectsLoading(true)
    overlayAppClient.projects.get<ProjectOption[]>()
      .then((items) => {
        if (cancelled) return
        setProjects((items ?? []).filter((project) => !project.deletedAt))
      })
      .catch(() => {
        if (!cancelled) setProjects([])
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  useEffect(() => {
    void loadRegistry()
    void loadConnected()
    void loadCatalog()
  }, [loadCatalog, loadConnected, loadRegistry])

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

  async function handleConnect(integration: ConnectorCatalogItem) {
    if (!projectId) return
    if (connecting) return
    setConnectError(null)
    setConnecting(integration.composioId)

    let oauthTab: Window | null = null
    if (!connected.has(integration.composioId)) {
      oauthTab = window.open('about:blank', '_blank')
    }

    try {
      if (connected.has(integration.composioId)) {
        const res = await overlayAppClient.integrations.disconnectResponse({
          toolkit: integration.composioId,
          projectId,
        })
        if (res.ok) {
          setConnected((prev) => {
            const next = new Set(prev)
            next.delete(integration.composioId)
            return next
          })
          notifyIntegrationsChanged()
          posthog.capture('integration_disconnected', { integration: integration.composioId, integration_name: integration.name })
        } else {
          const data = await res.json().catch(() => ({}))
          setConnectError(data.error || 'Failed to disconnect')
        }
      } else {
        const res = await overlayAppClient.integrations.connectResponse({
          action: 'connect',
          toolkit: integration.composioId,
          projectId,
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

  const dialogConnect = useCallback(async (slug: string) => {
    if (!projectId) throw new Error('Choose a project before connecting integrations')
    const oauthTab = window.open('about:blank', '_blank')
    try {
      const res = await overlayAppClient.integrations.connectResponse({ action: 'connect', toolkit: slug, projectId })
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
  }, [projectId])

  const dialogDisconnect = useCallback(async (slug: string) => {
    if (!projectId) throw new Error('Choose a project before disconnecting integrations')
    const res = await overlayAppClient.integrations.disconnectResponse({ toolkit: slug, projectId })
    if (!res.ok) throw new Error('Failed to disconnect')
    setConnected((prev) => {
      const next = new Set(prev)
      next.delete(slug)
      return next
    })
    notifyIntegrationsChanged()
    posthog.capture('integration_disconnected', { integration: slug })
  }, [projectId])

  const connectedRows = useMemo(() => getConnectedConnectorRows(connected, catalogItems), [connected, catalogItems])
  const availableList = useMemo(() => getAvailableConnectorRows(connected, catalogItems, DEFAULT_CONNECTOR_CATALOG), [connected, catalogItems])

  useEffect(() => {
    setConnectedVisible(LIST_PAGE_SIZE)
  }, [connected.size])

  useEffect(() => {
    setAvailableVisible(LIST_PAGE_SIZE)
  }, [availableList.length])

  const filteredConnectedRows = useMemo(
    () => filterConnectorCatalog(connectedRows, searchQuery),
    [connectedRows, searchQuery],
  )
  const filteredAvailableList = useMemo(
    () => filterConnectorCatalog(availableList, searchQuery),
    [availableList, searchQuery],
  )

  if (!projectId) {
    return (
      <div className="flex h-full flex-col">
        <ExtensionPageHeader
          title="Integrations"
          searchOpen={false}
          searchQuery=""
          searchPlaceholder="Search integrations…"
          searchTitle="Search integrations"
          onSearchOpenChange={() => {}}
          onSearchQueryChange={() => {}}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-8">
            <div className="mb-5">
              <h3 className="text-sm font-medium text-[var(--foreground)]">Choose a project</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Integrations are connected separately for each project.
              </p>
            </div>

            {projectsLoading ? (
              <IntegrationListSkeleton rows={4} />
            ) : projects.length > 0 ? (
              <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {projects.map((project) => (
                  <a
                    key={project._id}
                    href={`/app/integrations?projectId=${encodeURIComponent(project._id)}`}
                    className="flex items-center justify-between gap-4 py-3 text-sm transition-colors hover:bg-[var(--surface-subtle)]"
                  >
                    <span className="truncate text-[var(--foreground)]">{project.name}</span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">Open</span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="py-8 text-sm text-[var(--muted)]">
                No projects yet. <a href="/app/projects" className="text-[var(--foreground)] underline">Create a project</a> to connect integrations.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ExtensionPageHeader
        title="Integrations"
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        searchPlaceholder="Search integrations…"
        searchTitle="Search integrations"
        onSearchOpenChange={setSearchOpen}
        onSearchQueryChange={setSearchQuery}
      />

      <IntegrationsPanel
        loading={isLoading}
        loadingFallback={<IntegrationListSkeleton rows={10} />}
        connectedRows={filteredConnectedRows}
        availableRows={filteredAvailableList}
        connectedVisible={connectedVisible}
        availableVisible={availableVisible}
        connectingSlug={connecting}
        error={connectError}
        logoUrls={logos}
        onClearError={() => setConnectError(null)}
        onConnectToggle={(integration) => void handleConnect(integration)}
        onShowMoreConnected={() => setConnectedVisible((n) => n + LIST_PAGE_SIZE)}
        onShowMoreAvailable={() => setAvailableVisible((n) => n + LIST_PAGE_SIZE)}
        onOpenCatalog={() => setIsDialogOpen(true)}
      />

      <IntegrationsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConnect={dialogConnect}
        onDisconnect={dialogDisconnect}
        projectId={projectId}
      />
    </div>
  )
}
