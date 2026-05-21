'use client'

// Compatibility wrapper: canonical project contracts/controllers live in @overlay/app-core,
// typed transport lives in @overlay/api-client, and reusable presentation lives in @overlay/modules-react.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  CHAT_CREATED_EVENT,
  CHAT_DELETED_EVENT,
  CHAT_TITLE_UPDATED_EVENT,
  type ChatCreatedDetail,
  type ChatDeletedDetail,
  type ChatTitleUpdatedDetail,
} from '@/lib/chat-title'
import {
  FILES_CHANGED_EVENT,
  PROJECT_META_UPDATED_EVENT,
  PROJECTS_CHANGED_EVENT,
  createProjectNoteRequest,
  projectHubHref,
  projectItemHref,
  projectRouteViewForFile,
  sortProjectChats,
  sortProjectFilesByUpdated,
  type ConnectedIntegrationsResponse,
  type GithubRepositoryOption,
  type ProjectChatSummary,
  type ProjectFileSummary,
  type ProjectHubTab,
  type ProjectMetaUpdatedDetail,
  type ProjectSettingsSectionId,
} from '@overlay/app-core'
import {
  ProjectHubActions,
  ProjectHubHeader,
  ProjectHubTabs,
  ProjectsEmptyLanding,
} from '@overlay/modules-react/projects'
import { ProjectSettingsDrawer } from '@overlay/modules-react/project-settings-drawer'
import { createProjectSettingsSections } from '@overlay/modules-react/project-settings-sections'
import { FileViewerSkeleton } from '@/components/ui/Skeleton'
import dynamic from 'next/dynamic'
import { FileViewerPanel, isEditableType } from './FileViewer'
import { FileShareMenu } from './FileShareMenu'
import { buildSharePageUrl } from '@/lib/share-url'
import { overlayAppClient } from '@/lib/overlay-app-client'

type HubChat = ProjectChatSummary
type ProjectFileRecord = ProjectFileSummary

const ChatInterface = dynamic(() => import('./ChatInterface'))
const NotebookEditor = dynamic(() => import('./NotebookEditor'))

// ─── localStorage helpers (SSR-safe) ─────────────────────────────────────────

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
    // Safari private mode or storage quota exceeded — silently ignore
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

