'use client'

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  Check,
  LayoutGrid,
  Link2,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  Server,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import type {
  ConnectorCatalogItem,
  ExtensionCatalogItem,
  McpServerFormValues,
  McpServerSummary,
  McpTestResultState,
  SkillFormValues,
  SkillSummary,
} from '@overlay/app-core'
import { extensionCatalogItemKey, mcpServerToFormValues, skillToFormValues } from '@overlay/app-core/extensions'
import type { McpAuthType, McpTransport } from '@overlay/app-core'
import { Badge, Button, EmptyState, Input, Select, Textarea, Toggle, cn } from '@overlay/ui'

export interface ExtensionCatalogProps {
  items: readonly ExtensionCatalogItem[]
  activeKind?: ExtensionCatalogItem['kind'] | 'all'
  loading?: boolean
  policyDisabledIds?: ReadonlySet<string>
  onSelectItem?: (item: ExtensionCatalogItem) => void
  onToggleSkill?: (item: Extract<ExtensionCatalogItem, { kind: 'skill' }>, enabled: boolean) => void
  onToggleMcp?: (item: Extract<ExtensionCatalogItem, { kind: 'mcp' }>, enabled: boolean) => void
  renderActions?: (item: ExtensionCatalogItem) => ReactNode
}

export function ExtensionCatalog({
  items,
  activeKind = 'all',
  loading,
  policyDisabledIds,
  onSelectItem,
  onToggleSkill,
  onToggleMcp,
  renderActions,
}: ExtensionCatalogProps) {
  const visibleItems = activeKind === 'all' ? items : items.filter((item) => item.kind === activeKind)

  if (loading) return <div className="p-4 text-xs text-[var(--muted)]">Loading extensions...</div>
  if (visibleItems.length === 0) return <EmptyState className="h-full min-h-48" title="No extensions found" />

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {visibleItems.map((item) => {
        const itemKey = extensionCatalogItemKey(item)
        const disabledByPolicy = policyDisabledIds?.has(itemKey) ?? false
        const label = 'name' in item ? item.name : item.label
        const description = 'description' in item ? item.description : undefined
        return (
          <article
            key={`${item.kind}:${itemKey}`}
            className={cn(
              'rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3',
              disabledByPolicy ? 'opacity-60' : '',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                disabled={disabledByPolicy}
                onClick={() => onSelectItem?.(item)}
              >
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <Badge variant="muted">{item.kind}</Badge>
                </div>
                {description ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{description}</p>
                ) : null}
              </button>
              {item.kind === 'skill' && onToggleSkill ? (
                <Toggle checked={item.enabled !== false} onCheckedChange={(checked) => onToggleSkill(item, checked)} />
              ) : null}
              {item.kind === 'mcp' && onToggleMcp ? (
                <Toggle checked={item.enabled} onCheckedChange={(checked) => onToggleMcp(item, checked)} />
              ) : null}
            </div>
            <div className="mt-3 flex min-h-8 items-center justify-between gap-2">
              <StatusBadge item={item} disabledByPolicy={disabledByPolicy} />
              {renderActions ? <div className="flex items-center gap-2">{renderActions(item)}</div> : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function StatusBadge({ item, disabledByPolicy }: { item: ExtensionCatalogItem; disabledByPolicy: boolean }) {
  if (disabledByPolicy) return <Badge variant="warning">Policy gated</Badge>
  if (item.kind === 'integration') {
    return <Badge variant={item.isConnected ? 'success' : 'muted'}>{item.isConnected ? 'Connected' : 'Available'}</Badge>
  }
  if (item.kind === 'skill') {
    return <Badge variant={item.enabled === false ? 'muted' : 'success'}>{item.enabled === false ? 'Off' : 'On'}</Badge>
  }
  if (item.kind === 'mcp') {
    return <Badge variant={item.enabled ? 'success' : 'muted'}>{item.enabled ? 'On' : 'Off'}</Badge>
  }
  return <Badge variant="muted">{item.kind === 'modelProvider' ? 'Provider' : 'Registered'}</Badge>
}

export interface ExtensionPageHeaderProps {
  title: string
  searchOpen: boolean
  searchQuery: string
  searchPlaceholder: string
  searchTitle: string
  action?: ReactNode
  onSearchOpenChange: (open: boolean) => void
  onSearchQueryChange: (query: string) => void
}

export function ExtensionPageHeader({
  title,
  searchOpen,
  searchQuery,
  searchPlaceholder,
  searchTitle,
  action,
  onSearchOpenChange,
  onSearchQueryChange,
}: ExtensionPageHeaderProps) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] px-6">
      <div className="shrink-0">
        <h2 className="text-sm font-medium text-[var(--foreground)]">{title}</h2>
      </div>
      {searchOpen ? (
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          autoFocus
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-light)] focus:border-[var(--muted)]"
        />
      ) : (
        <div className="flex-1" />
      )}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          title={searchTitle}
          onClick={() => {
            onSearchOpenChange(!searchOpen)
            if (searchOpen) onSearchQueryChange('')
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] ${
            searchOpen ? 'border-[var(--muted)] bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''
          }`}
        >
          <Search size={14} strokeWidth={1.75} />
        </button>
        {action}
      </div>
    </div>
  )
}

export interface IntegrationLogoProps {
  logoUrl?: string | null
  name: string
  size?: number
}

export function IntegrationLogo({ logoUrl, name, size = 28 }: IntegrationLogoProps) {
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

export interface IntegrationsPanelProps {
  loading: boolean
  loadingFallback: ReactNode
  connectedRows: readonly ConnectorCatalogItem[]
  availableRows: readonly ConnectorCatalogItem[]
  connectedVisible: number
  availableVisible: number
  connectingSlug?: string | null
  error?: string | null
  logoUrls?: Readonly<Record<string, string | null>>
  onClearError: () => void
  onConnectToggle: (integration: ConnectorCatalogItem) => void
  onShowMoreConnected: () => void
  onShowMoreAvailable: () => void
  onOpenCatalog: () => void
}

export function IntegrationsPanel({
  loading,
  loadingFallback,
  connectedRows,
  availableRows,
  connectedVisible,
  availableVisible,
  connectingSlug,
  error,
  logoUrls,
  onClearError,
  onConnectToggle,
  onShowMoreConnected,
  onShowMoreAvailable,
  onOpenCatalog,
}: IntegrationsPanelProps) {
  const connectedShown = connectedRows.slice(0, connectedVisible)
  const availableShown = availableRows.slice(0, availableVisible)

  return (
    <div className="flex-1 overflow-y-auto">
      {loading ? (
        loadingFallback
      ) : (
        <div className="mx-auto max-w-2xl space-y-8 px-6 py-6">
          {error ? (
            <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <span>{error}</span>
              <button onClick={onClearError} className="ml-2 text-red-400 hover:text-red-300">✕</button>
            </div>
          ) : null}

          {connectedRows.length > 0 ? (
            <div>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-light)]">Connected</p>
              <div className="space-y-1">
                {connectedShown.map((integration) => (
                  <IntegrationRow
                    key={integration.composioId}
                    integration={integration}
                    logoUrl={logoUrls?.[integration.composioId] ?? integration.logoUrl}
                    isConnected
                    isConnecting={connectingSlug === integration.composioId}
                    onAction={onConnectToggle}
                  />
                ))}
              </div>
              {connectedVisible < connectedRows.length ? (
                <ShowMoreButton onClick={onShowMoreConnected} />
              ) : null}
            </div>
          ) : null}

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-light)]">Available</p>
              <button
                type="button"
                onClick={onOpenCatalog}
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
                  logoUrl={logoUrls?.[integration.composioId] ?? integration.logoUrl}
                  isConnected={false}
                  isConnecting={connectingSlug === integration.composioId}
                  onAction={onConnectToggle}
                />
              ))}
            </div>
            {availableVisible < availableRows.length ? (
              <ShowMoreButton onClick={onShowMoreAvailable} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function ShowMoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
    >
      Show more
    </button>
  )
}

function IntegrationRow({
  integration,
  logoUrl,
  isConnected,
  isConnecting,
  onAction,
}: {
  integration: ConnectorCatalogItem
  logoUrl?: string | null
  isConnected: boolean
  isConnecting: boolean
  onAction: (integration: ConnectorCatalogItem) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-[var(--surface-muted)]">
      <div className="flex min-w-0 items-center gap-3">
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
        className="ml-4 flex-shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
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

export interface SkillDialogProps {
  state: { mode: 'create' | 'edit'; skill?: SkillSummary }
  onClose: () => void
  onSave: (values: SkillFormValues) => Promise<boolean | void>
  onDelete: (skill: SkillSummary) => Promise<boolean | void>
}

export function SkillDialog({ state, onClose, onSave, onDelete }: SkillDialogProps) {
  const isEdit = state.mode === 'edit'
  const initial = state.skill
  const [values, setValues] = useState<SkillFormValues>(() => skillToFormValues(initial))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  const update = <Key extends keyof SkillFormValues>(key: Key, value: SkillFormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      const ok = await onSave(values)
      if (ok === false) return
      setSaved(true)
      window.setTimeout(() => {
        setSaved(false)
        onClose()
      }, 800)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!isEdit || !initial || deleting) return
    setDeleting(true)
    try {
      const ok = await onDelete(initial)
      if (ok !== false) onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] p-4" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="flex w-full max-w-xl flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-sm font-medium text-[var(--foreground)]">{isEdit ? 'Edit Skill' : 'New Skill'}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <Field label="Name">
            <input
              ref={nameRef}
              value={values.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="e.g. Concise Responder"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]"
            />
          </Field>

          <Field label="Description">
            <input
              value={values.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Brief description of what this skill does"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]"
            />
          </Field>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Instructions</label>
              <span className="text-[10px] text-[var(--muted-light)]">Markdown supported</span>
            </div>
            <textarea
              value={values.instructions}
              onChange={(event) => update('instructions', event.target.value)}
              placeholder={'Describe what the AI should do differently when this skill is active.\n\nExample:\n- Always respond in bullet points\n- Keep answers under 3 sentences\n- Use a formal tone'}
              rows={12}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => update('enabled', !values.enabled)} className="flex items-center gap-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
              {values.enabled
                ? <ToggleRight size={18} className="text-[var(--foreground)]" />
                : <ToggleLeft size={18} className="text-[var(--muted-light)]" />}
              <span>{values.enabled ? 'Active' : 'Disabled'}</span>
            </button>
            {isEdit && initial ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex items-center gap-1 text-xs text-[var(--muted)] transition-colors hover:text-red-400 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : null}
            {saving ? 'Saving…' : saved ? 'Saved' : isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">{label}</label>
      {children}
    </div>
  )
}

export interface SkillsPanelProps {
  loading: boolean
  skills: readonly SkillSummary[]
  filteredSkills: readonly SkillSummary[]
  onCreate: () => void
  onEdit: (skill: SkillSummary) => void
  onToggle: (skill: SkillSummary, event: MouseEvent) => void
}

export function SkillsPanel({ loading, skills, filteredSkills, onCreate, onEdit, onToggle }: SkillsPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[var(--muted)]" />
      </div>
    )
  }

  if (skills.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Sparkles size={40} strokeWidth={1} className="text-[var(--muted-light)]" />
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">No skills yet</p>
          <p className="text-xs text-[var(--muted-light)]">Create reusable instructions that are automatically injected into every conversation</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
        >
          <Plus size={14} />
          New Skill
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSkills.map((skill) => (
            <SkillCard key={skill._id} skill={skill} onEdit={onEdit} onToggle={onToggle} />
          ))}
        </div>
      </div>
    </div>
  )
}

function SkillCard({
  skill,
  onEdit,
  onToggle,
}: {
  skill: SkillSummary
  onEdit: (skill: SkillSummary) => void
  onToggle: (skill: SkillSummary, event: MouseEvent) => void
}) {
  return (
    <div
      onClick={() => onEdit(skill)}
      className="group relative cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 transition-all hover:bg-[var(--surface-muted)] hover:shadow-sm"
    >
      <span
        className={`absolute right-4 top-4 h-2 w-2 rounded-full transition-colors ${skill.enabled !== false ? 'bg-[var(--foreground)]' : 'bg-[var(--muted-light)]'}`}
        title={skill.enabled !== false ? 'Active' : 'Disabled'}
      />

      <div className="mb-3 flex items-start gap-2 pr-6">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-subtle)]">
          <Sparkles size={13} className="text-[var(--muted)]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--foreground)]">{skill.name || 'Untitled'}</p>
          {skill.description ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--muted)]">{skill.description}</p>
          ) : null}
        </div>
      </div>

      {skill.instructions ? (
        <p className="line-clamp-2 font-mono text-[10px] text-[var(--muted-light)]">{skill.instructions}</p>
      ) : null}

      <div className="absolute bottom-3 right-3 hidden items-center gap-1 group-hover:flex">
        <button
          type="button"
          onClick={(event) => onToggle(skill, event)}
          className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
          title={skill.enabled !== false ? 'Disable' : 'Enable'}
        >
          {skill.enabled !== false ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onEdit(skill)
          }}
          className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
          title="Edit"
        >
          <Pencil size={13} />
        </button>
      </div>
    </div>
  )
}

export interface McpServerDialogProps {
  state: { mode: 'create' | 'edit'; server?: McpServerSummary }
  onClose: () => void
  onSave: (values: McpServerFormValues) => Promise<boolean | void>
  onDelete: (server: McpServerSummary) => Promise<boolean | void>
  onTest: (values: McpServerFormValues) => Promise<McpTestResultState>
}

export function McpServerDialog({ state, onClose, onSave, onDelete, onTest }: McpServerDialogProps) {
  const isEdit = state.mode === 'edit'
  const initial = state.server
  const [values, setValues] = useState<McpServerFormValues>(() => mcpServerToFormValues(initial))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<McpTestResultState | null>(null)

  const update = <Key extends keyof McpServerFormValues>(key: Key, value: McpServerFormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSave() {
    if (saving) return
    if (!values.name.trim() || !values.url.trim()) return
    setSaving(true)
    try {
      const ok = await onSave(values)
      if (ok === false) return
      setSaved(true)
      window.setTimeout(() => {
        setSaved(false)
        onClose()
      }, 800)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!isEdit || !initial || deleting) return
    setDeleting(true)
    try {
      const ok = await onDelete(initial)
      if (ok !== false) onClose()
    } finally {
      setDeleting(false)
    }
  }

  async function handleTest() {
    if (testing || !values.url.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult(await onTest(values))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] p-4" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="flex w-full max-w-xl flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-sm font-medium text-[var(--foreground)]">{isEdit ? 'Edit MCP Server' : 'Add MCP Server'}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"><X size={16} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <Field label="Name">
            <input value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. My API Server" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" />
          </Field>
          <Field label="Description">
            <input value={values.description} onChange={(event) => update('description', event.target.value)} placeholder="Optional description" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Transport">
              <select value={values.transport} onChange={(event) => update('transport', event.target.value as McpTransport)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]"><option value="streamable-http">Streamable HTTP</option><option value="sse">SSE</option></select>
            </Field>
            <Field label="Timeout (ms)">
              <input type="number" value={values.timeoutMs} onChange={(event) => update('timeoutMs', event.target.value === '' ? '' : Number(event.target.value))} placeholder="30000" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" />
            </Field>
          </div>
          <Field label="URL">
            <input value={values.url} onChange={(event) => update('url', event.target.value)} placeholder="https://example.com/mcp or http://localhost:3000/mcp" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" />
            <p className="text-[10px] text-[var(--muted-light)]">HTTPS required in production. HTTP allowed for localhost only.</p>
          </Field>
          <Field label="Authentication">
            <select value={values.authType} onChange={(event) => update('authType', event.target.value as McpAuthType)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]"><option value="none">None</option><option value="bearer">Bearer Token</option><option value="header">Custom Header</option></select>
          </Field>
          {values.authType === 'bearer' ? (
            <Field label="Bearer Token">
              <input type="password" value={values.bearerToken} onChange={(event) => update('bearerToken', event.target.value)} placeholder="Bearer token" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" />
            </Field>
          ) : null}
          {values.authType === 'header' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Header Name">
                <input value={values.headerName} onChange={(event) => update('headerName', event.target.value)} placeholder="X-Api-Key" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" />
              </Field>
              <Field label="Header Value">
                <input type="password" value={values.headerValue} onChange={(event) => update('headerValue', event.target.value)} placeholder="Secret value" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" />
              </Field>
            </div>
          ) : null}
          {testResult ? (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${testResult.ok ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border border-red-500/20 bg-red-500/10 text-red-400'}`}>
              {testResult.ok ? <Check size={12} /> : <AlertCircle size={12} />}
              <span>{testResult.message}</span>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => update('enabled', !values.enabled)} className="flex items-center gap-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
              {values.enabled ? <ToggleRight size={18} className="text-[var(--foreground)]" /> : <ToggleLeft size={18} className="text-[var(--muted-light)]" />}
              <span>{values.enabled ? 'Active' : 'Disabled'}</span>
            </button>
            {isEdit && initial ? (
              <button type="button" onClick={() => void handleDelete()} disabled={deleting} className="flex items-center gap-1 text-xs text-[var(--muted)] transition-colors hover:text-red-400 disabled:opacity-50">
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void handleTest()} disabled={testing || !values.url.trim()} className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50">
              {testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving || !values.name.trim() || !values.url.trim()} className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : null}
              {saving ? 'Saving…' : saved ? 'Saved' : isEdit ? 'Save' : 'Add Server'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export interface McpServersPanelProps {
  loading: boolean
  servers: readonly McpServerSummary[]
  filteredServers: readonly McpServerSummary[]
  onCreate: () => void
  onEdit: (server: McpServerSummary) => void
  onToggle: (server: McpServerSummary, event: MouseEvent) => void
}

export function McpServersPanel({ loading, servers, filteredServers, onCreate, onEdit, onToggle }: McpServersPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[var(--muted)]" />
      </div>
    )
  }

  if (servers.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Server size={40} strokeWidth={1} className="text-[var(--muted-light)]" />
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">No MCP servers configured</p>
          <p className="text-xs text-[var(--muted-light)]">Add remote MCP servers to extend the AI agent with custom tools</p>
        </div>
        <button onClick={onCreate} className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"><Plus size={14} />Add Server</button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredServers.map((server) => (
            <McpServerCard key={server._id} server={server} onEdit={onEdit} onToggle={onToggle} />
          ))}
        </div>
      </div>
    </div>
  )
}

