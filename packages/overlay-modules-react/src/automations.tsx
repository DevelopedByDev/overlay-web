'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2, MessageSquare, Pencil, Play, SlidersHorizontal, Trash2, Workflow } from 'lucide-react'
import type {
  AutomationDetailTab,
  AutomationSaveState,
  AutomationSchedule,
  AutomationSummary,
  AutomationTestState,
  AutomationTimeZoneOption,
} from '@overlay/app-core'
import {
  automationHref,
  automationStatus,
  getAutomationConversationId,
  getAutomationDisplayName,
  WEEKDAY_LABELS,
} from '@overlay/app-core/automations'

export const AUTOMATION_DETAIL_TABS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'edit', label: 'Edit', icon: SlidersHorizontal },
] satisfies Array<{ id: AutomationDetailTab; label: string; icon: typeof MessageSquare }>

const inlineConfirmDeleteButtonClass =
  'inline-flex h-5 shrink-0 items-center rounded-full bg-red-500/15 px-2 text-[11px] font-medium leading-none text-red-500 transition-colors hover:bg-red-500/25'

export interface AutomationsInlineListProps {
  automations: readonly AutomationSummary[]
  activeId?: string | null
  activeAutomationId?: string | null
  editingAutomationId?: string | null
  editingAutomationName: string
  pendingDeleteAutomationId?: string | null
  deletingAutomationIds?: readonly string[]
  pendingNavId?: string | null
  onNavigateAutomation: (automation: AutomationSummary, href: string) => void
  onBeginRename: (automation: AutomationSummary, event: React.MouseEvent) => void
  onEditingNameChange: (name: string) => void
  onCommitRename: (automation: AutomationSummary) => void
  onCancelRename: () => void
  onRequestDelete: (automation: AutomationSummary, event: React.MouseEvent) => void
  onConfirmDelete: (automation: AutomationSummary, event: React.MouseEvent) => void
  onClearPendingDelete: () => void
}

