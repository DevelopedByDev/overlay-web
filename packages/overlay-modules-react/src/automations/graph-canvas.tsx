'use client'

import { useState } from 'react'
import { AutomationFlowPreview, parseAutomationFlow } from './flow-utils'

export function AutomationGraphCanvas({
  source,
  onSourceChange,
}: {
  source: string
  onSourceChange: (source: string) => void
}) {
  const [showSource, setShowSource] = useState(false)
  const flow = parseAutomationFlow(source)

  return (
    <div className="relative min-h-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
      <div className={`grid h-full min-h-0 gap-4 ${showSource ? 'md:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.75fr)]' : ''}`}>
        <div className="min-h-0 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
          <div className="flex min-h-full items-center justify-center">
            {flow ? (
              <AutomationFlowPreview flow={flow} />
            ) : (
              <p className="max-w-md text-sm text-[var(--muted)]">
                Flowchart preview supports simple flowchart nodes and arrows. Open source to edit the workflow text.
              </p>
            )}
          </div>
        </div>
        {showSource ? (
          <div className="min-h-0 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Source</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Edit flowchart source. Save changes persists it.</p>
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
