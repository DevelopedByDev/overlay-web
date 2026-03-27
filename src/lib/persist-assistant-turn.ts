import type { StepResult, ToolSet } from 'ai'
import { normalizeAgentAssistantText } from '@/lib/agent-assistant-text'
import { summarizeToolResultForTranscript } from '@/lib/tool-result-summary'

/**
 * Persist multi-step assistant turns: `onFinish`'s top-level `text` is only the **last** step,
 * so we merge every step's text and synthesize legacy `tool-invocation` parts for the transcript UI.
 */
export function buildAssistantPersistenceFromSteps<TOOLS extends ToolSet>(
  steps: StepResult<TOOLS>[] | undefined,
  fallbackText: string,
): { content: string; parts: Array<Record<string, unknown>> } {
  const list = steps ?? []
  const textSegments: string[] = []
  const synthesizedToolSegments: string[] = []
  for (const step of list) {
    const trimmedText = step.text?.trim()
    if (trimmedText) {
      textSegments.push(normalizeAgentAssistantText(trimmedText))
    }
    const toolResultsById = new Map(
      (step.toolResults ?? []).map((result) => [result.toolCallId, result] as const),
    )
    for (const tc of step.toolCalls ?? []) {
      const result = toolResultsById.get(tc.toolCallId)
      const summary = summarizeToolResultForTranscript({
        toolName: tc.toolName,
        toolInput: tc.input,
        toolOutput: result?.output,
        state: result ? 'output-available' : 'input-available',
      })
      if (summary) synthesizedToolSegments.push(summary)
    }
  }
  const fallback = normalizeAgentAssistantText(fallbackText.trim())
  const content = textSegments.join('\n\n') || synthesizedToolSegments.join('\n\n') || fallback

  const parts: Array<Record<string, unknown>> = []
  for (const step of list) {
    const toolResultsById = new Map(
      (step.toolResults ?? []).map((result) => [result.toolCallId, result] as const),
    )
    const calls = step.toolCalls ?? []
    for (const tc of calls) {
      const result = toolResultsById.get(tc.toolCallId)
      parts.push({
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          state: result ? 'output-available' : 'input-available',
          toolInput: tc.input,
          toolOutput: result?.output,
        },
      })
    }
    if (step.text?.trim()) {
      parts.push({ type: 'text', text: normalizeAgentAssistantText(step.text.trim()) })
    }
  }
  if (!parts.some((part) => part.type === 'text') && content) {
    parts.push({ type: 'text', text: content })
  }
  if (parts.length === 0 && content) {
    parts.push({ type: 'text', text: content })
  }
  return { content, parts }
}