function McpServerCard({
  server,
  onEdit,
  onToggle,
}: {
  server: McpServerSummary
  onEdit: (server: McpServerSummary) => void
  onToggle: (server: McpServerSummary, event: MouseEvent) => void
}) {
  return (
    <div onClick={() => onEdit(server)} className="group relative cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 transition-all hover:bg-[var(--surface-muted)] hover:shadow-sm">
      <span className={`absolute right-4 top-4 h-2 w-2 rounded-full transition-colors ${server.enabled ? 'bg-[var(--foreground)]' : 'bg-[var(--muted-light)]'}`} title={server.enabled ? 'Active' : 'Disabled'} />
      <div className="mb-3 flex items-start gap-2 pr-6">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-subtle)]">
          <Link2 size={13} className="text-[var(--muted)]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--foreground)]">{server.name || 'Untitled'}</p>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--muted)]">{server.url}</p>
          {server.description ? <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--muted-light)]">{server.description}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--muted)]">{server.transport}</span>
        {server.hasAuth ? <span className="inline-flex rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">Auth</span> : null}
      </div>
      <div className="absolute bottom-3 right-3 hidden items-center gap-1 group-hover:flex">
        <button type="button" onClick={(event) => onToggle(server, event)} className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]" title={server.enabled ? 'Disable' : 'Enable'}>{server.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(server) }} className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]" title="Edit"><Pencil size={13} /></button>
      </div>
    </div>
  )
}

