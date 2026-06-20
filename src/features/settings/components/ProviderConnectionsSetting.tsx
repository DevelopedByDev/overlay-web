'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ExternalLink,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { DialogFrame } from '@overlay/ui/primitives'
import { ConfirmDialog } from '@overlay/ui/overlays'
import {
  BYOK_PROVIDER_PRESETS,
  getByokPreset,
} from '@overlay/llm-gateway'
import type { ByokConnectionRow } from '@/shared/ai/gateway/byok-model-conversion'
import { parseDiscoveredModels } from '@/shared/ai/gateway/byok-model-conversion'
import { useByokModels } from '@/components/providers/useByokModels'

// ─── Types ───

interface DiscoveredModel {
  id: string
  name?: string
}

type DialogState =
  | { mode: 'add' }
  | { mode: 'edit'; connection: ByokConnectionRow }
  | null

// ─── Helpers ───

function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return 'Never'
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getEnabledModelCount(connection: ByokConnectionRow): number {
  return connection.enabledModelIds.length
}

// ─── Main Component ───

export function ProviderConnectionsSetting() {
  const { connections, isLoading, error, refresh } = useByokModels()
  const [dialog, setDialog] = useState<DialogState>(null)
  const [deleteTarget, setDeleteTarget] = useState<ByokConnectionRow | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSaved = useCallback(() => {
    void refresh()
    setDialog(null)
  }, [refresh])

  const handleDeleted = useCallback(() => {
    void refresh()
    setDeleteTarget(null)
  }, [refresh])

  return (
    <div className="flex flex-col gap-4">
      {/* Header bar with Add button */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">
            Connect your own AI provider keys. Models from connected providers appear in your model dropdown.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ mode: 'add' })}
          disabled={isLoading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-elevated)] disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={2} />
          Add provider
        </button>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-[var(--muted)]">
          <Loader2 size={16} className="mr-2 animate-spin" />
          Loading providers...
        </div>
      ) : null}

      {/* Error state */}
      {error && !isLoading ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          <AlertCircle size={16} shrink-0 />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Connections list */}
      {!isLoading && connections.length === 0 && !error ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] py-12 text-center">
          <KeyRound size={24} className="mx-auto mb-3 text-[var(--muted-light)]" strokeWidth={1.5} />
          <p className="text-sm text-[var(--muted)]">No provider connections yet.</p>
          <p className="mt-1 text-xs text-[var(--muted-light)]">
            Add a provider to use your own API keys with Overlay.
          </p>
        </div>
      ) : null}

      {!isLoading && connections.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] divide-y divide-[var(--border)]">
          {connections.map((connection) => (
            <ConnectionRow
              key={connection._id}
              connection={connection}
              onEdit={() => setDialog({ mode: 'edit', connection })}
              onDelete={() => setDeleteTarget(connection)}
            />
          ))}
        </div>
      ) : null}

      {/* Add/Edit Dialog */}
      {dialog ? (
        <ProviderDialog
          state={dialog}
          busy={busy}
          onBusyChange={setBusy}
          onClose={() => !busy && setDialog(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {/* Delete Confirmation */}
      {deleteTarget ? (
        <ConfirmDialog
          isOpen={true}
          title="Delete provider"
          description={`Remove "${deleteTarget.displayName}" and its API key? Models from this provider will no longer appear in your dropdown.`}
          confirmLabel="Delete"
          destructive
          busy={busy}
          onConfirm={async () => {
            setBusy(true)
            try {
              const res = await fetch(`/api/v1/providers/connections?connectionId=${deleteTarget._id}`, {
                method: 'DELETE',
              })
              if (res.ok) handleDeleted()
            } finally {
              setBusy(false)
            }
          }}
          onCancel={() => !busy && setDeleteTarget(null)}
        />
      ) : null}
    </div>
  )
}

// ─── Connection Row ───

function ConnectionRow({
  connection,
  onEdit,
  onDelete,
}: {
  connection: ByokConnectionRow
  onEdit: () => void
  onDelete: () => void
}) {
  const preset = getByokPreset(connection.providerId)
  const modelCount = getEnabledModelCount(connection)
  const hasError = connection.status === 'error'

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {/* Status indicator */}
      <span
        className={`inline-flex h-2 w-2 shrink-0 rounded-full ${
          hasError
            ? 'bg-red-500'
            : connection.status === 'active'
              ? 'bg-green-500'
              : 'bg-[var(--muted-light)]'
        }`}
      />

      {/* Connection info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-[var(--foreground)]">
            {connection.displayName}
          </span>
          {connection.isDefault ? (
            <span className="shrink-0 rounded-full bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--muted)]">
              DEFAULT
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-[var(--muted)]">
          <span className="truncate">{preset?.label ?? connection.providerId}</span>
          <span>·</span>
          <span className="shrink-0">{modelCount} model{modelCount !== 1 ? 's' : ''}</span>
          {connection.lastTestedAt ? (
            <>
              <span>·</span>
              <span className="shrink-0">Tested {formatRelativeTime(connection.lastTestedAt)}</span>
            </>
          ) : null}
        </div>
        {hasError && connection.lastError ? (
          <div className="mt-1 flex items-center gap-1 text-xs text-red-500">
            <AlertCircle size={11} shrink-0 />
            <span className="truncate">{connection.lastError}</span>
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          aria-label="Edit provider"
        >
          <Pencil size={14} strokeWidth={1.8} />
        </button>
        {connection.isDeletable ? (
          <button
            type="button"
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-red-500"
            aria-label="Delete provider"
          >
            <Trash2 size={14} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

// ─── Provider Dialog (Add / Edit) ───

interface ProviderDialogProps {
  state: Exclude<DialogState, null>
  busy: boolean
  onBusyChange: (busy: boolean) => void
  onClose: () => void
  onSaved: () => void
}

function ProviderDialog({ state, busy, onBusyChange, onClose, onSaved }: ProviderDialogProps) {
  const isEdit = state.mode === 'edit'
  const existing = state.mode === 'edit' ? state.connection : null

  const [providerId, setProviderId] = useState(existing?.providerId ?? 'openrouter')
  const [endpoint, setEndpoint] = useState(existing?.endpoint ?? '')
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '')
  const [apiKey, setApiKey] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; models: DiscoveredModel[]; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [enabledModelIds, setEnabledModelIds] = useState<string[]>(existing?.enabledModelIds ?? [])
  const [showApiKey, setShowApiKey] = useState(false)

  const preset = getByokPreset(providerId)
  const isCustom = providerId === 'custom'
  const showEndpoint = isCustom || (preset?.allowsCustomEndpoint ?? false)

  // Pre-fill endpoint from preset default when not custom and no existing endpoint
  useEffect(() => {
    if (!showEndpoint && preset && !endpoint) {
      setEndpoint(preset.defaultBaseURL)
    }
  }, [showEndpoint, preset, endpoint])

  // Pre-fill display name from preset label
  useEffect(() => {
    if (!displayName && preset && !isEdit) {
      setDisplayName(preset.label)
    }
  }, [preset, displayName, isEdit])

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/v1/providers/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          endpoint: endpoint || preset?.defaultBaseURL,
          apiKey: apiKey || undefined,
        }),
      })
      const data = await res.json() as { ok: boolean; models: DiscoveredModel[]; error?: string }
      setTestResult(data)
      if (data.ok && data.models.length > 0) {
        // Auto-select all models on first test
        setEnabledModelIds(data.models.map((m) => m.id))
      }
    } catch (e) {
      setTestResult({ ok: false, models: [], error: e instanceof Error ? e.message : 'Test failed' })
    } finally {
      setTesting(false)
    }
  }, [providerId, endpoint, apiKey, preset])

  const handleSave = useCallback(async () => {
    onBusyChange(true)
    try {
      if (isEdit && existing) {
        const body: Record<string, unknown> = {
          connectionId: existing._id,
          displayName,
          enabledModelIds,
          status: testResult?.ok ? 'active' : existing.status,
          lastTestedAt: testResult ? Date.now() : undefined,
        }
        if (apiKey) body.apiKey = apiKey
        if (testResult?.ok) {
          body.discoveredModelsJson = JSON.stringify({ data: testResult.models })
          body.discoveredAt = Date.now()
        }
        if (testResult && !testResult.ok) {
          body.status = 'error'
          body.lastError = testResult.error
        }

        const res = await fetch('/api/v1/providers/connections', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) onSaved()
      } else {
        // Create new connection
        const res = await fetch('/api/v1/providers/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            endpoint: endpoint || preset?.defaultBaseURL,
            displayName,
            apiKey,
            enabledModelIds,
          }),
        })
        if (res.ok) {
          // After creation, update with test results if available
          const data = await res.json() as { id: string }
          if (testResult?.ok && data.id) {
            await fetch('/api/v1/providers/connections', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                connectionId: data.id,
                status: 'active',
                lastTestedAt: Date.now(),
                discoveredModelsJson: JSON.stringify({ data: testResult.models }),
                discoveredAt: Date.now(),
              }),
            })
          }
          onSaved()
        }
      }
    } finally {
      onBusyChange(false)
    }
  }, [isEdit, existing, displayName, enabledModelIds, apiKey, providerId, endpoint, preset, testResult, onSaved, onBusyChange])

  const canSave = displayName.trim().length > 0 && (!preset?.requiresApiKey || apiKey || isEdit)

  // Provider dropdown options (exclude vercel-ai-gateway for add mode)
  const availablePresets = BYOK_PROVIDER_PRESETS.filter(
    (p) => p.id !== 'vercel-ai-gateway' || isEdit,
  )

  return (
    <DialogFrame
      open={true}
      title={isEdit ? 'Edit provider' : 'Add provider'}
      onOpenChange={(open) => !open && !busy && onClose()}
      className="w-[min(520px,92vw)]"
      footer={
        <>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || busy}
            className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--foreground)] transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Test connection
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !canSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-4 py-2 text-xs font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {isEdit ? 'Save changes' : 'Add provider'}
          </button>
        </>
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        {/* Provider selector — only for add mode */}
        {!isEdit ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Provider</label>
            <div className="relative">
              <select
                value={providerId}
                onChange={(e) => {
                  setProviderId(e.target.value)
                  setTestResult(null)
                  setEnabledModelIds([])
                  const newPreset = getByokPreset(e.target.value)
                  setEndpoint(newPreset?.defaultBaseURL ?? '')
                  setDisplayName(newPreset?.label ?? '')
                }}
                className="h-10 w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 pr-8 text-sm text-[var(--foreground)] outline-none focus:border-[var(--muted)]"
              >
                {availablePresets.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            </div>
            {preset?.docsURL ? (
              <a
                href={preset.docsURL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[var(--muted-light)] hover:text-[var(--muted)]"
              >
                <ExternalLink size={10} />
                Provider docs
              </a>
            ) : null}
          </div>
        ) : null}

        {/* Endpoint URL — only for custom or when allowed */}
        {showEndpoint ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Endpoint URL</label>
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.com/v1"
              disabled={isEdit && !isCustom}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--muted)] disabled:opacity-60"
            />
          </div>
        ) : null}

        {/* API Key */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
            API key{preset?.requiresApiKey === false ? ' (optional)' : ''}
            {isEdit ? ' (leave blank to keep existing)' : ''}
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isEdit ? '••••••••' : 'Enter your API key'}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 pr-10 text-sm text-[var(--foreground)] outline-none focus:border-[var(--muted)]"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-light)] hover:text-[var(--muted)]"
            >
              {showApiKey ? <X size={14} /> : <KeyRound size={14} />}
            </button>
          </div>
        </div>

        {/* Display Name */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Personal OpenRouter key"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--muted)]"
          />
        </div>

        {/* Test results */}
        {testResult ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
            {testResult.ok ? (
              <>
                <div className="flex items-center gap-2 text-xs font-medium text-green-600 dark:text-green-400">
                  <Check size={14} />
                  Connected — {testResult.models.length} model{testResult.models.length !== 1 ? 's' : ''} found
                </div>
                {testResult.models.length > 0 ? (
                  <div className="mt-2 max-h-40 overflow-y-auto">
                    <p className="mb-1.5 text-[11px] text-[var(--muted)]">Select models to enable:</p>
                    {testResult.models.map((model) => (
                      <label
                        key={model.id}
                        className="flex cursor-pointer items-center gap-2 py-1 text-xs text-[var(--foreground)]"
                      >
                        <input
                          type="checkbox"
                          checked={enabledModelIds.includes(model.id)}
                          onChange={() => {
                            setEnabledModelIds((prev) =>
                              prev.includes(model.id)
                                ? prev.filter((id) => id !== model.id)
                                : [...prev, model.id],
                            )
                          }}
                          className="h-3.5 w-3.5 rounded border-[var(--border)]"
                        />
                        <span className="truncate">{model.name ?? model.id}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-red-500">
                <AlertCircle size={14} shrink-0 />
                <span className="truncate">{testResult.error ?? 'Connection failed'}</span>
              </div>
            )}
          </div>
        ) : null}

        {/* Existing discovered models (edit mode, before re-test) */}
        {isEdit && existing && !testResult && existing.discoveredModelsJson ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
            <p className="mb-2 text-xs font-medium text-[var(--muted)]">
              {parseDiscoveredModels(existing.discoveredModelsJson).length} discovered models
            </p>
            <div className="max-h-32 overflow-y-auto">
              {parseDiscoveredModels(existing.discoveredModelsJson).map((model) => (
                <label
                  key={model.id}
                  className="flex cursor-pointer items-center gap-2 py-1 text-xs text-[var(--foreground)]"
                >
                  <input
                    type="checkbox"
                    checked={enabledModelIds.includes(model.id)}
                    onChange={() => {
                      setEnabledModelIds((prev) =>
                        prev.includes(model.id)
                          ? prev.filter((id) => id !== model.id)
                          : [...prev, model.id],
                      )
                    }}
                    className="h-3.5 w-3.5 rounded border-[var(--border)]"
                  />
                  <span className="truncate">{model.name ?? model.id}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </DialogFrame>
  )
}
