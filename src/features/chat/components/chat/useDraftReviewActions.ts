'use client'

import { useCallback, useState } from 'react'
import { overlayAppClient } from '@/shared/app/overlay-app-client'
import type { DraftModalState } from '../chat-interface/types'

type SkillDraftSummary = Extract<DraftModalState, { kind: 'skill' }>['draft']
type AutomationDraftSummary = Extract<DraftModalState, { kind: 'automation' }>['draft']

export function useDraftReviewActions({
  activeChatId,
  embedProjectId,
  setComposerNotice,
}: {
  activeChatId: string | null
  embedProjectId: string | null
  setComposerNotice: (value: string | null | ((current: string | null) => string | null)) => void
}) {
  const [draftModalState, setDraftModalState] = useState<DraftModalState | null>(null)
  const [isDraftSaving, setIsDraftSaving] = useState(false)

  const saveSkillDraft = useCallback(async (draft: SkillDraftSummary) => {
    setIsDraftSaving(true)
    try {
      const res = await overlayAppClient.skills.createResponse({
        name: draft.name,
        description: draft.description,
        instructions: draft.instructions,
        enabled: true,
        ...(embedProjectId ? { projectId: embedProjectId } : {}),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to save skill draft')
      }
      setDraftModalState(null)
      setComposerNotice('Skill saved. It will now be available in chat.')
      window.setTimeout(() => setComposerNotice(null), 5000)
    } catch (error) {
      setComposerNotice(error instanceof Error ? error.message : 'Failed to save skill.')
      window.setTimeout(() => setComposerNotice(null), 6000)
    } finally {
      setIsDraftSaving(false)
    }
  }, [embedProjectId, setComposerNotice])

  const saveAutomationDraft = useCallback(async (draft: AutomationDraftSummary) => {
    setIsDraftSaving(true)
    try {
      const res = await overlayAppClient.automations.createResponse({
        name: draft.name,
        description: draft.description,
        instructions: draft.instructions,
        schedule: draft.schedule,
        timezone: draft.timezone,
        graphSource: draft.graphSource,
        enabled: true,
        ...(activeChatId ? { sourceConversationId: activeChatId } : {}),
        ...(embedProjectId ? { projectId: embedProjectId } : {}),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to create automation')
      }
      setDraftModalState(null)
      window.dispatchEvent(new Event('overlay:automations-updated'))
      setComposerNotice('Automation created. It will run on its saved schedule.')
      window.setTimeout(() => setComposerNotice(null), 5000)
    } catch (error) {
      setComposerNotice(error instanceof Error ? error.message : 'Failed to create automation.')
      window.setTimeout(() => setComposerNotice(null), 6000)
    } finally {
      setIsDraftSaving(false)
    }
  }, [activeChatId, embedProjectId, setComposerNotice])

  return {
    draftModalState,
    isDraftSaving,
    saveAutomationDraft,
    saveSkillDraft,
    setDraftModalState,
  }
}
