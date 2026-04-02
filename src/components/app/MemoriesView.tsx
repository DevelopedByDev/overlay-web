'use client'

import { useState, useEffect, useCallback } from 'react'
import { Brain, CheckSquare, Copy, Plus, Square, Trash2, X } from 'lucide-react'

interface MemoryListItem {
  key: string
  memoryId: string
  segmentIndex: number
  content: string
  fullContent: string
  source: string
  type?: 'preference' | 'fact' | 'project' | 'decision' | 'agent'
  importance?: number
  projectId?: string
  conversationId?: string
  noteId?: string
  messageId?: string
  turnId?: string
  tags?: string[]
  actor?: 'user' | 'agent'
  status?: 'candidate' | 'approved' | 'rejected'
  createdAt: number
  updatedAt?: number
}

interface Memory {
  memoryId: string
  content: string
  source: string
  type?: 'preference' | 'fact' | 'project' | 'decision' | 'agent'
  importance?: number
  projectId?: string
  conversationId?: string
  noteId?: string
  messageId?: string
  turnId?: string
  tags: string[]
  actor?: 'user' | 'agent'
  status?: 'candidate' | 'approved' | 'rejected'
  createdAt: number
  updatedAt?: number
}

function uniqueMemoriesFromRows(rows: MemoryListItem[]): Memory[] {
  const seen = new Set<string>()
  const out: Memory[] = []
  for (const row of rows) {
    if (seen.has(row.memoryId)) continue
    seen.add(row.memoryId)
    out.push({
      memoryId: row.memoryId,
      content: row.fullContent,
      source: row.source,
      type: row.type,
      importance: row.importance,
      projectId: row.projectId,
      conversationId: row.conversationId,
      noteId: row.noteId,
      messageId: row.messageId,
      turnId: row.turnId,
      tags: row.tags ?? [],
      actor: row.actor,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }
  return out
}

function getDateLabel(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function getBadgeTone(kind: string): string {
  switch (kind) {
    case 'preference':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'decision':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'project':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'agent':
      return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'candidate':
      return 'bg-zinc-50 text-zinc-700 border-zinc-200'
    case 'approved':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'rejected':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    default:
      return 'bg-[#f5f5f5] text-[#666] border-[#ececec]'
  }
}

export default function MemoriesView({ userId: _userId }: { userId: string }) {
  void _userId
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addText, setAddText] = useState('')
  const [addType, setAddType] = useState<Memory['type']>('fact')
  const [addImportance, setAddImportance] = useState('3')
  const [isSaving, setIsSaving] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const loadMemories = useCallback(async () => {
    try {
      const res = await fetch('/api/app/memory')
      if (res.ok) {
        const rows = (await res.json()) as MemoryListItem[]
        setMemories(uniqueMemoriesFromRows(rows))
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMemories()
  }, [loadMemories])

  async function handleAdd() {
    const text = addText.trim()
    if (!text || isSaving) return
    setIsSaving(true)
    try {
      await fetch('/api/app/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          source: 'manual',
          type: addType,
          importance: Number(addImportance) || 3,
          actor: 'user',
          status: 'approved',
        }),
      })
      setAddText('')
      setAddType('fact')
      setAddImportance('3')
      setShowAdd(false)
      await loadMemories()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(memoryId: string) {
    await fetch(`/api/app/memory?memoryId=${memoryId}`, { method: 'DELETE' })
    setMemories((prev) => prev.filter((memory) => memory.memoryId !== memoryId))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(memoryId)
      return next
    })
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await Promise.all(ids.map((id) => fetch(`/api/app/memory?memoryId=${id}`, { method: 'DELETE' })))
    setMemories((prev) => prev.filter((memory) => !selectedIds.has(memory.memoryId)))
    setSelectedIds(new Set())
    setSelectionMode(false)
  }

  async function handleCopy(memory: Memory) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    await navigator.clipboard.writeText(memory.content)
  }

  function toggleSelected(memoryId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(memoryId)) next.delete(memoryId)
      else next.add(memoryId)
      return next
    })
  }

  const groups: Record<string, Memory[]> = {}
  for (const memory of memories) {
    const label = getDateLabel(memory.createdAt)
    ;(groups[label] ||= []).push(memory)
  }
  const groupLabels = Object.keys(groups)

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-[#e5e5e5] px-6">
        <h2 className="text-sm font-medium text-[#0a0a0a]">
          Memories
          {memories.length > 0 && (
            <span className="ml-2 text-xs text-[#888] font-normal">{memories.length}</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectionMode((value) => !value)
              setSelectedIds(new Set())
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
              selectionMode
                ? 'bg-[#ebebeb] text-[#0a0a0a]'
                : 'bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]'
            }`}
          >
            <CheckSquare size={12} />
            {selectionMode ? 'Done' : 'Select'}
          </button>
          {selectionMode && selectedIds.size > 0 && (
            <button
              onClick={() => void handleBulkDelete()}
              className="flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-100"
            >
              <Trash2 size={12} />
              Delete {selectedIds.size}
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-[#0a0a0a] text-[#fafafa] hover:bg-[#222] transition-colors"
          >
            <Plus size={12} />
            Add memory
          </button>
        </div>
      </div>

      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowAdd(false)
          }}
        >
          <div className="w-[520px] max-w-[92vw] rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-[#0a0a0a]">Add memory</h3>
              <button
                onClick={() => setShowAdd(false)}
                className="rounded p-1 transition-colors hover:bg-[#f0f0f0]"
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              value={addText}
              onChange={(event) => setAddText(event.target.value)}
              placeholder="Type or paste memory content..."
              autoFocus
              rows={5}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.metaKey) void handleAdd()
              }}
              className="w-full resize-none rounded-lg border border-[#e5e5e5] px-3 py-2.5 text-sm text-[#0a0a0a] outline-none transition-colors placeholder-[#aaa] focus:border-[#0a0a0a]"
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs text-[#666]">
                Type
                <select
                  value={addType ?? 'fact'}
                  onChange={(event) => setAddType(event.target.value as Memory['type'])}
                  className="mt-1 w-full rounded-md border border-[#e5e5e5] bg-white px-2.5 py-2 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                >
                  <option value="fact">Fact</option>
                  <option value="preference">Preference</option>
                  <option value="project">Project</option>
                  <option value="decision">Decision</option>
                  <option value="agent">Agent</option>
                </select>
              </label>
              <label className="text-xs text-[#666]">
                Importance
                <select
                  value={addImportance}
                  onChange={(event) => setAddImportance(event.target.value)}
                  className="mt-1 w-full rounded-md border border-[#e5e5e5] bg-white px-2.5 py-2 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </label>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[#888]">
              Saved memories stay as a single record, but the knowledge sidebar can still preview
              them in short segments for easier scanning.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-md px-3 py-1.5 text-xs text-[#525252] transition-colors hover:bg-[#f0f0f0]"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAdd()}
                disabled={!addText.trim() || isSaving}
                className="rounded-md bg-[#0a0a0a] px-3 py-1.5 text-xs text-[#fafafa] transition-colors hover:bg-[#222] disabled:opacity-40"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-[#888]">
            Loading...
          </div>
        ) : memories.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-[#888]">
            <Brain size={40} strokeWidth={1} className="opacity-40" />
            <p className="text-sm">No memories yet</p>
            <button
              onClick={() => setShowAdd(true)}
              className="text-xs text-[#525252] underline underline-offset-2 transition-colors hover:text-[#0a0a0a]"
            >
              Add your first memory
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-6 py-4">
            {groupLabels.map((label) => (
              <div key={label}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#888]">
                  {label}
                </p>
                <div className="space-y-2">
                  {groups[label].map((memory) => {
                    const isSelected = selectedIds.has(memory.memoryId)
                    return (
                      <div
                        key={memory.memoryId}
                        className={`group rounded-xl border px-3 py-3 transition-colors ${
                          isSelected
                            ? 'border-[#0a0a0a] bg-[#fafafa]'
                            : 'border-[#efefef] bg-white hover:border-[#dcdcdc] hover:bg-[#fafafa]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {selectionMode && (
                            <button
                              type="button"
                              onClick={() => toggleSelected(memory.memoryId)}
                              className="mt-0.5 shrink-0 text-[#666]"
                            >
                              {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#0a0a0a]">
                              {memory.content}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {memory.type && (
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${getBadgeTone(memory.type)}`}>
                                  {memory.type}
                                </span>
                              )}
                              {memory.status && (
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${getBadgeTone(memory.status)}`}>
                                  {memory.status}
                                </span>
                              )}
                              <span className="rounded-full border border-[#ececec] bg-[#f8f8f8] px-2 py-0.5 text-[10px] text-[#666]">
                                {memory.source}
                              </span>
                              {typeof memory.importance === 'number' && (
                                <span className="rounded-full border border-[#ececec] bg-[#f8f8f8] px-2 py-0.5 text-[10px] text-[#666]">
                                  importance {memory.importance}
                                </span>
                              )}
                              {memory.actor && (
                                <span className="rounded-full border border-[#ececec] bg-[#f8f8f8] px-2 py-0.5 text-[10px] text-[#666]">
                                  {memory.actor}
                                </span>
                              )}
                              {memory.projectId && (
                                <span className="rounded-full border border-[#ececec] bg-[#f8f8f8] px-2 py-0.5 text-[10px] text-[#666]">
                                  project
                                </span>
                              )}
                              {memory.conversationId && (
                                <span className="rounded-full border border-[#ececec] bg-[#f8f8f8] px-2 py-0.5 text-[10px] text-[#666]">
                                  chat
                                </span>
                              )}
                              {memory.noteId && (
                                <span className="rounded-full border border-[#ececec] bg-[#f8f8f8] px-2 py-0.5 text-[10px] text-[#666]">
                                  note
                                </span>
                              )}
                              {memory.tags.map((tag) => (
                                <span
                                  key={`${memory.memoryId}:${tag}`}
                                  className="rounded-full border border-[#ececec] bg-[#f8f8f8] px-2 py-0.5 text-[10px] text-[#666]"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-[11px] text-[#aaa]">
                              <span>
                                {new Date(memory.createdAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {memory.updatedAt && memory.updatedAt !== memory.createdAt && (
                                <span>
                                  updated{' '}
                                  {new Date(memory.updatedAt).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                          {!selectionMode && (
                            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => void handleCopy(memory)}
                                className="rounded p-1 transition-colors hover:bg-[#f0f0f0]"
                                title="Copy memory"
                              >
                                <Copy size={13} className="text-[#666]" />
                              </button>
                              <button
                                onClick={() => void handleDelete(memory.memoryId)}
                                className="rounded p-1 transition-colors hover:bg-red-50"
                                title="Delete memory"
                              >
                                <Trash2 size={13} className="text-red-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