export function ToolsComingSoonView({ title, icon: Icon }: {
  title: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-[var(--border)] px-6">
        <h2 className="text-sm font-medium text-[var(--foreground)]">{title}</h2>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-[var(--muted)]">
        <Icon size={40} strokeWidth={1} className="text-[var(--muted-light)] opacity-80" />
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">{title} coming soon</p>
          <p className="text-xs text-[var(--muted-light)]">This feature is under development</p>
        </div>
      </div>
    </div>
  )
}

export function AppsComingSoonView() {
  return <ToolsComingSoonView title="Apps" icon={Lock} />
}

export function AllExtensionsComingSoonView() {
  return <ToolsComingSoonView title="All Extensions" icon={LayoutGrid} />
}

export interface LegacyMcpServerFormValues {
  name: string
  description?: string
  transport: McpTransport
  url: string
  enabled: boolean
  authType: McpAuthType
  bearerToken?: string
  headerName?: string
  headerValue?: string
  timeoutMs?: number | ''
}

export interface McpServerFormProps {
  value: LegacyMcpServerFormValues
  saving?: boolean
  testing?: boolean
  testResult?: ReactNode
  submitLabel?: ReactNode
  onChange: (value: LegacyMcpServerFormValues) => void
  onSubmit?: () => void
  onTest?: () => void
}

