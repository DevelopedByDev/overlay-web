import type { StepResult, ToolSet } from 'ai'
import { normalizeAgentAssistantText } from '@/lib/agent-assistant-text'

/**
 * Persist multi-step assistant turns: `onFinish`'s top-level `text` is only the **last** step,
 * so we merge every step's text and synthesize legacy `tool-invocation` parts for the transcript UI.
 */
export function buildAssistantPersistenceFromSteps<TOOLS extends ToolSet>(
  steps: StepResult<TOOLS>[] | undefined,
  fallbackText: string,
): { content: string; parts: Array<Record<string, unknown>> } {
  const list = steps ?? []
  const textSegments = list
    .map((step) => step.text?.trim())
    .filter(Boolean)
    .map((t) => normalizeAgentAssistantText(t!))
  const content = textSegments.join('\n\n') || normalizeAgentAssistantText(fallbackText.trim())

  const parts: Array<Record<string, unknown>> = []
  for (const step of list) {
    const calls = step.toolCalls ?? []
    for (const tc of calls) {
      parts.push({
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          state: 'output-available',
        },
      })
    }
    if (step.text?.trim()) {
      parts.push({ type: 'text', text: normalizeAgentAssistantText(step.text.trim()) })
    }
  }
  if (parts.length === 0 && content) {
    parts.push({ type: 'text', text: content })
  }
  return { content, parts }
}
