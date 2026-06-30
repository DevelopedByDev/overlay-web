'use client'

import type { ReactNode } from 'react'
import { Pause, Play, Workflow } from 'lucide-react'
import type {
  AutomationSaveState,
  AutomationSchedule,
  AutomationTestState,
  AutomationTimeZoneOption,
} from '@overlay/app-core'
import { MIN_AUTOMATION_INTERVAL_MINUTES, WEEKDAY_LABELS } from '@overlay/app-core/automations'
import { AutomationGraphCanvas } from './graph-canvas'

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
  const scheduleKindOptions: readonly AutomationSchedule['kind'][] = ['interval', 'daily', 'weekly', 'monthly']

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-subtle)] text-[var(--foreground)]">
                <Workflow size={16} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Automation editor</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Tune the saved instructions, schedule, timezone, and run a test.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEnabledChange(!enabled)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  enabled
                    ? 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--muted)]'
                }`}
              >
                {enabled ? <Play size={12} /> : <Pause size={12} />}
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

          <div className="mt-5 space-y-5">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Details</p>
              <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            <div className="space-y-3 border-t border-[var(--border)] pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Schedule</p>
              <div>
                <span className="block text-xs font-medium text-[var(--muted)]">Frequency</span>
                <div className="mt-1 inline-flex w-full rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-1">
                  {scheduleKindOptions.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => onScheduleKindChange(kind)}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
                        scheduleKind === kind
                          ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm'
                          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {kind}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {scheduleKind === 'interval' ? (
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Every N minutes
                    <input
                      type="number"
                      min={MIN_AUTOMATION_INTERVAL_MINUTES}
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

            <div className="space-y-3 border-t border-[var(--border)] pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Workflow</p>
              <div className="grid min-h-[30rem] gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1.1fr)]">
                <div className="min-w-0">
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
            </div>
          </div>
          {saveState === 'error' ? (
            <p className="mt-3 text-xs text-red-500">Could not save automation. Please try again.</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-subtle)] text-[var(--foreground)]">
                <Play size={16} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Test automation</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Runs this automation once now and writes the result into the automation chat.</p>
              </div>
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
