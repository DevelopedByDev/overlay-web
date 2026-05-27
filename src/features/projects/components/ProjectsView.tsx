'use client'

// Compatibility wrapper: canonical project contracts/controllers live in @overlay/app-core,
// typed transport lives in @overlay/api-client, and reusable presentation lives in @overlay/modules-react.
import { useState, useEffect, useRef, useCallback, useMemo, type MouseEvent, type ReactNode } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { BookOpen, ExternalLink, FileText, Folder, GitBranch, Loader2, MessageSquare, Plug, Plus, Search, Sparkles, Wrench } from 'lucide-react'
import {
  CHAT_CREATED_EVENT,
  CHAT_DELETED_EVENT,
  CHAT_TITLE_UPDATED_EVENT,
  type ChatCreatedDetail,
  type ChatDeletedDetail,
  type ChatTitleUpdatedDetail,
} from '@/shared/chat/chat-title'
import {
  FILES_CHANGED_EVENT,
  PROJECT_META_UPDATED_EVENT,
  PROJECTS_CHANGED_EVENT,
  DEFAULT_CONNECTOR_CATALOG,
  EXTENSIONS_CHANGED_EVENT,
  MCPS_CHANGED_EVENT,
  connectorFromIntegrationSummary,
  createMcpCreateRequest,
  createMcpSummaryFromForm,
  createMcpTestRequest,
  createMcpUpdateRequest,
  filterConnectorCatalog,
  filterMcpServers,
  formatMcpTestResult,
  getAvailableConnectorRows,
  getConnectedConnectorRows,
  integrationRegistryToConnectorCatalog,
  mergeConnectorCatalogEntries,
  removeMcpServerSummary,
  setMcpServerEnabled,
  createProjectNoteRequest,
  childProjects as getChildProjects,
  projectHubHref,
  projectItemHref,
  projectRouteViewForFile,
  rootProjects as getRootProjects,
  sortProjectChats,
  sortProjectFilesByUpdated,
  updateMcpSummaryFromForm,
  upsertMcpServerSummary,
  type AppBootstrapResponse,
  type ConnectedIntegrationsResponse,
  type ConnectorCatalogItem,
  type GithubRepositoryOption,
  type GithubToolInfo,
  type IntegrationSearchResponse,
  type McpServerFormValues,
  type McpServerSummary,
  type McpTestResultState,
  type OverlayToolRegistration,
  type ProjectChatSummary,
  type ProjectFileSummary,
  type ProjectMetaUpdatedDetail,
  type ProjectSettingsSectionId,
  type ProjectSummary,
  type TestMcpServerResponse,
} from '@overlay/app-core'
import {
  ProjectHubActions,
  ProjectHubHeader,
} from '@overlay/modules-react/projects'
import { IntegrationLogo, McpServerDialog, McpServersPanel } from '@overlay/modules-react/extensions'
import { ProjectSettingsDrawer, type ProjectSettingsSection } from '@overlay/modules-react/project-settings-drawer'
import { GithubRepoAllowlistPicker } from '@overlay/modules-react/github-repo-picker'
import { GithubToolsPicker } from '@overlay/modules-react/github-tools-picker'
import { FileViewerSkeleton } from '@overlay/ui/feedback'
import dynamic from 'next/dynamic'
import { FileViewerPanel, isEditableType } from '@/features/files/components/FileViewer'
import { FileShareMenu } from '@/features/files/components/FileShareMenu'
import { buildSharePageUrl } from '@/features/share/lib/share-url'
import { overlayAppClient } from '@/shared/app/overlay-app-client'
import { useGuestGate } from '@/components/providers/GuestGateProvider'
import { useAuth } from '@/contexts/AuthContext'

type HubChat = ProjectChatSummary
type ProjectFileRecord = ProjectFileSummary

const ChatInterface = dynamic(() => import('@/features/chat/components/ChatInterface'))
const NotebookEditor = dynamic(() => import('@/features/notebook/components/NotebookEditor'))
const ProjectSkillsView = dynamic(() => import('@/features/automations/components/SkillsView'))

const PROJECT_SETTINGS_SECTION_IDS = [
  'chats',
  'files',
  'instructions',
  'integrations',
  'github-tools',
  'skills',
] as const satisfies readonly ProjectSettingsSectionId[]

type ProjectIntegrationsTabId = 'apps' | 'mcps' | 'tools'

const PROJECT_INTEGRATIONS_TABS: Array<{ id: ProjectIntegrationsTabId; label: string }> = [
  { id: 'apps', label: 'Apps' },
  { id: 'mcps', label: 'MCPs' },
  { id: 'tools', label: 'Tools' },
]

const PROJECT_INTEGRATION_LIST_PAGE_SIZE = 8
const INTEGRATIONS_BC_CHANNEL = 'overlay-integrations'

function resolveProjectSettingsSectionId(value: string | null): ProjectSettingsSectionId | null {
  if (value === 'github-repositories' || value === 'mcps' || value === 'tools') return 'integrations'
  return PROJECT_SETTINGS_SECTION_IDS.includes(value as (typeof PROJECT_SETTINGS_SECTION_IDS)[number])
    ? (value as ProjectSettingsSectionId)
    : null
}

function resolveProjectIntegrationsTabId(value: string | null): ProjectIntegrationsTabId | null {
  if (value === 'apps' || value === 'integrations' || value === 'github-repositories') return 'apps'
  if (value === 'mcps' || value === 'mcp' || value === 'custom-mcp') return 'mcps'
  if (value === 'tools' || value === 'tool' || value === 'custom-api') return 'tools'
  return null
}

function localStorageGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function localStorageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private browsing or quota errors should not break the project view.
  }
}

// ─── File viewer fetched by ID ────────────────────────────────────────────────

function ProjectFileView({ fileId }: { fileId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [file, setFile] = useState<ProjectFileRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [fileContent, setFileContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const timeoutId = setTimeout(() => {
      setLoading(true)
      overlayAppClient.files.get<ProjectFileRecord>({ fileId })
        .then((data) => {
          if (cancelled) return
          if (projectRouteViewForFile(data) === 'note') {
            const p = new URLSearchParams(searchParams?.toString() ?? '')
            p.set('view', 'note')
            p.set('id', fileId)
            router.replace(`/app/projects?${p.toString()}`)
            return
          }
          setFile(data)
          setFileContent(data.textContent ?? data.content ?? '')
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
          }
        })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [fileId, router, searchParams])

  function handleContentChange(val: string) {
    setFileContent(val)
    if (!file) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true)
      await overlayAppClient.files.updateResponse({ fileId, textContent: val })
      setIsSaving(false)
    }, 800)
  }

  if (loading) {
    return <FileViewerSkeleton />
  }
  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#aaa] text-sm">
        File not found
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FileViewerPanel
        name={file.name}
        content={fileContent}
        isSaving={isSaving}
        isEditable={isEditableType(file.name)}
        onContentChange={handleContentChange}
        headerRight={
          <FileShareMenu
            fileId={file._id}
            title={file.name}
            initialShareVisibility={file.shareVisibility ?? 'private'}
            initialShareUrl={
              file.shareVisibility === 'public' && file.shareToken
                ? buildSharePageUrl('file', file.shareToken)
                : null
            }
          />
        }
      />
    </div>
  )
}

function ProjectDrawerSectionIntro({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function ProjectDrawerLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
    >
      {children}
      <ExternalLink size={12} />
    </a>
  )
}

