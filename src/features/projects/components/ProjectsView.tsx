'use client'

// Compatibility wrapper: canonical project contracts/controllers live in @overlay/app-core,
// typed transport lives in @overlay/api-client, and reusable presentation lives in @overlay/modules-react.
import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { BookOpen, ExternalLink, FileText, Folder, Loader2, MessageSquare, Plug, Plus, Server, Sparkles, Wrench } from 'lucide-react'
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
  createProjectNoteRequest,
  childProjects as getChildProjects,
  projectHubHref,
  projectItemHref,
  projectRouteViewForFile,
  rootProjects as getRootProjects,
  sortProjectChats,
  sortProjectFilesByUpdated,
  type ConnectedIntegrationsResponse,
  type GithubRepositoryOption,
  type ProjectChatSummary,
  type ProjectFileSummary,
  type ProjectMetaUpdatedDetail,
  type ProjectSettingsSectionId,
  type ProjectSummary,
} from '@overlay/app-core'
import {
  ProjectHubActions,
  ProjectHubHeader,
} from '@overlay/modules-react/projects'
import { ProjectSettingsDrawer, type ProjectSettingsSection } from '@overlay/modules-react/project-settings-drawer'
import { GithubRepoAllowlistPicker } from '@overlay/modules-react/github-repo-picker'
import { FileViewerSkeleton } from '@overlay/ui/feedback'
import dynamic from 'next/dynamic'
import { FileViewerPanel, isEditableType } from '@/features/files/components/FileViewer'
import { FileShareMenu } from '@/features/files/components/FileShareMenu'
import { buildSharePageUrl } from '@/features/share/lib/share-url'
import { overlayAppClient } from '@/shared/app/overlay-app-client'

type HubChat = ProjectChatSummary
type ProjectFileRecord = ProjectFileSummary

const ChatInterface = dynamic(() => import('@/features/chat/components/ChatInterface'))
const NotebookEditor = dynamic(() => import('@/features/notebook/components/NotebookEditor'))
const ProjectMcpServersView = dynamic(() => import('@/features/integrations/components/McpServersView'))
const ProjectSkillsView = dynamic(() => import('@/features/automations/components/SkillsView'))

const PROJECT_SETTINGS_SECTION_IDS = [
  'chats',
  'files',
  'instructions',
  'integrations',
  'mcps',
  'skills',
  'tools',
] as const satisfies readonly ProjectSettingsSectionId[]

