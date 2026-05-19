'use client'

// Compatibility wrapper: MCP contracts/controllers live in @overlay/app-core;
// shared React presentation lives in @overlay/modules-react.
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Plus } from 'lucide-react'
import {
  EXTENSIONS_CHANGED_EVENT,
  MCPS_CHANGED_EVENT,
  createMcpCreateRequest,
  createMcpSummaryFromForm,
  createMcpTestRequest,
  createMcpUpdateRequest,
  filterMcpServers,
  formatMcpTestResult,
  removeMcpServerSummary,
  setMcpServerEnabled,
  updateMcpSummaryFromForm,
  upsertMcpServerSummary,
  type McpServerFormValues,
  type McpServerSummary,
  type McpTestResultState,
  type TestMcpServerResponse,
} from '@overlay/app-core'
import { ExtensionPageHeader, McpServerDialog, McpServersPanel } from '@overlay/modules-react/extensions'
import { overlayAppClient } from '@/shared/app/overlay-app-client'

interface DialogState {
  mode: 'create' | 'edit'
  server?: McpServerSummary
}

export default function McpServersView({ userId: _userId }: { userId: string }) {
  void _userId
  const [servers, setServers] = useState<McpServerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const dispatchMcpsChanged = useCallback(() => {
    window.dispatchEvent(new CustomEvent(MCPS_CHANGED_EVENT))
    window.dispatchEvent(new CustomEvent(EXTENSIONS_CHANGED_EVENT))
  }, [])

  const loadServers = useCallback(async () => {
    try {
      setServers(await overlayAppClient.mcpServers.get<McpServerSummary[]>())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadServers()
  }, [loadServers])

  const filteredServers = useMemo(
    () => filterMcpServers(servers, searchQuery),
    [servers, searchQuery],
  )

  async function handleSaveServer(values: McpServerFormValues): Promise<boolean> {
    if (dialog?.mode === 'edit' && dialog.server) {
      const res = await overlayAppClient.mcpServers.updateResponse(createMcpUpdateRequest(dialog.server._id, values))
      if (!res.ok) return false
      setServers((prev) => upsertMcpServerSummary(prev, updateMcpSummaryFromForm(dialog.server!, values)))
      dispatchMcpsChanged()
      return true
    }

    const res = await overlayAppClient.mcpServers.createResponse(createMcpCreateRequest(values))
    if (!res.ok) return false
    const { id } = (await res.json()) as { id: string }
    setServers((prev) => upsertMcpServerSummary(prev, createMcpSummaryFromForm(id, values)))
    dispatchMcpsChanged()
    return true
  }

  async function handleDeleteServer(server: McpServerSummary): Promise<boolean> {
    const res = await overlayAppClient.mcpServers.deleteResponse({ mcpServerId: server._id })
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
      const res = await overlayAppClient.mcpServers.updateResponse({ mcpServerId: server._id, enabled: newEnabled })
      if (res.ok) dispatchMcpsChanged()
    } catch {
      // ignore optimistic update errors, matching prior behavior
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ExtensionPageHeader
        title="MCP Servers"
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        searchPlaceholder="Search servers…"
        searchTitle="Search servers"
        action={(
          <button
            onClick={() => setDialog({ mode: 'create' })}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
          >
            <Plus size={12} />
            Add Server
          </button>
        )}
        onSearchOpenChange={setSearchOpen}
        onSearchQueryChange={setSearchQuery}
      />

      <McpServersPanel
        loading={loading}
        servers={servers}
        filteredServers={filteredServers}
        onCreate={() => setDialog({ mode: 'create' })}
        onEdit={(server) => setDialog({ mode: 'edit', server })}
        onToggle={(server, event) => void handleQuickToggle(server, event)}
      />

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
