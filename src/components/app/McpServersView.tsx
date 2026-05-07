'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Server, Trash2, Loader2, Check, ToggleLeft, ToggleRight, X, Pencil, Search, Link2, AlertCircle, Zap } from 'lucide-react'

interface McpServer { _id: string; name: string; description?: string; transport: 'sse' | 'streamable-http'; url: string; enabled: boolean; authType: 'none' | 'bearer' | 'header'; hasAuth: boolean; timeoutMs?: number; createdAt: number; updatedAt: number }
interface DialogState { mode: 'create' | 'edit'; server?: McpServer }

function McpServerDialog({ state, onClose, onSaved, onDeleted }: { state: DialogState; onClose: () => void; onSaved: (server: McpServer) => void; onDeleted: (id: string) => void }) {
  const isEdit = state.mode === 'edit'
  const initial = state.server
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [transport, setTransport] = useState<'sse' | 'streamable-http'>(initial?.transport ?? 'streamable-http')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'header'>(initial?.authType ?? 'none')
  const [bearerToken, setBearerToken] = useState('')
  const [headerName, setHeaderName] = useState('')
  const [headerValue, setHeaderValue] = useState('')
  const [timeoutMs, setTimeoutMs] = useState<number | ''>(initial?.timeoutMs ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleSave() {
    if (saving) return
    if (!name.trim() || !url.trim()) return
    setSaving(true)
    try {
      const authConfig = authType === 'bearer' && bearerToken ? { bearerToken } : authType === 'header' && headerName && headerValue ? { headerName, headerValue } : undefined
      if (isEdit && initial) {
        const body: Record<string, unknown> = { mcpServerId: initial._id, name: name.trim(), description: description.trim(), transport, url: url.trim(), enabled, authType, ...(authConfig ? { authConfig } : { authConfig: null }), ...(timeoutMs !== '' ? { timeoutMs: Number(timeoutMs) } : {}) }
        const res = await fetch('/api/app/mcps', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!res.ok) return
        onSaved({ ...initial, name: name.trim(), description: description.trim(), transport, url: url.trim(), enabled, authType, hasAuth: !!authConfig, timeoutMs: timeoutMs !== '' ? Number(timeoutMs) : undefined })
        setSaved(true); setTimeout(() => { setSaved(false); onClose() }, 800)
      } else {
        const res = await fetch('/api/app/mcps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), description: description.trim(), transport, url: url.trim(), enabled, authType, ...(authConfig ? { authConfig } : {}), ...(timeoutMs !== '' ? { timeoutMs: Number(timeoutMs) } : {}) }) })
        if (!res.ok) return
        const { id } = await res.json() as { id: string }
        onSaved({ _id: id, name: name.trim(), description: description.trim(), transport, url: url.trim(), enabled, authType, hasAuth: !!authConfig, timeoutMs: timeoutMs !== '' ? Number(timeoutMs) : undefined, createdAt: Date.now(), updatedAt: Date.now() })
        setSaved(true); setTimeout(() => { setSaved(false); onClose() }, 800)
      }
      window.dispatchEvent(new CustomEvent('overlay:mcps-changed'))
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!isEdit || !initial || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/app/mcps?mcpServerId=${initial._id}`, { method: 'DELETE' })
      if (res.ok) { window.dispatchEvent(new CustomEvent('overlay:mcps-changed')); onDeleted(initial._id); onClose() }
    } finally { setDeleting(false) }
  }

  async function handleTest() {
    if (testing || !url.trim()) return
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch('/api/app/mcps/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim(), transport, authType, authConfig: authType === 'bearer' && bearerToken ? { bearerToken } : authType === 'header' && headerName && headerValue ? { headerName, headerValue } : undefined }) })
      const data = await res.json().catch(() => ({ error: 'Invalid response' }))
      setTestResult({ ok: res.ok && data.ok, message: res.ok && data.ok ? `Connected — ${data.toolCount ?? 0} tools available` : (data.error || 'Connection failed') })
    } catch { setTestResult({ ok: false, message: 'Connection failed' }) }
    finally { setTesting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex w-full max-w-xl flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-sm font-medium text-[var(--foreground)]">{isEdit ? 'Edit MCP Server' : 'Add MCP Server'}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 px-5 py-5">
          <div className="space-y-1.5"><label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My API Server" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" /></div>
          <div className="space-y-1.5"><label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Description</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Transport</label><select value={transport} onChange={(e) => setTransport(e.target.value as 'sse' | 'streamable-http')} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]"><option value="streamable-http">Streamable HTTP</option><option value="sse">SSE</option></select></div>
            <div className="space-y-1.5"><label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Timeout (ms)</label><input type="number" value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value === '' ? '' : Number(e.target.value))} placeholder="30000" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" /></div>
          </div>
          <div className="space-y-1.5"><label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">URL</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/mcp or http://localhost:3000/mcp" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" /><p className="text-[10px] text-[var(--muted-light)]">HTTPS required in production. HTTP allowed for localhost only.</p></div>
          <div className="space-y-1.5"><label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Authentication</label><select value={authType} onChange={(e) => setAuthType(e.target.value as 'none' | 'bearer' | 'header')} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]"><option value="none">None</option><option value="bearer">Bearer Token</option><option value="header">Custom Header</option></select></div>
          {authType === 'bearer' && <div className="space-y-1.5"><label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Bearer Token</label><input type="password" value={bearerToken} onChange={(e) => setBearerToken(e.target.value)} placeholder="Bearer token" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" /></div>}
          {authType === 'header' && <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Header Name</label><input value={headerName} onChange={(e) => setHeaderName(e.target.value)} placeholder="X-Api-Key" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" /></div><div className="space-y-1.5"><label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Header Value</label><input type="password" value={headerValue} onChange={(e) => setHeaderValue(e.target.value)} placeholder="Secret value" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]" /></div></div>}
          {testResult && <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${testResult.ok ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border border-red-500/20 bg-red-500/10 text-red-400'}`}>{testResult.ok ? <Check size={12} /> : <AlertCircle size={12} />}<span>{testResult.message}</span></div>}
        </div>
        <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setEnabled((v) => !v)} className="flex items-center gap-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">{enabled ? <ToggleRight size={18} className="text-[var(--foreground)]" /> : <ToggleLeft size={18} className="text-[var(--muted-light)]" />}<span>{enabled ? 'Active' : 'Disabled'}</span></button>
            {isEdit && <button type="button" onClick={() => void handleDelete()} disabled={deleting} className="flex items-center gap-1 text-xs text-[var(--muted)] transition-colors hover:text-red-400 disabled:opacity-50">{deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}Delete</button>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void handleTest()} disabled={testing || !url.trim()} className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50">{testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}{testing ? 'Testing…' : 'Test Connection'}</button>
            <button type="button" onClick={() => void handleSave()} disabled={saving || !name.trim() || !url.trim()} className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50">{saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : null}{saving ? 'Saving…' : saved ? 'Saved' : isEdit ? 'Save' : 'Add Server'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function McpServersView({ userId: _userId }: { userId: string }) {
  void _userId
  const [servers, setServers] = useState<McpServer[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const loadServers = useCallback(async () => { try { const res = await fetch('/api/app/mcps'); if (res.ok) setServers(await res.json()) } catch { /* ignore */ } finally { setLoading(false) } }, [])
  useEffect(() => { void loadServers() }, [loadServers])

  function handleSaved(server: McpServer) {
    setServers((prev) => { const idx = prev.findIndex((s) => s._id === server._id); if (idx >= 0) { const next = [...prev]; next[idx] = server; return next } return [server, ...prev] })
  }

  async function handleQuickToggle(server: McpServer, e: React.MouseEvent) {
    e.stopPropagation()
    const newEnabled = !server.enabled
    setServers((prev) => prev.map((s) => s._id === server._id ? { ...s, enabled: newEnabled } : s))
    try { await fetch('/api/app/mcps', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mcpServerId: server._id, enabled: newEnabled }) }); window.dispatchEvent(new CustomEvent('overlay:mcps-changed')) } catch { /* ignore */ }
  }

  const filtered = servers.filter((s) => { if (!searchQuery.trim()) return true; const q = searchQuery.toLowerCase(); return s.name.toLowerCase().includes(q) || (s.description?.toLowerCase().includes(q) ?? false) || s.url.toLowerCase().includes(q) })

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] px-6">
        <div className="shrink-0">
          <h2 className="text-sm font-medium text-[var(--foreground)]">MCP Servers</h2>
        </div>
        {searchOpen ? (
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search servers…" autoFocus className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-light)] focus:border-[var(--muted)]" />
        ) : <div className="flex-1" />}
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" title="Search servers" onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearchQuery('') }} className={`flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] ${searchOpen ? 'border-[var(--muted)] bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''}`}><Search size={14} strokeWidth={1.75} /></button>
          <button onClick={() => setDialog({ mode: 'create' })} className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"><Plus size={12} />Add Server</button>
        </div>
      </div>

      {loading ? <div className="flex flex-1 items-center justify-center"><Loader2 size={20} className="animate-spin text-[var(--muted)]" /></div> : servers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Server size={40} strokeWidth={1} className="text-[var(--muted-light)]" />
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">No MCP servers configured</p>
            <p className="text-xs text-[var(--muted-light)]">Add remote MCP servers to extend the AI agent with custom tools</p>
          </div>
          <button onClick={() => setDialog({ mode: 'create' })} className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"><Plus size={14} />Add Server</button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((server) => (
                <div key={server._id} onClick={() => setDialog({ mode: 'edit', server })} className="group relative cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 transition-all hover:bg-[var(--surface-muted)] hover:shadow-sm">
                  <span className={`absolute right-4 top-4 h-2 w-2 rounded-full transition-colors ${server.enabled ? 'bg-[var(--foreground)]' : 'bg-[var(--muted-light)]'}`} title={server.enabled ? 'Active' : 'Disabled'} />
                  <div className="mb-3 flex items-start gap-2 pr-6">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-subtle)]">
                      <Link2 size={13} className="text-[var(--muted)]" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">{server.name || 'Untitled'}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--muted)]">{server.url}</p>
                      {server.description && <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--muted-light)]">{server.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)] uppercase">{server.transport}</span>
                    {server.hasAuth && <span className="inline-flex rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">Auth</span>}
                  </div>
                  <div className="absolute bottom-3 right-3 hidden items-center gap-1 group-hover:flex">
                    <button type="button" onClick={(e) => void handleQuickToggle(server, e)} className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]" title={server.enabled ? 'Disable' : 'Enable'}>{server.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setDialog({ mode: 'edit', server }) }} className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]" title="Edit"><Pencil size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {dialog && <McpServerDialog state={dialog} onClose={() => setDialog(null)} onSaved={handleSaved} onDeleted={(id) => setServers((prev) => prev.filter((s) => s._id !== id))} />}
    </div>
  )
}