function ProjectChatsSettingsPanel({
  chats,
  loading,
  onOpenChat,
}: {
  chats: readonly HubChat[]
  loading?: boolean
  onOpenChat: (id: string) => void
}) {
  return (
    <section>
      <ProjectDrawerSectionIntro
        title="Chats"
      />
      {loading ? (
        <div className="flex justify-center py-8 text-[var(--muted)]">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : chats.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted)]">
          No chats yet.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {chats.map((chat) => (
            <li key={chat._id}>
              <button
                type="button"
                onClick={() => onOpenChat(chat._id)}
                className="flex w-full items-center gap-2 py-2.5 text-left text-sm text-[var(--foreground)] transition-colors hover:opacity-80"
              >
                <MessageSquare size={14} className="shrink-0 text-[var(--muted-light)]" />
                <span className="min-w-0 flex-1 truncate">{chat.title || 'Untitled'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ProjectFilesSettingsPanel({
  files,
  loading,
  onOpenFile,
}: {
  files: readonly ProjectFileRecord[]
  loading?: boolean
  onOpenFile: (file: ProjectFileRecord) => void
}) {
  return (
    <section>
      <ProjectDrawerSectionIntro
        title="Files"
      />
      {loading ? (
        <div className="flex justify-center py-8 text-[var(--muted)]">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted)]">
          No files yet.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {files.map((file) => (
            <li key={file._id}>
              <button
                type="button"
                onClick={() => onOpenFile(file)}
                className="flex w-full items-center gap-2 py-2.5 text-left text-sm text-[var(--foreground)] transition-colors hover:opacity-80"
              >
                {projectRouteViewForFile(file) === 'note' ? (
                  <BookOpen size={14} className="shrink-0 text-[var(--muted-light)]" />
                ) : (
                  <FileText size={14} className="shrink-0 text-[var(--muted-light)]" />
                )}
                <span className="min-w-0 flex-1 truncate">{file.name || 'Untitled'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ProjectInstructionsSettingsPanel({
  instructions,
  instructionsLoaded,
  savingInstructions,
  instructionsSavedAt,
  onInstructionsChange,
}: {
  instructions: string
  instructionsLoaded: boolean
  savingInstructions?: boolean
  instructionsSavedAt?: number | null
  onInstructionsChange: (value: string) => void
}) {
  return (
    <section>
      <ProjectDrawerSectionIntro
        title="Instructions"
      />
      <textarea
        value={instructions}
        disabled={!instructionsLoaded}
        onChange={(event) => onInstructionsChange(event.target.value)}
        placeholder={instructionsLoaded ? 'Project instructions...' : 'Loading...'}
        rows={12}
        className="min-h-64 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm leading-6 text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)] disabled:opacity-60"
      />
      <div className="mt-2 flex h-4 items-center text-[11px] text-[var(--muted-light)]">
        {savingInstructions ? 'Saving...' : instructionsSavedAt ? 'Saved' : ''}
      </div>
    </section>
  )
}

function ProjectIntegrationsSettingsPanel({
  projectId,
  activeTab,
  connectedRows,
  availableRows,
  tools,
  searchQuery,
  integrationsLoading,
  lastIntegrationsError,
  connectError,
  connectingSlug,
  pendingConnectRedirect,
  logoUrls,
  connectedVisible,
  availableVisible,
  githubRepoPicker,
  onActiveTabChange,
  onSearchQueryChange,
  onClearConnectError,
  onDismissPendingConnectRedirect,
  onConnectToggle,
  onShowMoreConnected,
  onShowMoreAvailable,
}: {
  projectId: string
  activeTab: ProjectIntegrationsTabId
  connectedRows: readonly ConnectorCatalogItem[]
  availableRows: readonly ConnectorCatalogItem[]
  tools: readonly OverlayToolRegistration[]
  searchQuery?: string | null
  integrationsLoading: boolean
  lastIntegrationsError?: string | null
  connectError?: string | null
  connectingSlug?: string | null
  pendingConnectRedirect?: { url: string; name: string; slug: string } | null
  logoUrls: Readonly<Record<string, string | null>>
  connectedVisible: number
  availableVisible: number
  githubRepoPicker: ReactNode
  onActiveTabChange: (tab: ProjectIntegrationsTabId) => void
  onSearchQueryChange: (query: string) => void
  onClearConnectError: () => void
  onDismissPendingConnectRedirect: () => void
  onConnectToggle: (integration: ConnectorCatalogItem) => void
  onShowMoreConnected: () => void
  onShowMoreAvailable: () => void
}) {
  const normalizedSearchQuery = searchQuery ?? ''
  const connectedShown = connectedRows.slice(0, connectedVisible)
  const availableShown = availableRows.slice(0, availableVisible)
  const hasSearch = normalizedSearchQuery.trim().length > 0
  const hasNoSearchResults = hasSearch && connectedRows.length === 0 && availableRows.length === 0
  const searchPlaceholder =
    activeTab === 'apps'
      ? 'Search applications...'
      : activeTab === 'mcps'
        ? 'Search MCP servers...'
        : 'Search tools...'

  function handleTabChange(tab: ProjectIntegrationsTabId) {
    if (tab === activeTab) return
    onSearchQueryChange('')
    onActiveTabChange(tab)
  }

  return (
    <section>
      <ProjectDrawerSectionIntro title="Integrations" />
      <div className="mb-4 flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5">
        <Search size={13} className="shrink-0 text-[var(--muted)]" />
        <input
          type="search"
          value={normalizedSearchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
        />
      </div>
      <div role="tablist" aria-label="Integration settings" className="mb-4 flex items-center gap-2">
        {PROJECT_INTEGRATIONS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={[
              'h-8 rounded-full px-3 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'apps' ? (
        <>
          {lastIntegrationsError ? (
            <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {lastIntegrationsError}
            </div>
          ) : null}
          {connectError ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              <span>{connectError}</span>
              <button
                type="button"
                onClick={onClearConnectError}
                className="shrink-0 rounded px-1.5 py-0.5 text-[var(--foreground)] hover:bg-red-500/10"
              >
                Dismiss
              </button>
            </div>
          ) : null}
          {pendingConnectRedirect ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--foreground)]">
              <span className="min-w-0 flex-1">
                If the {pendingConnectRedirect.name} window did not open, click below to finish connecting.
              </span>
              <a
                href={pendingConnectRedirect.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
              >
                Open OAuth window
                <ExternalLink size={11} />
              </a>
              <button
                type="button"
                onClick={onDismissPendingConnectRedirect}
                className="shrink-0 rounded px-1.5 py-0.5 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {integrationsLoading && availableRows.length === 0 && connectedRows.length === 0 ? (
            <div className="flex justify-center py-6 text-[var(--muted)]">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : hasNoSearchResults ? (
            <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted)]">
              No applications match your search.
            </p>
          ) : (
            <div className="space-y-5">
              {connectedShown.length > 0 ? (
                <ProjectIntegrationList
                  title="Connected"
                  rows={connectedShown}
                  connected
                  connectingSlug={connectingSlug}
                  logoUrls={logoUrls}
                  nestedIntegrationSlug="github"
                  nestedContent={githubRepoPicker}
                  onConnectToggle={onConnectToggle}
                />
              ) : null}

              <ProjectIntegrationList
                title="Applications"
                rows={availableShown}
                connected={false}
                connectingSlug={connectingSlug}
                logoUrls={logoUrls}
                nestedIntegrationSlug="github"
                nestedContent={githubRepoPicker}
                onConnectToggle={onConnectToggle}
              />

              <div className="space-y-2">
                {connectedVisible < connectedRows.length ? (
                  <ProjectDrawerShowMoreButton onClick={onShowMoreConnected} label="Show more connected" />
                ) : null}
                {availableVisible < availableRows.length ? (
                  <ProjectDrawerShowMoreButton onClick={onShowMoreAvailable} label="Show more applications" />
                ) : null}
              </div>

              {integrationsLoading ? (
                <div className="flex items-center gap-2 px-1 text-xs text-[var(--muted)]">
                  <Loader2 size={13} className="animate-spin" />
                  Refreshing applications...
                </div>
              ) : null}
            </div>
          )}
        </>
      ) : null}

      {activeTab === 'mcps' ? <ProjectMcpSettingsPanel projectId={projectId} searchQuery={normalizedSearchQuery} /> : null}
      {activeTab === 'tools' ? (
        <ProjectToolsSettingsPanel
          projectId={projectId}
          tools={tools}
          searchQuery={normalizedSearchQuery}
          loading={integrationsLoading && tools.length === 0}
        />
      ) : null}
    </section>
  )
}

function ProjectIntegrationList({
  title,
  rows,
  connected,
  connectingSlug,
  logoUrls,
  nestedIntegrationSlug,
  nestedContent,
  onConnectToggle,
}: {
  title: string
  rows: readonly ConnectorCatalogItem[]
  connected: boolean
  connectingSlug?: string | null
  logoUrls: Readonly<Record<string, string | null>>
  nestedIntegrationSlug?: string
  nestedContent?: ReactNode
  onConnectToggle: (integration: ConnectorCatalogItem) => void
}) {
  if (rows.length === 0) {
    return (
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-light)]">{title}</p>
        <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted)]">
          No {connected ? 'connected applications' : 'applications'} found.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-light)]">{title}</p>
      <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
        {rows.map((integration) => {
          const isConnecting = connectingSlug === integration.composioId
          const showNested =
            Boolean(nestedContent) &&
            (integration.slug === nestedIntegrationSlug || integration.composioId === nestedIntegrationSlug)
          return (
            <div key={integration.composioId}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <IntegrationLogo
                  logoUrl={logoUrls[integration.composioId] ?? logoUrls[integration.slug] ?? integration.logoUrl}
                  name={integration.name}
                  size={30}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">{integration.name}</p>
                  {integration.description ? (
                    <p className="truncate text-xs text-[var(--muted)]">{integration.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onConnectToggle(integration)}
                  disabled={isConnecting}
                  className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
                >
                  {isConnecting ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : connected ? (
                    'Disconnect'
                  ) : (
                    'Connect'
                  )}
                </button>
              </div>
              {showNested ? (
                <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3">
                  {nestedContent}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProjectDrawerShowMoreButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
    >
      {label}
    </button>
  )
}

type ProjectMcpDialogState = {
  mode: 'create' | 'edit'
  server?: McpServerSummary
}

function ProjectMcpSettingsPanel({ projectId, searchQuery }: { projectId: string; searchQuery: string }) {
  const [servers, setServers] = useState<McpServerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<ProjectMcpDialogState | null>(null)

  const dispatchMcpsChanged = useCallback(() => {
    window.dispatchEvent(new CustomEvent(MCPS_CHANGED_EVENT))
    window.dispatchEvent(new CustomEvent(EXTENSIONS_CHANGED_EVENT))
  }, [])

  const loadServers = useCallback(async () => {
    setLoading(true)
    try {
      setServers(await overlayAppClient.mcpServers.get<McpServerSummary[]>({ projectId }))
    } catch {
      setServers([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadServers()
  }, [loadServers])

  const filteredServers = useMemo(
    () => filterMcpServers(servers, searchQuery),
    [servers, searchQuery],
  )

  async function handleSaveServer(values: McpServerFormValues): Promise<boolean> {
    if (dialog?.mode === 'edit' && dialog.server) {
      const res = await overlayAppClient.mcpServers.updateResponse(createMcpUpdateRequest(dialog.server._id, values, projectId))
      if (!res.ok) return false
      setServers((prev) => upsertMcpServerSummary(prev, updateMcpSummaryFromForm(dialog.server!, values)))
      dispatchMcpsChanged()
      return true
    }

    const res = await overlayAppClient.mcpServers.createResponse(createMcpCreateRequest(values, projectId))
    if (!res.ok) return false
    const { id } = (await res.json()) as { id: string }
    setServers((prev) => upsertMcpServerSummary(prev, createMcpSummaryFromForm(id, values, projectId)))
    dispatchMcpsChanged()
    return true
  }

  async function handleDeleteServer(server: McpServerSummary): Promise<boolean> {
    const res = await overlayAppClient.mcpServers.deleteResponse({ mcpServerId: server._id, projectId })
    if (!res.ok) return false
    setServers((prev) => removeMcpServerSummary(prev, server._id))
    dispatchMcpsChanged()
    return true
  }

  async function handleTestServer(values: McpServerFormValues): Promise<McpTestResultState> {
    try {
      const res = await overlayAppClient.mcpServers.testResponse(createMcpTestRequest(values))
      const data = await res.json().catch(() => ({ error: 'Invalid response' })) as TestMcpServerResponse
      return formatMcpTestResult(data, res.ok)
    } catch {
      return { ok: false, message: 'Connection failed' }
    }
  }

  async function handleQuickToggle(server: McpServerSummary, event: MouseEvent) {
    event.stopPropagation()
    const newEnabled = !server.enabled
    setServers((prev) => prev.map((item) => (item._id === server._id ? setMcpServerEnabled(item, newEnabled) : item)))
    try {
      const res = await overlayAppClient.mcpServers.updateResponse({ mcpServerId: server._id, projectId, enabled: newEnabled })
      if (res.ok) dispatchMcpsChanged()
    } catch {
      // Keep the optimistic UI behavior aligned with the full MCP settings view.
    }
  }

  const noSearchResults = !loading && servers.length > 0 && filteredServers.length === 0

  return (
    <div className="flex min-h-[28rem] flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-light)]">MCP Servers</p>
        <button
          type="button"
          onClick={() => setDialog({ mode: 'create' })}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
        >
          <Plus size={12} />
          Add MCP
        </button>
      </div>

      {noSearchResults ? (
        <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted)]">
          No MCP servers match your search.
        </p>
      ) : (
        <div className="-mx-4 flex min-h-0 flex-1 flex-col">
          <McpServersPanel
            loading={loading}
            servers={servers}
            filteredServers={filteredServers}
            onCreate={() => setDialog({ mode: 'create' })}
            onEdit={(server) => setDialog({ mode: 'edit', server })}
            onToggle={(server, event) => void handleQuickToggle(server, event)}
          />
        </div>
      )}

      {dialog ? (
        <McpServerDialog
          state={dialog}
          onClose={() => setDialog(null)}
          onSave={handleSaveServer}
          onDelete={handleDeleteServer}
          onTest={handleTestServer}
        />
      ) : null}
    </div>
  )
}

function filterProjectTools(
  tools: readonly OverlayToolRegistration[],
  query: string,
): OverlayToolRegistration[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...tools]
  return tools.filter((tool) =>
    [tool.label, tool.description, tool.category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
}

function ProjectToolsSettingsPanel({
  projectId,
  tools,
  searchQuery,
  loading,
}: {
  projectId: string
  tools: readonly OverlayToolRegistration[]
  searchQuery: string
  loading: boolean
}) {
  const filteredTools = useMemo(
    () => filterProjectTools(tools, searchQuery),
    [tools, searchQuery],
  )

  if (loading) {
    return (
      <div className="flex justify-center py-6 text-[var(--muted)]">
        <Loader2 size={16} className="animate-spin" />
      </div>
    )
  }

  if (filteredTools.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted)]">
        {searchQuery.trim() ? 'No tools match your search.' : 'No tools configured.'}
      </p>
    )
  }

  return (
    <section>
      <ProjectDrawerSectionIntro
        title="Tools"
        action={<ProjectDrawerLink href={`/app/tools?projectId=${encodeURIComponent(projectId)}&view=all`}>Open</ProjectDrawerLink>}
      />
      <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
        {filteredTools.map((tool) => (
          <article key={tool.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--muted)]">
              <Wrench size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[var(--foreground)]">{tool.label}</span>
              {tool.description ? (
                <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{tool.description}</span>
              ) : null}
            </span>
            {tool.category ? (
              <span className="shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {tool.category}
              </span>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function notifyProjectIntegrationsChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('overlay:integrations-changed'))
  try {
    const bc = new BroadcastChannel(INTEGRATIONS_BC_CHANNEL)
    bc.postMessage({ type: 'changed' as const })
    bc.close()
  } catch {
    // BroadcastChannel is optional.
  }
}

// ─── Project hub: ChatInterface + drawer-based project controls ──────────────

function ProjectHubBody({
  projectId,
  projectName,
  userId,
  firstName,
}: {
  projectId: string
  projectName: string
  userId: string
  firstName?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [chats, setChats] = useState<HubChat[]>([])
  const [files, setFiles] = useState<ProjectFileRecord[]>([])
  const [listsLoading, setListsLoading] = useState(true)

  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(projectName)
  const [savingName, setSavingName] = useState(false)
  useEffect(() => { setDraftName(projectName) }, [projectName])

  const [instructions, setInstructions] = useState<string>('')
  const [instructionsLoaded, setInstructionsLoaded] = useState(false)
  const [savingInstructions, setSavingInstructions] = useState(false)
  const [instructionsSavedAt, setInstructionsSavedAt] = useState<number | null>(null)
  const instructionsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { refreshSession } = useAuth()
  const { requireAuth } = useGuestGate()
  const [connectedIntegrationSlugs, setConnectedIntegrationSlugs] = useState<Set<string>>(() => new Set())
  const [integrationCatalogItems, setIntegrationCatalogItems] = useState<ConnectorCatalogItem[]>([])
  const [integrationLogoUrls, setIntegrationLogoUrls] = useState<Record<string, string | null>>({})
  const [integrationsLoading, setIntegrationsLoading] = useState(true)
  const [lastIntegrationsError, setLastIntegrationsError] = useState<string | null>(null)
  const [connectingIntegrationSlug, setConnectingIntegrationSlug] = useState<string | null>(null)
  const [integrationConnectError, setIntegrationConnectError] = useState<string | null>(null)
  // OAuth fallback: if the pre-opened popup is blocked, invisible, or gets
  // closed by the Composio bouncer, surface the redirectUrl as a direct
  // anchor click so the user can complete OAuth via a fresh user gesture.
  const [pendingConnectRedirect, setPendingConnectRedirect] = useState<{
    url: string
    name: string
    /** Toolkit slug we just attempted to connect; used to optimistically merge
     * into `connectedIntegrationSlugs` until Composio's v1 list endpoint
     * catches up to the new connection. */
    slug: string
  } | null>(null)
  // Mirror of the above for reads inside async callbacks that close over
  // earlier state (notably `loadProjectIntegrations`).
  const pendingConnectRedirectRef = useRef<{ url: string; name: string; slug: string } | null>(null)
  const [integrationSearchQuery, setIntegrationSearchQuery] = useState('')
  const [activeIntegrationsTab, setActiveIntegrationsTab] = useState<ProjectIntegrationsTabId>('apps')
  const [projectToolRegistry, setProjectToolRegistry] = useState<OverlayToolRegistration[]>([])
  const [connectedIntegrationsVisible, setConnectedIntegrationsVisible] =
    useState(PROJECT_INTEGRATION_LIST_PAGE_SIZE)
  const [availableIntegrationsVisible, setAvailableIntegrationsVisible] =
    useState(PROJECT_INTEGRATION_LIST_PAGE_SIZE)

  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false)
  const [activeSettingsSectionId, setActiveSettingsSectionId] =
    useState<ProjectSettingsSectionId>('chats')
  const [layoutMode, setLayoutMode] = useState<'push' | 'overlay'>('push')
  const [githubConnected, setGithubConnected] = useState(false)
  const [draftAllowlist, setDraftAllowlist] = useState<readonly string[]>([])
  const [saveAllowlistError, setSaveAllowlistError] = useState(false)
  const [repoOptions, setRepoOptions] = useState<readonly GithubRepositoryOption[]>([])
  const [repoLoading, setRepoLoading] = useState(false)
  const [repoError, setRepoError] =
    useState<'github_not_connected' | 'fetch_failed' | 'rate_limited' | null>(null)
  // GitHub tools picker — preserves "field absent → use server defaults"
  // semantic by leaving `draftToolsEnabled` undefined until the server returns
  // a concrete list (either an explicit override on the project, or [] for
  // "user opted everything out").
  const [draftToolsEnabled, setDraftToolsEnabled] = useState<readonly string[] | undefined>(undefined)
  const [toolOptions, setToolOptions] = useState<readonly GithubToolInfo[]>([])
  const [toolDefaultEnabled, setToolDefaultEnabled] = useState<readonly string[]>([])
  const [toolHardDenied, setToolHardDenied] = useState<readonly string[]>([])
  const [toolsLoading, setToolsLoading] = useState(false)
  const [toolsError, setToolsError] =
    useState<'github_not_connected' | 'fetch_failed' | 'rate_limited' | null>(null)
  const [saveToolsError, setSaveToolsError] = useState(false)

  useEffect(() => {
    const storedOpen = localStorageGet('overlay.project-settings-drawer.open')
    if (storedOpen === 'true') setSettingsDrawerOpen(true)
    const storedSection = localStorageGet('overlay.project-settings-drawer.active-section')
    const resolvedSection = resolveProjectSettingsSectionId(storedSection)
    if (resolvedSection) setActiveSettingsSectionId(resolvedSection)
    const storedIntegrationsTab = localStorageGet('overlay.project-settings-drawer.integrations-tab')
    const legacyIntegrationsTab =
      storedSection === 'github-repositories' || storedSection === 'mcps' || storedSection === 'tools'
        ? resolveProjectIntegrationsTabId(storedSection)
        : null
    const resolvedIntegrationsTab =
      legacyIntegrationsTab ??
      resolveProjectIntegrationsTabId(storedIntegrationsTab)
    if (resolvedIntegrationsTab) setActiveIntegrationsTab(resolvedIntegrationsTab)
  }, [])

  useEffect(() => {
    localStorageSet('overlay.project-settings-drawer.open', String(settingsDrawerOpen))
  }, [settingsDrawerOpen])

  useEffect(() => {
    localStorageSet('overlay.project-settings-drawer.active-section', activeSettingsSectionId)
  }, [activeSettingsSectionId])

  useEffect(() => {
    localStorageSet('overlay.project-settings-drawer.integrations-tab', activeIntegrationsTab)
  }, [activeIntegrationsTab])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')
    setLayoutMode(mq.matches ? 'overlay' : 'push')
    function handleChange(event: MediaQueryListEvent) {
      setLayoutMode(event.matches ? 'overlay' : 'push')
    }
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  // Load project instructions and repository allowlist together.
  useEffect(() => {
    let cancelled = false
    setInstructionsLoaded(false)
    overlayAppClient.projects.get<{
      instructions?: string
      githubRepoAllowlist?: string[]
      githubToolsEnabled?: string[]
    } | null>({ projectId })
      .then((data) => {
        if (cancelled) return
        setInstructions((data?.instructions ?? '') as string)
        setDraftAllowlist(data?.githubRepoAllowlist ?? [])
        // Leave `draftToolsEnabled` undefined when the project doc has no
        // explicit override so the picker displays server defaults. An empty
        // array `[]` is a meaningful user choice ("disable everything") and is
        // preserved as-is.
        setDraftToolsEnabled(data?.githubToolsEnabled)
        setInstructionsLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setInstructionsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const saveAllowlist = useCallback(async (next: readonly string[]) => {
    try {
      // Use updateResponse so we can distinguish HTTP-level failures (e.g.
      // a 500 from a failing Convex mutation) from a real success. The
      // `update()` helper parses JSON regardless of status, which would
      // let a silent server failure pass for a save while the picker
      // visually reverted to the still-stale persisted value.
      const response = await overlayAppClient.projects.updateResponse({
        projectId,
        githubRepoAllowlist: [...next],
      })
      if (!response.ok) {
        console.error('[ProjectsView:saveAllowlist] non-2xx response', {
          status: response.status,
        })
        setSaveAllowlistError(true)
        return
      }
      const parsed = (await response.json()) as
        | { success?: boolean; project?: { githubRepoAllowlist?: string[] } | null; error?: string }
        | null
      if (!parsed?.project) {
        console.error('[ProjectsView:saveAllowlist] missing project in response', { parsed })
        setSaveAllowlistError(true)
        return
      }
      setDraftAllowlist(parsed.project.githubRepoAllowlist ?? [])
      setSaveAllowlistError(false)
    } catch (error) {
      console.error('[ProjectsView:saveAllowlist] network/parse failure', error)
      setSaveAllowlistError(true)
    }
  }, [projectId])

  const dismissSaveAllowlistError = useCallback(() => {
    setSaveAllowlistError(false)
  }, [])

  const saveToolsEnabled = useCallback(async (next: readonly string[]) => {
    // Optimistic update so the picker reflects the user's click immediately;
    // the server response below either reconciles or reverts via the error banner.
    setDraftToolsEnabled(next)
    setSaveToolsError(false)
    try {
      // Mirror `saveAllowlist`: use `updateResponse` so HTTP-level failures
      // (e.g. a 500 from a failing Convex mutation) are distinguishable from a
      // real success. `update()` parses JSON regardless of status, which would
      // let a silent server failure pass for a save.
      const response = await overlayAppClient.projects.updateResponse({
        projectId,
        githubToolsEnabled: [...next],
      })
      if (!response.ok) {
        console.error('[ProjectsView:saveToolsEnabled] non-2xx response', {
          status: response.status,
        })
        setSaveToolsError(true)
        return
      }
      const parsed = (await response.json()) as
        | { success?: boolean; project?: { githubToolsEnabled?: string[] } | null; error?: string }
        | null
      if (!parsed?.project) {
        console.error('[ProjectsView:saveToolsEnabled] missing project in response', { parsed })
        setSaveToolsError(true)
        return
      }
      // Reconcile with server-canonical list. `undefined` is preserved (means
      // the project has no explicit override and the picker falls back to
      // server defaults via `draftToolsEnabled ?? toolDefaultEnabled`).
      setDraftToolsEnabled(parsed.project.githubToolsEnabled)
    } catch (error) {
      console.error('[ProjectsView:saveToolsEnabled] network/parse failure', error)
      setSaveToolsError(true)
    }
  }, [projectId])

  const dismissSaveToolsError = useCallback(() => {
    setSaveToolsError(false)
  }, [])

  const rememberIntegrationLogos = useCallback((items: readonly ConnectorCatalogItem[]) => {
    setIntegrationLogoUrls((prev) => {
      const next = { ...prev }
      for (const item of items) {
        next[item.slug] = item.logoUrl ?? null
        next[item.composioId] = item.logoUrl ?? null
      }
      return next
    })
  }, [])

  const loadProjectIntegrations = useCallback(async () => {
    setIntegrationsLoading(true)
    setLastIntegrationsError(null)
    const [bootstrap, connectedData, catalogData] = await Promise.all([
      overlayAppClient.bootstrap.get().catch(() => null),
      overlayAppClient.integrations.get<ConnectedIntegrationsResponse>({ projectId }).catch(() => null),
      overlayAppClient.integrations.get<IntegrationSearchResponse>({
        action: 'search',
        limit: 100,
        projectId,
      }).catch(() => null),
    ])

    if (!connectedData && !catalogData && !bootstrap) {
      setLastIntegrationsError('Could not load project integrations.')
      setIntegrationsLoading(false)
      return
    }

    const baseSlugs = Array.isArray(connectedData?.connected) ? connectedData.connected : []
    // Optimistic merge: if a Connect→OAuth round-trip just landed but
    // Composio's v1 list endpoint hasn't caught up yet, surface the just-
    // attempted toolkit as connected anyway. The next refresh that returns
    // the slug from Composio clears the pending state.
    const pendingSlug = pendingConnectRedirectRef.current?.slug
    const mergedSlugs = pendingSlug && !baseSlugs.includes(pendingSlug)
      ? [...baseSlugs, pendingSlug]
      : baseSlugs
    const connectedSlugs = new Set(mergedSlugs)
    setConnectedIntegrationSlugs(connectedSlugs)
    const isGithubConnected = connectedSlugs.has('github')
    setGithubConnected(isGithubConnected)
    // When github becomes (re)connected — including via the optimistic merge —
    // drop the stale `github_not_connected` sentinel so the picker's load
    // effect can fire fetchRepoList. Without this, the picker stays hidden
    // (showList === false) until the next click into the drawer.
    if (isGithubConnected) {
      setRepoError((prev) => (prev === 'github_not_connected' ? null : prev))
      setToolsError((prev) => (prev === 'github_not_connected' ? null : prev))
    }
    if (pendingSlug && baseSlugs.includes(pendingSlug)) {
      pendingConnectRedirectRef.current = null
      setPendingConnectRedirect(null)
    }

    let catalogItems: ConnectorCatalogItem[] = []
    const bootstrapData = bootstrap as AppBootstrapResponse | null
    if (bootstrapData?.toolRegistry) {
      setProjectToolRegistry([...bootstrapData.toolRegistry])
    }
    if (bootstrapData?.integrationRegistry) {
      catalogItems = mergeConnectorCatalogEntries(
        catalogItems,
        integrationRegistryToConnectorCatalog(bootstrapData.integrationRegistry ?? []),
      )
    }

    const connectedItems = (Array.isArray(connectedData?.items) ? connectedData.items : []).map((item) =>
      connectorFromIntegrationSummary({ ...item, isConnected: true }),
    )
    catalogItems = mergeConnectorCatalogEntries(catalogItems, connectedItems)

    const searchedItems = (Array.isArray(catalogData?.items) ? catalogData.items : []).map((item) =>
      connectorFromIntegrationSummary(item),
    )
    catalogItems = mergeConnectorCatalogEntries(catalogItems, searchedItems)

    setIntegrationCatalogItems((prev) => mergeConnectorCatalogEntries(prev, catalogItems))
    rememberIntegrationLogos(catalogItems)
    setIntegrationsLoading(false)
  }, [projectId, rememberIntegrationLogos])

  const shouldRefreshProjectIntegrations = settingsDrawerOpen && activeSettingsSectionId === 'integrations'

  useEffect(() => {
    if (!shouldRefreshProjectIntegrations) return
    void loadProjectIntegrations()
  }, [loadProjectIntegrations, shouldRefreshProjectIntegrations])

  useEffect(() => {
    if (!shouldRefreshProjectIntegrations) return
    const onIntegrationsChanged = () => {
      // OAuth callback fires this on success — clear the visible "Open OAuth
      // window" banner immediately since the user has already returned. We
      // intentionally leave `pendingConnectRedirectRef.current` alone so the
      // optimistic-merge inside `loadProjectIntegrations` still surfaces the
      // just-connected toolkit until Composio's v1 list endpoint catches up.
      setPendingConnectRedirect(null)
      void loadProjectIntegrations()
    }
    const onFocus = () => {
      void loadProjectIntegrations()
    }
    window.addEventListener('overlay:integrations-changed', onIntegrationsChanged)
    window.addEventListener('focus', onFocus)
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(INTEGRATIONS_BC_CHANNEL)
      bc.onmessage = onIntegrationsChanged
    } catch {
      // BroadcastChannel is optional.
    }
    return () => {
      window.removeEventListener('overlay:integrations-changed', onIntegrationsChanged)
      window.removeEventListener('focus', onFocus)
      bc?.close()
    }
  }, [loadProjectIntegrations, shouldRefreshProjectIntegrations])

  const fetchRepoList = useCallback(async () => {
    if (!githubConnected) {
      setRepoError('github_not_connected')
      return
    }
    setRepoLoading(true)
    setRepoError(null)
    try {
      const response = await overlayAppClient.integrations.github.listRepositories({ projectId })
      if (response.error) {
        setRepoError(response.error)
      } else {
        setRepoOptions(
          response.items.map((item) => ({
            fullName: item.fullName,
            private: item.private,
            archived: item.archived,
          })),
        )
      }
    } catch {
      setRepoError('fetch_failed')
    } finally {
      setRepoLoading(false)
    }
  }, [githubConnected, projectId])

  useEffect(() => {
    if (!settingsDrawerOpen || activeSettingsSectionId !== 'integrations') return
    if (!githubConnected) {
      setRepoError('github_not_connected')
      return
    }
    if (repoOptions.length === 0 && !repoLoading && repoError === null) {
      void fetchRepoList()
    }
  }, [
    settingsDrawerOpen,
    activeSettingsSectionId,
    githubConnected,
    repoOptions.length,
    repoLoading,
    repoError,
    fetchRepoList,
  ])

  const fetchToolList = useCallback(async () => {
    if (!githubConnected) {
      setToolsError('github_not_connected')
      return
    }
    setToolsLoading(true)
    setToolsError(null)
    try {
      const response = await overlayAppClient.integrations.github.listTools({ projectId })
      if (response.error) {
        setToolsError(response.error)
        return
      }
      setToolOptions(response.items)
      setToolDefaultEnabled(response.defaultEnabled)
      setToolHardDenied(response.hardDenied)
    } catch {
      setToolsError('fetch_failed')
    } finally {
      setToolsLoading(false)
    }
  }, [githubConnected, projectId])

  useEffect(() => {
    if (!settingsDrawerOpen || activeSettingsSectionId !== 'github-tools') return
    if (!githubConnected) {
      setToolsError('github_not_connected')
      return
    }
    if (toolOptions.length === 0 && !toolsLoading && toolsError === null) {
      void fetchToolList()
    }
  }, [
    settingsDrawerOpen,
    activeSettingsSectionId,
    githubConnected,
    toolOptions.length,
    toolsLoading,
    toolsError,
    fetchToolList,
  ])

  const loadHubItems = useCallback(async () => {
    setListsLoading(true)
    try {
      const [chatsJson, filesJson] = await Promise.all([
        overlayAppClient.conversations.get<ProjectChatSummary[]>({ projectId }),
        overlayAppClient.files.get<ProjectFileRecord[]>({ projectId }),
      ])
      setChats(Array.isArray(chatsJson) ? chatsJson : [])
      setFiles(Array.isArray(filesJson) ? filesJson : [])
    } finally {
      setListsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadHubItems()
  }, [loadHubItems])

  useEffect(() => {
    function onChatCreated(e: Event) {
      const { detail } = e as CustomEvent<ChatCreatedDetail>
      if (!detail?.chat?._id) return
      void loadHubItems()
    }
    function onChatDeleted(e: Event) {
      const { detail } = e as CustomEvent<ChatDeletedDetail>
      if (!detail?.chatId) return
      setChats((prev) => prev.filter((c) => c._id !== detail.chatId))
    }
    function onTitleUpdated(e: Event) {
      const { detail } = e as CustomEvent<ChatTitleUpdatedDetail>
      if (!detail?.chatId) return
      setChats((prev) =>
        prev.map((c) => (c._id === detail.chatId ? { ...c, title: detail.title } : c)),
      )
    }
    function onFilesChanged() {
      void loadHubItems()
    }
    function onProjectMeta(e: Event) {
      const d = (e as CustomEvent<ProjectMetaUpdatedDetail>).detail
      if (d?.projectId !== projectId || !d.name) return
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('projectName', d.name)
      router.replace(`${pathname}?${params}`)
      setDraftName(d.name)
    }
    window.addEventListener(CHAT_CREATED_EVENT, onChatCreated)
    window.addEventListener(CHAT_DELETED_EVENT, onChatDeleted)
    window.addEventListener(CHAT_TITLE_UPDATED_EVENT, onTitleUpdated)
    window.addEventListener(FILES_CHANGED_EVENT, onFilesChanged)
    window.addEventListener(PROJECT_META_UPDATED_EVENT, onProjectMeta)
    return () => {
      window.removeEventListener(CHAT_CREATED_EVENT, onChatCreated)
      window.removeEventListener(CHAT_DELETED_EVENT, onChatDeleted)
      window.removeEventListener(CHAT_TITLE_UPDATED_EVENT, onTitleUpdated)
      window.removeEventListener(FILES_CHANGED_EVENT, onFilesChanged)
      window.removeEventListener(PROJECT_META_UPDATED_EVENT, onProjectMeta)
    }
  }, [loadHubItems, pathname, projectId, router, searchParams])

  async function commitProjectRename() {
    setEditingName(false)
    const name = draftName.trim()
    if (!name || name === projectName) {
      setDraftName(projectName)
      return
    }
    setSavingName(true)
    try {
      const res = await overlayAppClient.projects.updateResponse({ projectId, name })
      if (!res.ok) {
        setDraftName(projectName)
        return
      }
      const data = (await res.json().catch(() => ({}))) as { project?: { name?: string } }
      const finalName = data.project?.name?.trim() || name
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('projectName', finalName)
      router.replace(`${pathname}?${params}`)
      window.dispatchEvent(
        new CustomEvent(PROJECT_META_UPDATED_EVENT, { detail: { projectId, name: finalName } }),
      )
      window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT))
      setDraftName(finalName)
    } finally {
      setSavingName(false)
    }
  }

  async function createChat() {
    const res = await overlayAppClient.conversations.createResponse({ projectId, title: 'New Chat' })
    if (!res.ok) return
    const data = (await res.json()) as { id?: string }
    if (!data.id) return
    void loadHubItems()
    router.push(projectItemHref({ project: { _id: projectId, name: projectName }, view: 'chat', id: data.id }))
  }

  async function createNote() {
    const res = await overlayAppClient.files.createResponse(createProjectNoteRequest(projectId))
    if (!res.ok) return
    const data = (await res.json()) as { id?: string }
    if (!data.id) return
    void loadHubItems()
    router.push(projectItemHref({ project: { _id: projectId, name: projectName }, view: 'note', id: data.id }))
  }

  const openChat = useCallback((id: string) => {
    router.push(projectItemHref({ project: { _id: projectId, name: projectName }, view: 'chat', id }))
  }, [projectId, projectName, router])
  const openFile = useCallback((file: ProjectFileRecord) => {
    router.push(projectItemHref({ project: { _id: projectId, name: projectName }, view: projectRouteViewForFile(file), id: file._id }))
  }, [projectId, projectName, router])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function uploadFiles(filesIn: FileList | null) {
    if (!filesIn || filesIn.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(filesIn)) {
        const form = new FormData()
        form.append('file', file)
        form.append('projectId', projectId)
        await overlayAppClient.files.ingestDocumentResponse(form).catch(() => null)
      }
      window.dispatchEvent(new Event(FILES_CHANGED_EVENT))
      void loadHubItems()
    } finally {
      setUploading(false)
    }
  }

  const onInstructionsChange = useCallback((val: string) => {
    setInstructions(val)
    if (instructionsSaveTimer.current) clearTimeout(instructionsSaveTimer.current)
    instructionsSaveTimer.current = setTimeout(async () => {
      setSavingInstructions(true)
      try {
        const res = await overlayAppClient.projects.updateResponse({ projectId, instructions: val })
        if (res.ok) setInstructionsSavedAt(Date.now())
      } finally {
        setSavingInstructions(false)
      }
    }, 700)
  }, [projectId])

  // Header actions: + dropdown, Upload dropdown
  const [plusOpen, setPlusOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const plusRef = useRef<HTMLDivElement>(null)
  const uploadRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onClick(e: globalThis.MouseEvent) {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) setPlusOpen(false)
      if (uploadRef.current && !uploadRef.current.contains(e.target as Node)) setUploadOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  const headerActions = (
    <ProjectHubActions
      creatingOpen={plusOpen}
      uploadOpen={uploadOpen}
      uploading={uploading}
      plusRef={plusRef}
      uploadRef={uploadRef}
      fileInputRef={fileInputRef}
      folderInputRef={folderInputRef}
      onToggleCreate={() => { setPlusOpen((value) => !value); setUploadOpen(false) }}
      onToggleUpload={() => { setUploadOpen((value) => !value); setPlusOpen(false) }}
      onCreateChat={() => { setPlusOpen(false); void createChat() }}
      onCreateNote={() => { setPlusOpen(false); void createNote() }}
      onUploadFiles={(event) => { void uploadFiles(event.target.files); event.currentTarget.value = '' }}
      onUploadFolder={(event) => { void uploadFiles(event.target.files); event.currentTarget.value = '' }}
    />
  )

  const projectHeaderTitle = (
    <ProjectHubHeader
      projectId={projectId}
      projectName={projectName}
      editingName={editingName}
      draftName={draftName}
      savingName={savingName}
      actions={headerActions}
      settingsToggle={{
        open: settingsDrawerOpen,
        onToggle: () => setSettingsDrawerOpen((open) => !open),
      }}
      onStartRename={() => { setDraftName(projectName); setEditingName(true) }}
      onDraftNameChange={setDraftName}
      onCommitRename={() => void commitProjectRename()}
      onCancelRename={() => { setDraftName(projectName); setEditingName(false) }}
    />
  )

  const sortedChats = useMemo(
    () => sortProjectChats(chats),
    [chats],
  )
  const sortedFiles = useMemo(
    () => sortProjectFilesByUpdated(files),
    [files],
  )
  const connectedIntegrationRows = useMemo(
    () => getConnectedConnectorRows(connectedIntegrationSlugs, integrationCatalogItems),
    [connectedIntegrationSlugs, integrationCatalogItems],
  )
  const availableIntegrationRows = useMemo(
    () => getAvailableConnectorRows(connectedIntegrationSlugs, integrationCatalogItems, DEFAULT_CONNECTOR_CATALOG),
    [connectedIntegrationSlugs, integrationCatalogItems],
  )
  const filteredConnectedIntegrationRows = useMemo(
    () => filterConnectorCatalog(connectedIntegrationRows, integrationSearchQuery),
    [connectedIntegrationRows, integrationSearchQuery],
  )
  const filteredAvailableIntegrationRows = useMemo(
    () => filterConnectorCatalog(availableIntegrationRows, integrationSearchQuery),
    [availableIntegrationRows, integrationSearchQuery],
  )

  useEffect(() => {
    setConnectedIntegrationsVisible(PROJECT_INTEGRATION_LIST_PAGE_SIZE)
  }, [filteredConnectedIntegrationRows.length, integrationSearchQuery])

  useEffect(() => {
    setAvailableIntegrationsVisible(PROJECT_INTEGRATION_LIST_PAGE_SIZE)
  }, [filteredAvailableIntegrationRows.length, integrationSearchQuery])

  const handleProjectIntegrationToggle = useCallback(async (integration: ConnectorCatalogItem) => {
    if (connectingIntegrationSlug) return
    const integrationKey = integration.composioId || integration.slug
    const isConnected =
      connectedIntegrationSlugs.has(integrationKey) ||
      connectedIntegrationSlugs.has(integration.slug)
    setIntegrationConnectError(null)
    pendingConnectRedirectRef.current = null
    setPendingConnectRedirect(null)
    setConnectingIntegrationSlug(integrationKey)

    // Diagnostic trace for the popup flow ("click Connect, nothing happens"
    // class of issues). Logs land in browser DevTools console.
    console.log('[Integrations:click] start', {
      integrationKey,
      slug: integration.slug,
      composioId: integration.composioId,
      isConnected,
    })

    let oauthTab: Window | null = null
    if (!isConnected) {
      oauthTab = window.open('about:blank', '_blank')
      console.log('[Integrations:click] pre-opened tab:', oauthTab ? 'OPENED' : 'BLOCKED')
    }

    try {
      if (isConnected) {
        const response = await overlayAppClient.integrations.disconnectResponse({
          toolkit: integrationKey,
          projectId,
        })
        const data = await response.json().catch(() => ({})) as { error?: string }
        if (response.status === 401) {
          setIntegrationConnectError('Your session expired. Sign in again to manage integrations.')
          await refreshSession()
          requireAuth('nav', { force: true })
          return
        }
        if (!response.ok || data.error) {
          setIntegrationConnectError(data.error || 'Failed to disconnect')
          return
        }
        setConnectedIntegrationSlugs((prev) => {
          const next = new Set(prev)
          next.delete(integrationKey)
          next.delete(integration.slug)
          return next
        })
        if (integrationKey === 'github' || integration.slug === 'github') setGithubConnected(false)
        notifyProjectIntegrationsChanged()
        void loadProjectIntegrations()
        return
      }

      const response = await overlayAppClient.integrations.connectResponse({
        action: 'connect',
        toolkit: integrationKey,
        projectId,
      })
      const data = await response.json().catch(() => ({})) as {
        error?: string
        redirectUrl?: string | null
        connectionId?: string | null
        success?: boolean
      }
      if (response.status === 401) {
        oauthTab?.close()
        setIntegrationConnectError('Your session expired. Sign in again to connect integrations.')
        await refreshSession()
        requireAuth('nav', { force: true })
        return
      }
      if (!response.ok || data.error) {
        oauthTab?.close()
        setIntegrationConnectError(data.error || 'Failed to connect')
        return
      }
      console.log('[Integrations:click] received response', {
        status: response.status,
        hasRedirectUrl: typeof data.redirectUrl === 'string' && data.redirectUrl.length > 0,
        redirectUrlSample: data.redirectUrl ? `${data.redirectUrl.slice(0, 60)}…` : data.redirectUrl,
        connectionId: data.connectionId,
        successFlag: data.success,
        oauthTabClosed: oauthTab?.closed ?? 'no-tab',
      })
      if (data.redirectUrl) {
        // Always surface the URL as a click-to-open fallback. If the
        // pre-opened popup worked, this is harmless confirmation; if it
        // was blocked / invisible / closed by Composio's bouncer, the
        // user has a direct-anchor escape hatch.
        const nextPending = {
          url: data.redirectUrl,
          name: integration.name,
          slug: integrationKey,
        }
        pendingConnectRedirectRef.current = nextPending
        setPendingConnectRedirect(nextPending)
        if (oauthTab) {
          try {
            oauthTab.location.href = data.redirectUrl
            console.log('[Integrations:click] nav assignment ok, oauthTab.closed =', oauthTab.closed)
          } catch (err) {
            console.error('[Integrations:click] nav assignment threw', err)
          }
        } else {
          const fallback = window.open(data.redirectUrl, '_blank')
          console.log('[Integrations:click] fallback popup:', fallback ? 'OPENED' : 'BLOCKED')
        }
        return
      }
      oauthTab?.close()
      if (data.connectionId || data.success) {
        setConnectedIntegrationSlugs((prev) => new Set([...prev, integrationKey]))
        if (integrationKey === 'github' || integration.slug === 'github') setGithubConnected(true)
        notifyProjectIntegrationsChanged()
        void loadProjectIntegrations()
        return
      }
      setIntegrationConnectError('No OAuth URL returned. This integration may require manual setup.')
    } catch {
      oauthTab?.close()
      setIntegrationConnectError('Connection failed')
    } finally {
      setConnectingIntegrationSlug(null)
    }
  }, [
    connectedIntegrationSlugs,
    connectingIntegrationSlug,
    loadProjectIntegrations,
    projectId,
    refreshSession,
    requireAuth,
  ])

  const settingsSections = useMemo(
    (): ProjectSettingsSection[] => {
      const githubRepoPicker = (
        <GithubRepoAllowlistPicker
          value={draftAllowlist}
          options={repoOptions}
          loading={repoLoading}
          error={repoError}
          saveError={saveAllowlistError}
          onChange={(next) => {
            setDraftAllowlist(next)
            void saveAllowlist(next)
          }}
          onRetryLoad={() => void fetchRepoList()}
          onDismissSaveError={dismissSaveAllowlistError}
        />
      )

      return [
        {
          id: 'chats',
          label: 'Chats',
          icon: <MessageSquare size={14} />,
          render: () => <ProjectChatsSettingsPanel chats={sortedChats} loading={listsLoading} onOpenChat={openChat} />,
        },
        {
          id: 'files',
          label: 'Files',
          icon: <FileText size={14} />,
          render: () => <ProjectFilesSettingsPanel files={sortedFiles} loading={listsLoading} onOpenFile={openFile} />,
        },
        {
          id: 'instructions',
          label: 'Instructions',
          icon: <BookOpen size={14} />,
          render: () => (
            <ProjectInstructionsSettingsPanel
              instructions={instructions}
              instructionsLoaded={instructionsLoaded}
              savingInstructions={savingInstructions}
              instructionsSavedAt={instructionsSavedAt}
              onInstructionsChange={onInstructionsChange}
            />
          ),
        },
        {
          id: 'integrations',
          label: 'Integrations',
          icon: <Plug size={14} />,
          render: () => (
            <ProjectIntegrationsSettingsPanel
              projectId={projectId}
              activeTab={activeIntegrationsTab}
              connectedRows={filteredConnectedIntegrationRows}
              availableRows={filteredAvailableIntegrationRows}
              tools={projectToolRegistry}
              searchQuery={integrationSearchQuery}
              integrationsLoading={integrationsLoading}
              lastIntegrationsError={lastIntegrationsError}
              connectError={integrationConnectError}
              connectingSlug={connectingIntegrationSlug}
              pendingConnectRedirect={pendingConnectRedirect}
              logoUrls={integrationLogoUrls}
              connectedVisible={connectedIntegrationsVisible}
              availableVisible={availableIntegrationsVisible}
              githubRepoPicker={githubRepoPicker}
              onActiveTabChange={setActiveIntegrationsTab}
              onSearchQueryChange={setIntegrationSearchQuery}
              onClearConnectError={() => setIntegrationConnectError(null)}
              onDismissPendingConnectRedirect={() => {
                pendingConnectRedirectRef.current = null
                setPendingConnectRedirect(null)
              }}
              onConnectToggle={handleProjectIntegrationToggle}
              onShowMoreConnected={() => setConnectedIntegrationsVisible((value) => value + PROJECT_INTEGRATION_LIST_PAGE_SIZE)}
              onShowMoreAvailable={() => setAvailableIntegrationsVisible((value) => value + PROJECT_INTEGRATION_LIST_PAGE_SIZE)}
            />
          ),
        },
        {
          id: 'github-tools',
          label: 'GitHub Tools',
          icon: <GitBranch size={14} />,
          render: () => (
            <GithubToolsPicker
              // When the project has no explicit override (draftToolsEnabled is
              // undefined), fall back to server defaults so the picker still
              // renders an intelligible "what is on" state.
              value={draftToolsEnabled ?? toolDefaultEnabled}
              options={toolOptions}
              defaultEnabled={toolDefaultEnabled}
              hardDenied={toolHardDenied}
              loading={toolsLoading}
              error={toolsError}
              saveError={saveToolsError}
              onChange={(next) => { void saveToolsEnabled(next) }}
              onRetryLoad={() => { void fetchToolList() }}
              onDismissSaveError={dismissSaveToolsError}
            />
          ),
        },
        {
          id: 'skills',
          label: 'Skills',
          icon: <Sparkles size={14} />,
          render: () => (
            <div className="-m-4 h-[calc(100vh-7rem)] min-h-[28rem]">
              <ProjectSkillsView userId={userId} />
            </div>
          ),
        },
      ]
    },
    [
      activeIntegrationsTab,
      availableIntegrationsVisible,
      connectedIntegrationsVisible,
      connectingIntegrationSlug,
      dismissSaveAllowlistError,
      dismissSaveToolsError,
      draftAllowlist,
      draftToolsEnabled,
      fetchRepoList,
      fetchToolList,
      filteredAvailableIntegrationRows,
      filteredConnectedIntegrationRows,
      handleProjectIntegrationToggle,
      instructions,
      instructionsLoaded,
      instructionsSavedAt,
      integrationConnectError,
      integrationLogoUrls,
      integrationSearchQuery,
      integrationsLoading,
      lastIntegrationsError,
      listsLoading,
      pendingConnectRedirect,
      onInstructionsChange,
      openChat,
      openFile,
      projectId,
      projectToolRegistry,
      repoError,
      repoLoading,
      repoOptions,
      saveAllowlist,
      saveAllowlistError,
      saveToolsEnabled,
      saveToolsError,
      savingInstructions,
      sortedChats,
      sortedFiles,
      toolDefaultEnabled,
      toolHardDenied,
      toolOptions,
      toolsError,
      toolsLoading,
      userId,
    ],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {projectHeaderTitle}
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ChatInterface
            userId={userId}
            firstName={firstName}
            hideSidebar
            projectName={projectName}
          />
        </div>
        <ProjectSettingsDrawer
          open={settingsDrawerOpen}
          onOpenChange={setSettingsDrawerOpen}
          projectName={projectName}
          sections={settingsSections}
          activeSectionId={activeSettingsSectionId}
          onActiveSectionChange={setActiveSettingsSectionId}
          layoutMode={layoutMode}
          width={560}
        />
      </div>
    </div>
  )
}

// ─── Projects landing (no projectId) ─────────────────────────────────────────

function formatProjectUpdatedAt(updatedAt: number): string {
  if (!Number.isFinite(updatedAt)) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(updatedAt))
}

function ProjectsLanding({
  projects,
  loading,
  creating,
  onCreateProject,
}: {
  projects: readonly ProjectSummary[]
  loading: boolean
  creating: boolean
  onCreateProject: () => void
}) {
  const router = useRouter()
  const rootProjectRows = useMemo(() => {
    const roots = getRootProjects(projects)
    return roots.length > 0 ? roots : [...projects]
  }, [projects])

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2.5 md:h-16 md:min-h-16 md:max-h-16 md:px-4 md:py-0">
        <h1
          className="text-lg font-medium text-[var(--foreground)]"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Projects
        </h1>
        <button
          type="button"
          onClick={onCreateProject}
          disabled={creating}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          New project
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {loading && projects.length === 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
                <div className="ui-skeleton-line mb-4 h-8 w-8 rounded-md" />
                <div className="ui-skeleton-line mb-2 h-3.5 w-36 rounded" />
                <div className="ui-skeleton-line h-3 w-2/3 rounded opacity-75" />
              </div>
            ))}
          </div>
        ) : rootProjectRows.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rootProjectRows.map((project) => {
              const subprojectCount = getChildProjects(projects, project._id).length
              const updatedLabel = formatProjectUpdatedAt(project.updatedAt)
              return (
                <button
                  key={project._id}
                  type="button"
                  onClick={() => router.push(projectHubHref(project))}
                  className="group flex min-h-32 flex-col justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-left transition-colors hover:border-[var(--muted-light)] hover:bg-[var(--surface-subtle)]"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]">
                      <Folder size={16} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">{project.name}</p>
                      {project.description || project.instructions ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                          {project.description || project.instructions}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-[var(--muted)]">Project workspace</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3 text-[11px] text-[var(--muted-light)]">
                    <span>{subprojectCount > 0 ? `${subprojectCount} nested project${subprojectCount === 1 ? '' : 's'}` : 'Project'}</span>
                    {updatedLabel ? <span>Updated {updatedLabel}</span> : null}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6">
            <p className="text-sm text-[var(--muted)]">No projects yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ProjectsView ─────────────────────────────────────────────────────────────

export default function ProjectsView({
  userId,
  firstName,
  initialProjects = [],
}: {
  userId: string | null
  firstName?: string
  initialProjects?: ProjectSummary[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { requireAuth } = useGuestGate()
  const safeInitialProjects = useMemo(
    () => (Array.isArray(initialProjects) ? initialProjects : []),
    [initialProjects],
  )
  const [projects, setProjects] = useState<ProjectSummary[]>(safeInitialProjects)
  const [projectsLoading, setProjectsLoading] = useState(Boolean(userId) && safeInitialProjects.length === 0)
  const [creatingProject, setCreatingProject] = useState(false)
  const view = searchParams?.get('view') ?? null
  const id = searchParams?.get('id') ?? null
  const projectId = searchParams?.get('projectId') ?? null
  const initialProject = projectId ? projects.find((project) => project._id === projectId) : undefined
  const projectName = searchParams?.get('projectName') ?? initialProject?.name ?? undefined

  const loadProjects = useCallback(async () => {
    if (!userId) {
      setProjects([])
      setProjectsLoading(false)
      return
    }
    setProjectsLoading(true)
    try {
      const data = await overlayAppClient.projects.get<ProjectSummary[]>()
      setProjects(Array.isArray(data) ? data : [])
    } finally {
      setProjectsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (safeInitialProjects.length > 0) {
      setProjects(safeInitialProjects)
      setProjectsLoading(false)
    }
  }, [safeInitialProjects])

  useEffect(() => {
    void loadProjects()
    function onProjectsChanged() {
      void loadProjects()
    }
    window.addEventListener(PROJECTS_CHANGED_EVENT, onProjectsChanged)
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, onProjectsChanged)
  }, [loadProjects])

  const createProject = useCallback(async () => {
    if (!userId) {
      requireAuth('nav')
      return
    }
    if (creatingProject) return
    setCreatingProject(true)
    try {
      const res = await overlayAppClient.projects.createResponse({ name: 'Untitled project' })
      if (!res.ok) return
      const data = (await res.json().catch(() => ({}))) as {
        id?: string
        project?: Partial<ProjectSummary> & { _id?: string; name?: string }
      }
      const created = data.project
      if (created?._id && typeof created.createdAt === 'number' && typeof created.updatedAt === 'number') {
        setProjects((prev) => [created as ProjectSummary, ...prev.filter((project) => project._id !== created._id)])
      } else {
        void loadProjects()
      }
      const createdId = created?._id || data.id
      const createdName = created?.name || 'Untitled project'
      window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT))
      if (createdId) {
        router.push(projectHubHref({ _id: createdId, name: createdName }))
      }
    } finally {
      setCreatingProject(false)
    }
  }, [creatingProject, loadProjects, requireAuth, router, userId])

  const authenticatedUserId = userId

  if (!authenticatedUserId) {
    return (
      <ProjectsLanding
        projects={[]}
        loading={false}
        creating={false}
        onCreateProject={() => requireAuth('nav')}
      />
    )
  }

  if (view === 'chat' && id) {
    if (projectId?.trim()) {
      return (
        <ProjectHubBody
          projectId={projectId.trim()}
          projectName={projectName?.trim() || 'Project'}
          userId={authenticatedUserId}
          firstName={firstName}
        />
      )
    }
    return (
      <ChatInterface userId={authenticatedUserId} firstName={firstName} hideSidebar projectName={projectName} />
    )
  }

  if (view === 'note' && id) {
    return <NotebookEditor userId={authenticatedUserId} hideSidebar projectName={projectName} />
  }

  if (view === 'file' && id) {
    return <ProjectFileView fileId={id} />
  }

  if (projectId?.trim()) {
    return (
      <ProjectHubBody
        projectId={projectId.trim()}
        projectName={projectName?.trim() || 'Project'}
        userId={authenticatedUserId}
        firstName={firstName}
      />
    )
  }

  return (
    <ProjectsLanding
      projects={projects}
      loading={projectsLoading}
      creating={creatingProject}
      onCreateProject={() => void createProject()}
    />
  )
}