// ─── Project hub: ChatInterface + Chats / Files / Instructions tabs ──────────

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
  const [activeTab, setActiveTab] = useState<ProjectHubTab>('chats')
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

  // ─── Settings drawer state (persisted to localStorage) ───────────────────

  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false)
  const [activeSettingsSectionId, setActiveSettingsSectionId] =
    useState<ProjectSettingsSectionId>('github-repositories')

  // Hydrate from localStorage on mount (SSR-safe)
  useEffect(() => {
    const storedOpen = localStorageGet('overlay.project-settings-drawer.open')
    if (storedOpen === 'true') setSettingsDrawerOpen(true)
    const storedSection = localStorageGet('overlay.project-settings-drawer.active-section')
    if (storedSection === 'github-repositories') {
      setActiveSettingsSectionId('github-repositories')
    }
  }, [])

  // Persist drawer open state
  useEffect(() => {
    localStorageSet('overlay.project-settings-drawer.open', String(settingsDrawerOpen))
  }, [settingsDrawerOpen])

  // Persist active section
  useEffect(() => {
    localStorageSet('overlay.project-settings-drawer.active-section', activeSettingsSectionId)
  }, [activeSettingsSectionId])

  // ─── Push vs overlay layout mode (responsive at 768px) ───────────────────

  const [layoutMode, setLayoutMode] = useState<'push' | 'overlay'>('push')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')
    setLayoutMode(mq.matches ? 'overlay' : 'push')
    function handleChange(e: MediaQueryListEvent) {
      setLayoutMode(e.matches ? 'overlay' : 'push')
    }
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  // ─── GitHub connection detection ──────────────────────────────────────────

  const [githubConnected, setGithubConnected] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await overlayAppClient.integrations.get<ConnectedIntegrationsResponse>()
        const connected = Array.isArray(res?.connected) ? res.connected : []
        setGithubConnected(connected.includes('github'))
      } catch {
        setGithubConnected(false)
      }
    })()
  }, [])

  // ─── Draft allowlist state (seeded from project doc on project change) ────

  const [draftAllowlist, setDraftAllowlist] = useState<readonly string[]>([])
  const [savingAllowlist, setSavingAllowlist] = useState(false)

  // Load the project doc to seed the allowlist
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await overlayAppClient.projects.get<{
          instructions?: string
          githubRepoAllowlist?: string[]
        } | null>({ projectId })
        if (cancelled) return
        setDraftAllowlist(data?.githubRepoAllowlist ?? [])
        setInstructions((data?.instructions ?? '') as string)
        setInstructionsLoaded(true)
      } catch {
        if (!cancelled) setInstructionsLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [projectId])

  async function saveAllowlist(next: readonly string[]) {
    setSavingAllowlist(true)
    try {
      const res = await overlayAppClient.projects.update({
        projectId,
        githubRepoAllowlist: [...next],
      })
      if (res?.project) {
        setDraftAllowlist(res.project.githubRepoAllowlist ?? [])
      }
    } catch {
      // No-op: the draft remains in the UI; the user can retry
    } finally {
      setSavingAllowlist(false)
    }
  }

  // ─── Repo list fetch state ────────────────────────────────────────────────

  const [repoOptions, setRepoOptions] = useState<readonly GithubRepositoryOption[]>([])
  const [repoLoading, setRepoLoading] = useState(false)
  const [repoError, setRepoError] =
    useState<'github_not_connected' | 'fetch_failed' | 'rate_limited' | null>(null)
  const [manualEntry, setManualEntry] = useState('')

  const fetchRepoList = useCallback(async () => {
    if (!githubConnected) {
      setRepoError('github_not_connected')
      return
    }
    setRepoLoading(true)
    setRepoError(null)
    try {
      const res = await overlayAppClient.integrations.github.listRepositories()
      if (res.error) {
        setRepoError(res.error)
      } else {
        setRepoOptions(
          res.items.map((item) => ({
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

  // Trigger fetch when drawer opens to the GitHub section with GitHub connected
  useEffect(() => {
    if (
      settingsDrawerOpen &&
      activeSettingsSectionId === 'github-repositories'
    ) {
      if (!githubConnected) {
        setRepoError('github_not_connected')
        return
      }
      // Only fetch if we haven't loaded yet and are not already loading
      if (repoOptions.length === 0 && !repoLoading && repoError === null) {
        void fetchRepoList()
      }
    }
  }, [settingsDrawerOpen, activeSettingsSectionId, githubConnected, repoOptions.length, repoLoading, repoError, fetchRepoList])

  // ─── Load project instructions ────────────────────────────────────────────
  // Note: instructions are loaded together with the allowlist in the combined
  // project fetch above, but we keep the existing save path below unchanged.

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

  function openChat(id: string) {
    router.push(projectItemHref({ project: { _id: projectId, name: projectName }, view: 'chat', id }))
  }
  function openFile(file: ProjectFileRecord) {
    router.push(projectItemHref({ project: { _id: projectId, name: projectName }, view: projectRouteViewForFile(file), id: file._id }))
  }

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

  function onInstructionsChange(val: string) {
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
  }

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
        onToggle: () => setSettingsDrawerOpen((v) => !v),
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

  const tabs = (
    <ProjectHubTabs
      activeTab={activeTab}
      chats={sortedChats}
      files={sortedFiles}
      listsLoading={listsLoading}
      instructions={instructions}
      instructionsLoaded={instructionsLoaded}
      savingInstructions={savingInstructions}
      instructionsSavedAt={instructionsSavedAt}
      onTabChange={setActiveTab}
      onOpenChat={openChat}
      onOpenFile={openFile}
      onInstructionsChange={onInstructionsChange}
    />
  )

  // Build settings sections with the repo picker props + an inline save button
  const settingsSections = useMemo(
    () =>
      createProjectSettingsSections({
        githubRepoPickerProps: {
          value: draftAllowlist,
          options: repoOptions,
          loading: repoLoading,
          error: repoError,
          manualEntry,
          onChange: (next) => {
            setDraftAllowlist(next)
            // Auto-save on every toggle — matches the pattern used for instructions
            void saveAllowlist(next)
          },
          onAddManual: (entry) => {
            if (draftAllowlist.includes(entry)) return
            const next = [...draftAllowlist, entry]
            setDraftAllowlist(next)
            void saveAllowlist(next)
          },
          onManualEntryChange: setManualEntry,
          onRetryLoad: () => void fetchRepoList(),
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftAllowlist, repoOptions, repoLoading, repoError, manualEntry, savingAllowlist],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {projectHeaderTitle}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ChatInterface
            userId={userId}
            firstName={firstName}
            hideSidebar
            hideHeader
            projectName={projectName}
            belowEmptyComposer={tabs}
          />
        </div>
        {settingsDrawerOpen ? (
          <div className={layoutMode === 'overlay' ? 'relative' : ''}>
            <ProjectSettingsDrawer
              open={settingsDrawerOpen}
              onOpenChange={setSettingsDrawerOpen}
              projectName={projectName}
              sections={settingsSections}
              activeSectionId={activeSettingsSectionId}
              onActiveSectionChange={setActiveSettingsSectionId}
              layoutMode={layoutMode}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─── Empty Projects landing (no projectId) ───────────────────────────────────

function ProjectsEmpty() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  async function createProject() {
    if (creating) return
    setCreating(true)
    try {
      const res = await overlayAppClient.projects.createResponse({ name: 'Untitled project' })
      if (!res.ok) return
      const data = (await res.json().catch(() => ({}))) as {
        id?: string
        project?: { _id?: string; name?: string }
      }
      const id = data.project?._id || data.id
      const name = data.project?.name || 'Untitled project'
      window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT))
      if (id) {
        router.push(projectHubHref({ _id: id, name }))
      }
    } finally {
      setCreating(false)
    }
  }

  return <ProjectsEmptyLanding creating={creating} onCreateProject={() => void createProject()} />
}

// ─── ProjectsView ─────────────────────────────────────────────────────────────

export default function ProjectsView({ userId, firstName }: { userId: string; firstName?: string }) {
  const searchParams = useSearchParams()
  const view = searchParams?.get('view') ?? null
  const id = searchParams?.get('id') ?? null
  const projectName = searchParams?.get('projectName') ?? undefined
  const projectId = searchParams?.get('projectId') ?? null

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

  return <ProjectsEmpty />
}
