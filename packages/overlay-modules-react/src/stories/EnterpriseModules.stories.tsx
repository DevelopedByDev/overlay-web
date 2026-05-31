import { buildTree } from '@overlay/app-core/modules'
import type {
  IntegrationSummary,
  KnowledgeFile,
  McpServerSummary,
  MemoryRow,
  NoteDoc,
  OutputSummary,
  OverlaySettingsPanel,
  OverlaySettingsSection,
  ProjectSummary,
  SkillSummary,
} from '@overlay/app-core'
import {
  ExtensionCatalog,
  KnowledgeFileTree,
  McpServerForm,
  MemoryList,
  NotesEditorShell,
  OutputGallery,
  ProjectDetail,
  ProjectTree,
  SettingsCard,
  SettingsPageShell,
  SettingsSectionRenderer,
} from '..'

const now = Date.now()

const files: KnowledgeFile[] = [
  { _id: 'folder-1', name: 'Policies', type: 'folder', kind: 'folder', parentId: null, createdAt: now, updatedAt: now },
  { _id: 'file-1', name: 'AI acceptable use.md', type: 'file', kind: 'upload', parentId: 'folder-1', createdAt: now, updatedAt: now },
  { _id: 'file-2', name: 'Security FAQ.pdf', type: 'file', kind: 'upload', parentId: null, createdAt: now, updatedAt: now },
]

const outputs: OutputSummary[] = [
  { _id: 'out-1', type: 'image', status: 'completed', prompt: 'Product mockup', modelId: 'gpt-image-1', fileName: 'mockup.png', createdAt: now },
  { _id: 'out-2', type: 'video', status: 'pending', prompt: 'Demo loop', modelId: 'veo', fileName: 'demo.mp4', createdAt: now },
]

const memories: MemoryRow[] = [
  { key: 'm1:0', memoryId: 'm1', segmentIndex: 0, content: 'Prefer concise project summaries.', fullContent: 'Prefer concise project summaries.', source: 'manual', status: 'approved', createdAt: now },
  { key: 'm2:0', memoryId: 'm2', segmentIndex: 0, content: 'Security reviews require owner sign-off.', fullContent: 'Security reviews require owner sign-off.', source: 'chat', status: 'candidate', createdAt: now },
]

const notes: NoteDoc[] = [
  { _id: 'note-1', title: 'Launch Notes', content: 'Outline enterprise launch plan.', tags: [], createdAt: now, updatedAt: now },
  { _id: 'note-2', title: 'Customer Brief', content: 'Summarize deployment requirements.', tags: [], createdAt: now, updatedAt: now },
]

const projects: ProjectSummary[] = [
  { _id: 'project-1', name: 'Enterprise Rollout', instructions: 'Keep docs concise.', parentId: null, createdAt: now, updatedAt: now },
  { _id: 'project-2', name: 'Security', parentId: 'project-1', createdAt: now, updatedAt: now },
]

const integrations: Array<{ kind: 'integration' } & IntegrationSummary> = [
  { kind: 'integration', slug: 'github', name: 'GitHub', description: 'Repository and pull request workflows', logoUrl: null, isConnected: true },
  { kind: 'integration', slug: 'slack', name: 'Slack', description: 'Workspace messaging', logoUrl: null, isConnected: false },
]

const skills: Array<{ kind: 'skill' } & SkillSummary> = [
  { kind: 'skill', _id: 'skill-1', name: 'Release Writer', description: 'Drafts release notes', instructions: 'Write clearly.', enabled: true },
]

const mcps: Array<{ kind: 'mcp' } & McpServerSummary> = [
  { kind: 'mcp', _id: 'mcp-1', name: 'Internal Tools', transport: 'streamable-http', url: 'https://tools.example/mcp', enabled: true, authType: 'bearer', createdAt: now, updatedAt: now },
]

const settingsSections: OverlaySettingsSection[] = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
]

const settingsPanels: OverlaySettingsPanel[] = [
  { id: 'general', sectionId: 'general', label: 'General', componentKey: 'overlay.settings.general' },
  { id: 'policy', sectionId: 'security', label: 'Policy Gates', componentKey: 'enterprise.settings.policy' },
]

const meta = {
  title: 'Enterprise Modules',
}

export default meta

export function KnowledgeFileTreeStory() {
  return <KnowledgeFileTree nodes={buildTree(files)} selectedId="file-1" />
}

export function OutputGalleryStory() {
  return <OutputGallery outputs={outputs} />
}

export function MemoryListStory() {
  return <MemoryList memories={memories} />
}

export function NotesEditorShellStory() {
  return (
    <NotesEditorShell
      notes={notes}
      selectedNoteId="note-1"
      title="Launch Notes"
      content="Outline enterprise launch plan."
      dirty
    />
  )
}

export function ProjectTreeDetailStory() {
  return (
    <div className="flex h-[520px]">
      <div className="w-72 border-r border-[var(--border)]">
        <ProjectTree nodes={buildTree(projects)} selectedProjectId="project-1" />
      </div>
      <div className="flex-1">
        <ProjectDetail project={projects[0]!} notes={notes} files={files} />
      </div>
    </div>
  )
}

export function ExtensionCatalogStory() {
  return <ExtensionCatalog items={[...integrations, ...skills, ...mcps]} policyDisabledIds={new Set(['slack'])} />
}

export function McpFormStory() {
  return (
    <div className="max-w-xl p-4">
      <McpServerForm
        value={{
          name: 'Internal Tools',
          description: 'Private enterprise tools',
          transport: 'streamable-http',
          url: 'https://tools.example/mcp',
          enabled: true,
          authType: 'bearer',
        }}
        onChange={() => undefined}
      />
    </div>
  )
}

export function SettingsRendererStory() {
  return (
    <div className="h-[520px]">
      <SettingsSectionRenderer
        sections={settingsSections}
        panels={settingsPanels}
        activeSectionId="security"
        renderPanel={(panel) => (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-sm">
            Rendered by <code>{panel.componentKey}</code>
          </div>
        )}
      />
    </div>
  )
}

export function SettingsPageShellStory() {
  return (
    <div className="h-[520px]">
      <SettingsPageShell
        activeLabel="Customization"
        actions={
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)]"
          >
            Save
          </button>
        }
      >
        <SettingsCard title="Appearance">
          Theme controls and other setting rows inherit the shared app screen header and body layout.
        </SettingsCard>
        <SettingsCard title="Models">
          Settings subpages keep their current panel contents while sharing the shell frame.
        </SettingsCard>
      </SettingsPageShell>
    </div>
  )
}
