'use client'

import { useEffect, useMemo, useState } from 'react'
import { AutomationInstructionsEditor } from './AutomationInstructionsEditor'
import { DEFAULT_MODEL_ID } from '@/lib/model-types'
import { getModelsByIntelligence } from '@/lib/model-data'
import { overlayAppClient } from '@/lib/overlay-app-client'
import type {
  AutomationDetail,
  AutomationDetailTab,
  AutomationEditorDraft,
  AutomationSaveState,
  AutomationSchedule,
  AutomationTestState,
} from '@overlay/app-core'
import {
  applyAutomationUpdate,
  automationEditorDraftFromDetail,
  AUTOMATIONS_UPDATED_EVENT,
  buildAutomationUpdateRequest,
  normalizeAutomationDetailTab,
  supportedTimeZoneOptions,
} from '@overlay/app-core/automations'
import {
  AUTOMATION_DETAIL_TABS,
  AutomationEditorForm,
} from '@overlay/modules-react/automations'

export type {
  AutomationDetail,
  AutomationDetailTab,
  AutomationSchedule,
}
export { AUTOMATION_DETAIL_TABS, normalizeAutomationDetailTab }

export function AutomationEditorPanel({
  automation,
  onSaved,
  onTested,
  isFreeTier,
}: {
  automation: AutomationDetail
  onSaved: (automation: AutomationDetail) => void
  onTested: (conversationId: string) => void
  isFreeTier: boolean
}) {
  const [draft, setDraft] = useState<AutomationEditorDraft>(() => (
    automationEditorDraftFromDetail(automation, DEFAULT_MODEL_ID)
  ))
  const [saveState, setSaveState] = useState<AutomationSaveState>('idle')
  const [testState, setTestState] = useState<AutomationTestState>('idle')
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const timeZoneOptions = useMemo(() => supportedTimeZoneOptions(), [])
  const modelOptions = useMemo(
    () => getModelsByIntelligence(isFreeTier).filter((model) => model.id !== 'nvidia/nemotron-nano-9b-v2'),
    [isFreeTier],
  )

  useEffect(() => {
    setDraft(automationEditorDraftFromDetail(automation, DEFAULT_MODEL_ID))
    setSaveState('idle')
    setTestState('idle')
    setTestMessage(null)
  }, [automation])

  function updateDraft(patch: Partial<AutomationEditorDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  async function saveAutomation() {
    if (!draft.name.trim() || !draft.instructions.trim()) return
    setSaveState('saving')
    try {
      const request = buildAutomationUpdateRequest({ automation, draft })
      const res = await overlayAppClient.automations.updateResponse(request)
      if (!res.ok) throw new Error('Failed to save automation')
      const updated = applyAutomationUpdate(automation, request)
      setDraft((current) => ({ ...current, graphSource: request.graphSource ?? current.graphSource }))
      onSaved(updated)
      window.dispatchEvent(new Event(AUTOMATIONS_UPDATED_EVENT))
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 1500)
    } catch {
      setSaveState('error')
    }
  }

  async function testAutomation() {
    setTestState('running')
    setTestMessage(null)
    try {
      const res = await overlayAppClient.automations.testResponse({ automationId: automation._id })
      const data = await res.json().catch(() => ({})) as {
        conversationId?: string
        message?: string
        error?: string
      }
      if (!res.ok || !data.conversationId) {
        throw new Error(data.message || data.error || 'Failed to test automation')
      }
      setTestState('success')
      setTestMessage('Test run completed. Opening the automation chat.')
      onTested(data.conversationId)
    } catch (error) {
      setTestState('error')
      setTestMessage(error instanceof Error ? error.message : 'Failed to test automation')
    }
  }

  return (
    <AutomationEditorForm
      name={draft.name}
      description={draft.description}
      instructions={draft.instructions}
      enabled={draft.enabled}
      scheduleKind={draft.scheduleKind}
      intervalMinutes={draft.intervalMinutes}
      timezone={draft.timezone}
      time={draft.time}
      dayOfWeek={draft.dayOfWeek}
      dayOfMonth={draft.dayOfMonth}
      graphSource={draft.graphSource}
      modelId={draft.modelId}
      timeZoneOptions={timeZoneOptions}
      modelOptions={modelOptions}
      saveState={saveState}
      testState={testState}
      testMessage={testMessage}
      onNameChange={(name) => updateDraft({ name })}
      onDescriptionChange={(description) => updateDraft({ description })}
      onInstructionsChange={(instructions) => updateDraft({ instructions })}
      onEnabledChange={(enabled) => updateDraft({ enabled })}
      onScheduleKindChange={(scheduleKind) => updateDraft({ scheduleKind })}
      onIntervalMinutesChange={(intervalMinutes) => updateDraft({ intervalMinutes })}
      onTimezoneChange={(timezone) => updateDraft({ timezone })}
      onTimeChange={(time) => updateDraft({ time })}
      onDayOfWeekChange={(dayOfWeek) => updateDraft({ dayOfWeek })}
      onDayOfMonthChange={(dayOfMonth) => updateDraft({ dayOfMonth })}
      onGraphSourceChange={(graphSource) => updateDraft({ graphSource })}
      onModelIdChange={(modelId) => updateDraft({ modelId })}
      onSave={() => void saveAutomation()}
      onTest={() => void testAutomation()}
      renderInstructionsEditor={({ value, onChange }) => (
        <AutomationInstructionsEditor value={value} onChange={onChange} />
      )}
    />
  )
}
