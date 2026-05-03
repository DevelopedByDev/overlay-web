/** Shared types for POST /api/app/notebook-agent and the Notes editor client. */

export interface NotebookEdit {
  id: string
  description: string
  startLine: number
  endLine: number
  originalLines: string[]
  newLines: string[]
}

export type NotebookAgentStreamEvent =
  | { type: 'thinking'; thinking?: string }
  | { type: 'tool_call'; tool?: string; toolInput?: Record<string, unknown> }
  | { type: 'edit_proposal'; edit?: NotebookEdit }
  | { type: 'text'; text?: string }
  | { type: 'done' }
  | { type: 'error'; error?: string }