export function AutomationsInlineList({
  automations,
  activeId,
  activeAutomationId,
  editingAutomationId,
  editingAutomationName,
  pendingDeleteAutomationId,
  deletingAutomationIds = [],
  pendingNavId,
  onNavigateAutomation,
  onBeginRename,
  onEditingNameChange,
  onCommitRename,
  onCancelRename,
  onRequestDelete,
  onConfirmDelete,
  onClearPendingDelete,
}: AutomationsInlineListProps) {
  if (automations.length === 0) {
    return <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">No automations yet</p>
  }

  return (
    <div className="space-y-0.5">
      {automations.map((automation) => {
        const status = automationStatus(automation)
        const iconColor = status.tone === 'error'
          ? 'text-red-500'
          : status.tone === 'enabled'
            ? 'text-green-500'
            : 'text-[var(--muted-light)]'
        const conversationId = getAutomationConversationId(automation)
        const automationLabel = getAutomationDisplayName(automation)
        const isActive = activeAutomationId === automation._id || activeId === automation._id || activeId === conversationId
        const isEditing = editingAutomationId === automation._id
        const isDeleting = deletingAutomationIds.includes(automation._id)
        const isConfirmingDelete = pendingDeleteAutomationId === automation._id
        const href = automationHref(automation)
        return (
          <div
            key={automation._id}
            title={automation.lastError || status.label}
            onMouseLeave={() => {
              if (isConfirmingDelete) onClearPendingDelete()
            }}
            className={`group/automation-row flex h-7 w-full items-center gap-1 rounded-md px-2 py-0 text-xs transition-colors ${
              isActive
                ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
            }`}
          >
            <button
              type="button"
              disabled={isDeleting || pendingNavId === automation._id}
              onClick={() => {
                if (isEditing) return
                onNavigateAutomation(automation, href)
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
                  onChange={(event) => onEditingNameChange(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      onCommitRename(automation)
                    } else if (event.key === 'Escape') {
                      event.preventDefault()
                      onCancelRename()
                    }
                  }}
                  onBlur={() => onCommitRename(automation)}
                  className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[11px] text-[var(--foreground)] outline-none"
                />
              ) : (
                <span className="flex-1 truncate text-left">{automationLabel}</span>
              )}
            </button>
            {!isEditing ? (
              <>
                {isConfirmingDelete ? (
                  <button
                    type="button"
                    onClick={(event) => onConfirmDelete(automation, event)}
                    disabled={isDeleting}
                    className={`${inlineConfirmDeleteButtonClass} disabled:opacity-30`}
                    aria-label="Confirm delete automation"
                  >
                    Confirm
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={(event) => onBeginRename(automation, event)}
                      disabled={isDeleting}
                      className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] disabled:opacity-30 group-hover/automation-row:opacity-100 focus-visible:opacity-100"
                      aria-label="Rename automation"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => onRequestDelete(automation, event)}
                      disabled={isDeleting}
                      className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] hover:text-red-500 disabled:opacity-30 group-hover/automation-row:opacity-100 focus-visible:opacity-100"
                      aria-label="Delete automation"
                    >
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export interface AutomationModelOption {
  id: string
  name: string
}

export interface AutomationEditorFormProps {
  name: string
  description: string
  instructions: string
  enabled: boolean
  scheduleKind: AutomationSchedule['kind']
  intervalMinutes: number
  timezone: string
  time: string
  dayOfWeek: number
  dayOfMonth: number
  graphSource: string
  modelId: string
  timeZoneOptions: readonly AutomationTimeZoneOption[]
  modelOptions: readonly AutomationModelOption[]
  saveState: AutomationSaveState
  testState: AutomationTestState
  testMessage?: string | null
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onInstructionsChange: (value: string) => void
  onEnabledChange: (value: boolean) => void
  onScheduleKindChange: (value: AutomationSchedule['kind']) => void
  onIntervalMinutesChange: (value: number) => void
  onTimezoneChange: (value: string) => void
  onTimeChange: (value: string) => void
  onDayOfWeekChange: (value: number) => void
  onDayOfMonthChange: (value: number) => void
  onGraphSourceChange: (value: string) => void
  onModelIdChange: (value: string) => void
  onSave: () => void
  onTest: () => void
  renderInstructionsEditor: (props: { value: string; onChange: (value: string) => void }) => ReactNode
}

export function AutomationEditorForm({
  name,
  description,
  instructions,
  enabled,
  scheduleKind,
  intervalMinutes,
  timezone,
  time,
  dayOfWeek,
  dayOfMonth,
  graphSource,
  modelId,
  timeZoneOptions,
  modelOptions,
  saveState,
  testState,
  testMessage,
  onNameChange,
  onDescriptionChange,
  onInstructionsChange,
  onEnabledChange,
  onScheduleKindChange,
  onIntervalMinutesChange,
  onTimezoneChange,
  onTimeChange,
  onDayOfWeekChange,
  onDayOfMonthChange,
  onGraphSourceChange,
  onModelIdChange,
  onSave,
  onTest,
  renderInstructionsEditor,
}: AutomationEditorFormProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Automation editor</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Tune the saved instructions, schedule, timezone, and run a test.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEnabledChange(!enabled)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  enabled
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-[var(--surface-subtle)] text-[var(--muted)]'
                }`}
              >
                {enabled ? 'Enabled' : 'Paused'}
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saveState === 'saving' || !name.trim() || !instructions.trim()}
                className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save changes'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid min-h-[34rem] gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1.1fr)]">
            <div className="min-w-0 space-y-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
                <div className="space-y-4">
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Name
                    <input
                      value={name}
                      onChange={(event) => onNameChange(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)]"
                    />
                  </label>
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Description
                    <input
                      value={description}
                      onChange={(event) => onDescriptionChange(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)]"
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Frequency
                    <select
                      value={scheduleKind}
                      onChange={(event) => onScheduleKindChange(event.target.value as AutomationSchedule['kind'])}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-12 text-sm text-[var(--foreground)] outline-none"
                    >
                      <option value="interval">Interval</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </label>
                  {scheduleKind === 'interval' ? (
                    <label className="block text-xs font-medium text-[var(--muted)]">
                      Every N minutes
                      <input
                        type="number"
                        min={1}
                        value={intervalMinutes}
                        onChange={(event) => onIntervalMinutesChange(Number(event.target.value))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none"
                      />
                    </label>
                  ) : (
                    <label className="block text-xs font-medium text-[var(--muted)]">
                      Time
                      <input
                        type="time"
                        value={time}
                        onChange={(event) => onTimeChange(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-8 text-sm text-[var(--foreground)] outline-none"
                      />
                    </label>
                  )}
                  {scheduleKind === 'weekly' && (
                    <label className="block text-xs font-medium text-[var(--muted)]">
                      Day of week
                      <select
                        value={dayOfWeek}
                        onChange={(event) => onDayOfWeekChange(Number(event.target.value))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-12 text-sm text-[var(--foreground)] outline-none"
                      >
                        {WEEKDAY_LABELS.map((day, index) => (
                          <option key={day} value={index}>{day}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {scheduleKind === 'monthly' && (
                    <label className="block text-xs font-medium text-[var(--muted)]">
                      Day of month
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={dayOfMonth}
                        onChange={(event) => onDayOfMonthChange(Number(event.target.value))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-8 text-sm text-[var(--foreground)] outline-none"
                      />
                    </label>
                  )}
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Time zone
                    <select
                      value={timezone}
                      onChange={(event) => onTimezoneChange(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-12 text-sm text-[var(--foreground)] outline-none"
                    >
                      {timeZoneOptions.map((zone) => (
                        <option key={zone.value} value={zone.value}>{zone.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Model
                    <select
                      value={modelId}
                      onChange={(event) => onModelIdChange(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-12 text-sm text-[var(--foreground)] outline-none"
                    >
                      {modelOptions.map((model) => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <label className="block text-xs font-medium text-[var(--muted)]">
                Instructions
                {renderInstructionsEditor({ value: instructions, onChange: onInstructionsChange })}
              </label>
            </div>
            <AutomationGraphCanvas
              source={graphSource}
              onSourceChange={onGraphSourceChange}
            />
          </div>
          {saveState === 'error' ? (
            <p className="mt-3 text-xs text-red-500">Could not save automation. Please try again.</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Test automation</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Runs this automation once now and writes the result into the automation chat.</p>
            </div>
            <button
              type="button"
              onClick={onTest}
              disabled={testState === 'running' || !instructions.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
            >
              <Play size={12} />
              {testState === 'running' ? 'Running...' : 'Test Automation'}
            </button>
          </div>
          {testMessage ? (
            <p className={`mt-3 text-xs ${testState === 'error' ? 'text-red-500' : 'text-[var(--muted)]'}`}>
              {testMessage}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function AutomationGraphCanvas({
  source,
  onSourceChange,
}: {
  source: string
  onSourceChange: (source: string) => void
}) {
  const renderIdRef = useRef(`automation-graph-${Math.random().toString(36).slice(2)}`)
  const [svg, setSvg] = useState('')
  const [renderError, setRenderError] = useState<string | null>(null)
  const [showSource, setShowSource] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function renderGraph() {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: {
            fontFamily: 'Inter, ui-sans-serif, system-ui',
            primaryColor: '#f4f4f5',
            primaryTextColor: '#18181b',
            primaryBorderColor: '#d4d4d8',
            lineColor: '#71717a',
          },
        })
        const result = await mermaid.render(`${renderIdRef.current}-${Date.now()}`, source)
        if (!cancelled) {
          setSvg(result.svg)
          setRenderError(null)
        }
      } catch (error) {
        if (!cancelled) {
          setSvg('')
          setRenderError(error instanceof Error ? error.message : 'Could not render Mermaid graph')
        }
      }
    }
    void renderGraph()
    return () => {
      cancelled = true
    }
  }, [source])

  return (
    <div className="relative min-h-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
      <div className={`grid h-full min-h-0 gap-4 ${showSource ? 'md:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.75fr)]' : ''}`}>
        <div className="min-h-0 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
          <div className="flex min-h-full items-center justify-center">
            {renderError ? (
              <p className="max-w-md text-sm text-red-500">{renderError}</p>
            ) : svg ? (
              <div
                className="max-w-full overflow-auto text-[var(--foreground)]"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <p className="text-sm text-[var(--muted)]">Rendering graph...</p>
            )}
          </div>
        </div>
        {showSource ? (
          <div className="min-h-0 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Source</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Edit Mermaid source. Save changes persists it.</p>
              </div>
            </div>
            <textarea
              value={source}
              onChange={(event) => onSourceChange(event.target.value)}
              spellCheck={false}
              className="h-[calc(100%-4.5rem)] min-h-[20rem] w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 font-mono text-xs leading-6 text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)]"
            />
          </div>
        ) : null}
      </div>
      <label className="absolute bottom-5 right-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--foreground)] shadow-sm">
        <input
          type="checkbox"
          checked={showSource}
          onChange={(event) => setShowSource(event.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--foreground)]"
        />
        Source
      </label>
    </div>
  )
}
