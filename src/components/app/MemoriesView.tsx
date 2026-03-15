'use client'

import { useState, useEffect, useCallback } from 'react'
import { Brain, Trash2, Plus, X } from 'lucide-react'

interface Memory {
  _id: string
  content: string
  source: string
  createdAt: number
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

export default function MemoriesView({ userId: _userId }: { userId: string }) {
  void _userId
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addText, setAddText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const loadMemories = useCallback(async () => {
    try {
      const res = await fetch('/api/app/memory')
      if (res.ok) setMemories(await res.json())
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadMemories() }, [loadMemories])

  async function handleAdd() {
    const text = addText.trim()
    if (!text || isSaving) return
    setIsSaving(true)
    try {
      await fetch('/api/app/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, source: 'manual' }),
      })
      setAddText('')
      setShowAdd(false)
      await loadMemories()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(memoryId: string) {
    await fetch(`/api/app/memory?memoryId=${memoryId}`, { method: 'DELETE' })
    setMemories((prev) => prev.filter((m) => m._id !== memoryId))
  }

  // Group by date
  const groups: Record<string, Memory[]> = {}
  for (const m of memories) {
    const label = getDateLabel(m.createdAt)
    ;(groups[label] ||= []).push(m)
  }
  const groupLabels = Object.keys(groups)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-[#e5e5e5] px-6">
        <h2 className="text-sm font-medium text-[#0a0a0a]">
          Memories
          {memories.length > 0 && (
            <span className="ml-2 text-xs text-[#888] font-normal">{memories.length}</span>
          )}
        </h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-[#0a0a0a] text-[#fafafa] hover:bg-[#222] transition-colors"
        >
          <Plus size={12} />
          Add memory
        </button>
      </div>

      {/* Add memory dialog */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div className="bg-white rounded-xl p-6 w-[480px] max-w-[90vw] shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[#0a0a0a]">Add memory</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded hover:bg-[#f0f0f0] transition-colors">
                <X size={14} />
              </button>
            </div>
            <textarea
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder="Type or paste memory content..."
              autoFocus
              rows={5}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleAdd() }}
              className="w-full text-sm text-[#0a0a0a] border border-[#e5e5e5] rounded-lg px-3 py-2.5 resize-none outline-none placeholder-[#aaa] focus:border-[#0a0a0a] transition-colors"
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button
                onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 rounded-md text-xs text-[#525252] hover:bg-[#f0f0f0] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!addText.trim() || isSaving}
                className="px-3 py-1.5 rounded-md text-xs bg-[#0a0a0a] text-[#fafafa] disabled:opacity-40 hover:bg-[#222] transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-sm text-[#888]">
            Loading...
          </div>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#888]">
            <Brain size={40} strokeWidth={1} className="opacity-40" />
            <p className="text-sm">No memories yet</p>
            <button
              onClick={() => setShowAdd(true)}
              className="text-xs text-[#525252] underline underline-offset-2 hover:text-[#0a0a0a] transition-colors"
            >
              Add your first memory
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-6 py-4 space-y-6">
            {groupLabels.map((label) => (
              <div key={label}>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#888] mb-2">{label}</p>
                <div className="space-y-1">
                  {groups[label].map((memory) => (
                    <div
                      key={memory._id}
                      className="group flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f5f5f5] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#0a0a0a] leading-relaxed">{memory.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-[#aaa]">
                            {new Date(memory.createdAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {memory.source && (
                            <span className="text-[11px] text-[#aaa]">· {memory.source}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(memory._id)}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded hover:bg-red-50 transition-all"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
