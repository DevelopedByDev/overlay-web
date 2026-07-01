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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted)]">
          {showSource ? 'Edit the flowchart source below.' : 'Visual overview of the workflow steps.'}
        </p>
        <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setShowSource(false)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
              !showSource ? 'bg-[var(--surface-elevated)] text-[var(--foreground)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <GitBranch size={12} />
            Preview
          </button>
          <button
            type="button"
            onClick={() => setShowSource(true)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
              showSource ? 'bg-[var(--surface-elevated)] text-[var(--foreground)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Code2 size={12} />
            Source
          </button>
        </div>
      </div>
      {showSource ? (
        <textarea
          value={source}
          onChange={(event) => onSourceChange(event.target.value)}
          spellCheck={false}
          className="h-80 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-xs leading-6 text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)]"
        />
      ) : (
        <div className="min-h-80 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <div className="flex min-h-72 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            {flow ? (
              <AutomationFlowPreview flow={flow} />
            ) : (
              <div className="flex max-w-md flex-col items-center gap-2 text-center">
                <GitBranch size={18} strokeWidth={1.75} className="text-[var(--muted)]" />
                <p className="text-sm text-[var(--muted)]">
                  Add a flowchart in the Source tab to see a visual preview here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