function resolveProjectSettingsSectionId(value: string | null): ProjectSettingsSectionId | null {
  if (value === 'github-repositories') return 'integrations'
  return PROJECT_SETTINGS_SECTION_IDS.includes(value as ProjectSettingsSectionId)
    ? (value as ProjectSettingsSectionId)
    : null
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
  connectedIntegrations,
  integrationsLoading,
  lastIntegrationsError,
  githubRepoPicker,
}: {
  projectId: string
  connectedIntegrations: ReadonlyArray<{ slug: string; name: string; description?: string; logoUrl?: string | null }>
  integrationsLoading: boolean
  lastIntegrationsError?: string | null
  githubRepoPicker: ReactNode
}) {
  const integrationsHref = `/app/integrations?projectId=${encodeURIComponent(projectId)}`

  return (
    <section>
      <ProjectDrawerSectionIntro
        title="Integrations"
        action={<ProjectDrawerLink href={integrationsHref}>Manage</ProjectDrawerLink>}
      />
      {lastIntegrationsError ? (
        <p className="text-xs text-red-500">{lastIntegrationsError}</p>
      ) : integrationsLoading ? (
        <div className="flex justify-center py-6 text-[var(--muted)]">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : connectedIntegrations.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-6 text-center">
          <Plug size={24} strokeWidth={1.25} className="mx-auto text-[var(--muted-light)]" />
          <p className="mt-2 text-xs text-[var(--muted)]">No integrations connected to this project yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {connectedIntegrations.map((integration) => (
            <div key={integration.slug} className="flex items-center gap-3 py-2.5">
              {integration.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={integration.logoUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-md border border-[var(--border)] object-contain"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] text-xs font-medium text-[var(--muted)]">
                  {integration.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[var(--foreground)]">{integration.name}</p>
                {integration.description ? (
                  <p className="truncate text-xs text-[var(--muted-light)]">{integration.description}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-5 border-t border-[var(--border)] pt-5">
        {githubRepoPicker}
      </div>
    </section>
  )
}

function ProjectToolsSettingsPanel() {
  return (
    <section>
      <ProjectDrawerSectionIntro
        title="Tools"
        action={<ProjectDrawerLink href="/app/tools?view=all">Open</ProjectDrawerLink>}
      />
    </section>
  )
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
  const [connectedIntegrations, setConnectedIntegrations] = useState<
    Array<{ slug: string; name: string; description?: string; logoUrl?: string | null }>
  >([])
  const [integrationsLoading, setIntegrationsLoading] = useState(true)
  const [lastIntegrationsError, setLastIntegrationsError] = useState<string | null>(null)

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
  const [manualEntry, setManualEntry] = useState('')

  useEffect(() => {
    const storedOpen = localStorageGet('overlay.project-settings-drawer.open')
    if (storedOpen === 'true') setSettingsDrawerOpen(true)
    const storedSection = localStorageGet('overlay.project-settings-drawer.active-section')
    const resolvedSection = resolveProjectSettingsSectionId(storedSection)
    if (resolvedSection) setActiveSettingsSectionId(resolvedSection)
  }, [])

  useEffect(() => {
    localStorageSet('overlay.project-settings-drawer.open', String(settingsDrawerOpen))
  }, [settingsDrawerOpen])

  useEffect(() => {
    localStorageSet('overlay.project-settings-drawer.active-section', activeSettingsSectionId)
  }, [activeSettingsSectionId])

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

  useEffect(() => {
    void (async () => {
      try {
        const response = await overlayAppClient.integrations.get<ConnectedIntegrationsResponse>()
        const connected = Array.isArray(response?.connected) ? response.connected : []
        setGithubConnected(connected.includes('github'))
      } catch {
        setGithubConnected(false)
      }
    })()
  }, [])

  // Load project instructions and repository allowlist together.
  useEffect(() => {
    let cancelled = false
    setInstructionsLoaded(false)
    overlayAppClient.projects.get<{ instructions?: string; githubRepoAllowlist?: string[] } | null>({ projectId })
      .then((data) => {
        if (cancelled) return
        setInstructions((data?.instructions ?? '') as string)
        setDraftAllowlist(data?.githubRepoAllowlist ?? [])
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
      const response = await overlayAppClient.projects.update({
        projectId,
        githubRepoAllowlist: [...next],
      })
      if (response?.project) {
        setDraftAllowlist(response.project.githubRepoAllowlist ?? [])
      }
      setSaveAllowlistError(false)
    } catch {
      setSaveAllowlistError(true)
    }
  }, [projectId])

  const dismissSaveAllowlistError = useCallback(() => {
    setSaveAllowlistError(false)
  }, [])

  const fetchRepoList = useCallback(async () => {
    if (!githubConnected) {
      setRepoError('github_not_connected')
      return
    }
    setRepoLoading(true)
    setRepoError(null)
    try {
      const response = await overlayAppClient.integrations.github.listRepositories()
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
  }, [githubConnected])

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

  useEffect(() => {
    let cancelled = false
    setIntegrationsLoading(true)
    setLastIntegrationsError(null)
    overlayAppClient.integrations.getResponse({ projectId })
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setLastIntegrationsError('Could not load project integrations.')
          return
        }
        const data = (await res.json().catch(() => ({}))) as {
          connected?: string[]
          items?: Array<{ slug: string; name: string; description?: string; logoUrl?: string | null }>
        }
        if (cancelled) return
        const items = Array.isArray(data.items) ? data.items : []
        const connectedSlugs = new Set(Array.isArray(data.connected) ? data.connected : [])
        setConnectedIntegrations(
          items
            .filter((item) => item.slug && connectedSlugs.has(item.slug))
            .map((item) => ({
              slug: item.slug,
              name: item.name || item.slug,
              description: item.description,
              logoUrl: item.logoUrl ?? null,
            })),
        )
      })
      .catch(() => {
        if (!cancelled) setLastIntegrationsError('Could not load project integrations.')
      })
      .finally(() => {
        if (!cancelled) setIntegrationsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

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

  const settingsSections = useMemo(
    (): ProjectSettingsSection[] => {
      const githubRepoPicker = (
        <GithubRepoAllowlistPicker
          value={draftAllowlist}
          options={repoOptions}
          loading={repoLoading}
          error={repoError}
          saveError={saveAllowlistError}
          manualEntry={manualEntry}
          onChange={(next) => {
            setDraftAllowlist(next)
            void saveAllowlist(next)
          }}
          onAddManual={(entry) => {
            if (draftAllowlist.includes(entry)) return
            const next = [...draftAllowlist, entry]
            setDraftAllowlist(next)
            setManualEntry('')
            void saveAllowlist(next)
          }}
          onManualEntryChange={setManualEntry}
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
              connectedIntegrations={connectedIntegrations}
              integrationsLoading={integrationsLoading}
              lastIntegrationsError={lastIntegrationsError}
              githubRepoPicker={githubRepoPicker}
            />
          ),
        },
        {
          id: 'mcps',
          label: 'MCPs',
          icon: <Server size={14} />,
          render: () => (
            <div className="-m-4 h-[calc(100vh-7rem)] min-h-[28rem]">
              <ProjectMcpServersView userId={userId} />
            </div>
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
        {
          id: 'tools',
          label: 'Tools',
          icon: <Wrench size={14} />,
          render: () => <ProjectToolsSettingsPanel />,
        },
      ]
    },
    [
      connectedIntegrations,
      dismissSaveAllowlistError,
      draftAllowlist,
      fetchRepoList,
      instructions,
      instructionsLoaded,
      instructionsSavedAt,
      integrationsLoading,
      lastIntegrationsError,
      listsLoading,
      manualEntry,
      onInstructionsChange,
      openChat,
      openFile,
      projectId,
      repoError,
      repoLoading,
      repoOptions,
      saveAllowlist,
      saveAllowlistError,
      savingInstructions,
      sortedChats,
      sortedFiles,
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
            hideHeader
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
  userId: string
  firstName?: string
  initialProjects?: ProjectSummary[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const safeInitialProjects = useMemo(
    () => (Array.isArray(initialProjects) ? initialProjects : []),
    [initialProjects],
  )
  const [projects, setProjects] = useState<ProjectSummary[]>(safeInitialProjects)
  const [projectsLoading, setProjectsLoading] = useState(safeInitialProjects.length === 0)
  const [creatingProject, setCreatingProject] = useState(false)
  const view = searchParams?.get('view') ?? null
  const id = searchParams?.get('id') ?? null
  const projectId = searchParams?.get('projectId') ?? null
  const initialProject = projectId ? projects.find((project) => project._id === projectId) : undefined
  const projectName = searchParams?.get('projectName') ?? initialProject?.name ?? undefined

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true)
    try {
      const data = await overlayAppClient.projects.get<ProjectSummary[]>()
      setProjects(Array.isArray(data) ? data : [])
    } finally {
      setProjectsLoading(false)
    }
  }, [])

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
  }, [creatingProject, loadProjects, router])

  if (view === 'chat' && id) {
    return (
      <ChatInterface userId={userId} firstName={firstName} hideSidebar projectName={projectName} />
    )
  }

  if (view === 'note' && id) {
    return <NotebookEditor userId={userId} hideSidebar projectName={projectName} />
  }

  if (view === 'file' && id) {
    return <ProjectFileView fileId={id} />
  }

  if (projectId?.trim()) {
    return (
      <ProjectHubBody
        projectId={projectId.trim()}
        projectName={projectName?.trim() || 'Project'}
        userId={userId}
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
