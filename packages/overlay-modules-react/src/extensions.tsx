'use client'

import type { ReactNode } from 'react'
import type { McpAuthType, McpServerSummary, McpTransport } from '@overlay/app-core'
import type { ExtensionCatalogItem } from '@overlay/app-core/modules'
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
        const disabledByPolicy = policyDisabledIds?.has(item.kind === 'integration' ? item.slug : item._id) ?? false
        return (
          <article
            key={`${item.kind}:${item.kind === 'integration' ? item.slug : item._id}`}
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
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <Badge variant="muted">{item.kind}</Badge>
                </div>
                {'description' in item && item.description ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{item.description}</p>
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
  return <Badge variant={item.enabled ? 'success' : 'muted'}>{item.enabled ? 'On' : 'Off'}</Badge>
}

export interface McpServerFormValues {
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
  value: McpServerFormValues
  saving?: boolean
  testing?: boolean
  testResult?: ReactNode
  submitLabel?: ReactNode
  onChange: (value: McpServerFormValues) => void
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
  const update = <Key extends keyof McpServerFormValues>(key: Key, next: McpServerFormValues[Key]) => {
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

export function mcpServerToFormValues(server: McpServerSummary): McpServerFormValues {
  return {
    name: server.name,
    description: server.description ?? '',
    transport: server.transport,
    url: server.url,
    enabled: server.enabled,
    authType: server.authType,
    timeoutMs: server.timeoutMs ?? '',
  }
}
