'use client'

import { useState } from 'react'
import { Code2, GitBranch } from 'lucide-react'
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
              <div className="flex max-w-md flex-col items-center gap-2 text-center">
                <GitBranch size={18} strokeWidth={1.75} className="text-[var(--muted)]" />
                <p className="text-sm text-[var(--muted)]">
                  Flowchart preview supports simple flowchart nodes and arrows. Switch to Source to edit the workflow text.
                </p>
              </div>
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
              <span className="rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--muted)]">mmd</span>
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
      <div className="absolute bottom-5 right-5 inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] p-1 text-xs font-medium shadow-sm">
        <button
          type="button"
          onClick={() => setShowSource(false)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
            !showSource ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          <GitBranch size={12} />
          Preview
        </button>
        <button
          type="button"
          onClick={() => setShowSource(true)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
            showSource ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          <Code2 size={12} />
          Source
        </button>
      </div>
    </div>
  )
}
