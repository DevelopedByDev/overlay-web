'use client'

import { useState, useCallback, useEffect, type MouseEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Workflow, Pencil, Trash2, Loader2 } from 'lucide-react'
import { SidebarListSkeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/app/ConfirmDialog'
import { dispatchChatDeleted } from '@/lib/chat-title'

const AUTOMATIONS_UPDATED_EVENT = 'overlay:automations-updated'

type Automation = {
  _id: string
  name?: string
  title?: string
  enabled: boolean
  createdAt: number
  sourceConversationId?: string
  conversationId?: string
  nextRunAt?: number
  lastError?: string
}

export function AutomationsInlinePanel({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null)
  const [editingAutomationName, setEditingAutomationName] = useState('')
  const [confirmDeleteAutomation, setConfirmDeleteAutomation] = useState<Automation | null>(null)
  const [deletingAutomationIds, setDeletingAutomationIds] = useState<string[]>([])
  const [pendingNavId, setPendingNavId] = useState<string | null>(null)
  const activeId = searchParams?.get('id') ?? null
  const activeAutomationId = searchParams?.get('automationId') ?? null

  const loadAutomations = useCallback(async () => {
    try {
      const res = await fetch('/api/app/automations')
      if (res.ok) setAutomations(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAutomations()
  }, [loadAutomations])

  useEffect(() => {
    function handleAutomationsUpdated() {
      setLoading(true)
      void loadAutomations()
    }
    window.addEventListener(AUTOMATIONS_UPDATED_EVENT, handleAutomationsUpdated)
    return () => window.removeEventListener(AUTOMATIONS_UPDATED_EVENT, handleAutomationsUpdated)
  }, [loadAutomations])

  function automationHref(automation: Automation): string {
    const conversationId = automation.sourceConversationId || automation.conversationId
    return conversationId
      ? `/app/automations?id=${encodeURIComponent(conversationId)}&automationId=${encodeURIComponent(automation._id)}`
      : `/app/automations?automationId=${encodeURIComponent(automation._id)}`
  }

  function beginAutomationRename(automation: Automation, event: MouseEvent) {
    event.stopPropagation()
    const label = automation.name || automation.title || 'Untitled automation'
    setEditingAutomationId(automation._id)
    setEditingAutomationName(label)
  }

  function cancelAutomationRename() {
    setEditingAutomationId(null)
    setEditingAutomationName('')
  }

  async function commitAutomationRename(automation: Automation) {
    const nextName = editingAutomationName.trim()
    const previousName = automation.name || automation.title || 'Untitled automation'
    if (!nextName || nextName === previousName) {
      cancelAutomationRename()
      return
    }

    setAutomations((prev) => prev.map((item) => (
      item._id === automation._id ? { ...item, name: nextName } : item
    )))
    cancelAutomationRename()
    try {
      const res = await fetch('/api/app/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationId: automation._id, name: nextName }),
      })
      if (!res.ok) throw new Error('Failed to rename automation')
      window.dispatchEvent(new Event(AUTOMATIONS_UPDATED_EVENT))
    } catch {
      setAutomations((prev) => prev.map((item) => (
        item._id === automation._id ? { ...item, name: previousName } : item
      )))
    }
  }

  async function performDeleteAutomation() {
    const automation = confirmDeleteAutomation
    if (!automation) return
    setDeletingAutomationIds((prev) => prev.includes(automation._id) ? prev : [...prev, automation._id])
    try {
      const res = await fetch(`/api/app/automations?automationId=${encodeURIComponent(automation._id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete automation')
      const payload = (await res.json().catch(() => ({}))) as { linkedConversationIds?: string[] }
      setAutomations((prev) => prev.filter((item) => item._id !== automation._id))
      for (const chatId of payload.linkedConversationIds ?? []) {
        dispatchChatDeleted({ chatId })
      }
      window.dispatchEvent(new Event(AUTOMATIONS_UPDATED_EVENT))
    } catch {
      // keep row in place
    } finally {
      setDeletingAutomationIds((prev) => prev.filter((id) => id !== automation._id))
      setConfirmDeleteAutomation(null)
    }
  }

  if (loading) return <SidebarListSkeleton rows={3} />

  if (automations.length === 0) {
    return <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">No automations yet</p>
  }

  return (
    <>
    <div className="space-y-0.5">
      {automations.map((automation) => {
        const statusLabel = automation.lastError
          ? 'Error'
          : automation.enabled
            ? 'Enabled'
            : 'Paused'
        const iconColor = automation.lastError
          ? 'text-red-500'
          : automation.enabled
            ? 'text-green-500'
            : 'text-[var(--muted-light)]'
        const conversationId = automation.sourceConversationId || automation.conversationId
        const automationLabel = automation.name || automation.title || 'Untitled automation'
        const isActive = activeAutomationId === automation._id || activeId === automation._id || activeId === conversationId
        const isEditing = editingAutomationId === automation._id
        const isDeleting = deletingAutomationIds.includes(automation._id)
        return (
          <div
            key={automation._id}
            title={automation.lastError || statusLabel}
            className={`group/automation-row flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
              isActive
                ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
            }`}
          >
            <button
              type="button"
              disabled={isDeleting || pendingNavId === automation._id}
              onClick={async () => {
                if (isEditing) return
                setPendingNavId(automation._id)
                try {
                  await fetch(
                    `/api/app/automations?automationId=${encodeURIComponent(automation._id)}`,
                    { credentials: 'same-origin', cache: 'no-store' },
                  ).catch(() => null)
                } finally {
                  setPendingNavId(null)
                  router.push(automationHref(automation))
                  onNavigate?.()
                }
              }}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-0.5 text-left disabled:cursor-default disabled:opacity-50"
            >
              {pendingNavId === automation._id ? (
                <Loader2 size={13} strokeWidth={1.75} className="shrink-0 animate-spin text-[var(--muted)]" />
              ) : (
                <Workflow size={13} strokeWidth={1.75} className={`shrink-0 ${iconColor}`} />
              )}
              {isEditing ? (
                <input
                  autoFocus
                  value={editingAutomationName}
                  onChange={(event) => setEditingAutomationName(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void commitAutomationRename(automation)
                    } else if (event.key === 'Escape') {
                      event.preventDefault()
                      cancelAutomationRename()
                    }
                  }}
                  onBlur={() => void commitAutomationRename(automation)}
                  className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[11px] text-[var(--foreground)] outline-none"
                />
              ) : (
                <span className="flex-1 truncate text-left">{automationLabel}</span>
              )}
            </button>
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={(event) => beginAutomationRename(automation, event)}
                  disabled={isDeleting}
                  className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] disabled:opacity-30 group-hover/automation-row:opacity-100 focus-visible:opacity-100"
                  aria-label="Rename automation"
                >
                  <Pencil size={11} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setConfirmDeleteAutomation(automation)
                  }}
                  disabled={isDeleting}
                  className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] hover:text-red-500 disabled:opacity-30 group-hover/automation-row:opacity-100 focus-visible:opacity-100"
                  aria-label="Delete automation"
                >
                  <Trash2 size={11} />
                </button>
              </>
            ) : null}
          </div>
        )
      })}
    </div>
    <ConfirmDialog
      isOpen={confirmDeleteAutomation !== null}
      title="Delete automation?"
      description={confirmDeleteAutomation ? `"${confirmDeleteAutomation.name || confirmDeleteAutomation.title || 'Untitled automation'}" will be deleted. This can't be undone.` : undefined}
      confirmLabel="Delete"
      onConfirm={() => void performDeleteAutomation()}
      onCancel={() => setConfirmDeleteAutomation(null)}
    />
    </>
  )
}