export function McpServerForm({
  value,
  saving,
  testing,
  testResult,
  submitLabel = 'Save server',
  onChange,
  onSubmit,
  onTest,
}: McpServerFormProps) {
  const update = <Key extends keyof LegacyMcpServerFormValues>(key: Key, next: LegacyMcpServerFormValues[Key]) => {
    onChange({ ...value, [key]: next })
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit?.()
      }}
    >
      <Input value={value.name} onChange={(event) => update('name', event.target.value)} placeholder="Server name" />
      <Textarea
        value={value.description ?? ''}
        onChange={(event) => update('description', event.target.value)}
        placeholder="Description"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={value.transport} onChange={(event) => update('transport', event.target.value as McpTransport)}>
          <option value="streamable-http">Streamable HTTP</option>
          <option value="sse">SSE</option>
        </Select>
        <Select value={value.authType} onChange={(event) => update('authType', event.target.value as McpAuthType)}>
          <option value="none">No auth</option>
          <option value="bearer">Bearer token</option>
          <option value="header">Custom header</option>
        </Select>
      </div>
      <Input value={value.url} onChange={(event) => update('url', event.target.value)} placeholder="https://server.example/mcp" />
      {value.authType === 'bearer' ? (
        <Input
          value={value.bearerToken ?? ''}
          onChange={(event) => update('bearerToken', event.target.value)}
          placeholder="Bearer token"
          type="password"
        />
      ) : null}
      {value.authType === 'header' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={value.headerName ?? ''} onChange={(event) => update('headerName', event.target.value)} placeholder="Header name" />
          <Input value={value.headerValue ?? ''} onChange={(event) => update('headerValue', event.target.value)} placeholder="Header value" type="password" />
        </div>
      ) : null}
      <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm">
        <span>Enabled</span>
        <Toggle checked={value.enabled} onCheckedChange={(checked) => update('enabled', checked)} />
      </label>
      {testResult ? <div className="text-xs text-[var(--muted)]">{testResult}</div> : null}
      <div className="flex items-center justify-end gap-2">
        {onTest ? (
          <Button type="button" variant="ghost" disabled={testing} onClick={onTest}>
            {testing ? 'Testing' : 'Test'}
          </Button>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
