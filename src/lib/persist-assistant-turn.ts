import type { StepResult, ToolSet } from 'ai'
import { normalizeAgentAssistantText } from '@/lib/agent-assistant-text'
import { summarizeToolResultForTranscript } from '@/lib/tool-result-summary'

/** Persisted when the model produced no text/tool transcript so reload never drops the assistant row. */
export const ASSISTANT_EMPTY_CONTENT_PLACEHOLDER = '[Empty response]'

export function ensureAssistantPersistContent(content: string): string {
  return content.trim() ? content : ASSISTANT_EMPTY_CONTENT_PLACEHOLDER
}

const MAX_PERSISTED_ASSISTANT_CONTENT_CHARS = 160_000
const MAX_PERSISTED_TEXT_PART_CHARS = 80_000
const MAX_PERSISTED_REASONING_PART_CHARS = 24_000
const MAX_PERSISTED_TOOL_VALUE_CHARS = 4_000
const MAX_PERSISTED_PART_TEXT_TOTAL_CHARS = 180_000
const MAX_PERSISTED_ASSISTANT_PARTS = 80

function truncateForPersistence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars).trimEnd()}\n\n[truncated ${text.length - maxChars} chars for storage]`
}

function stringifyForPersistence(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function compactToolValueForPersistence(value: unknown): unknown {
  if (value == null) return value
  if (typeof value === 'string') return truncateForPersistence(value, MAX_PERSISTED_TOOL_VALUE_CHARS)
  if (typeof value === 'number' || typeof value === 'boolean') return value

  const serialized = stringifyForPersistence(value)
  if (serialized.length <= MAX_PERSISTED_TOOL_VALUE_CHARS) {
    return clampNestingDepth(value)
  }
  return {
    truncated: true,
    summary: truncateForPersistence(serialized, MAX_PERSISTED_TOOL_VALUE_CHARS),
  }
}

/**
 * Convex documents may not exceed 16 levels of nesting. Tool outputs (e.g. Notion API
 * responses) can easily exceed this. This helper truncates any object/array that is
 * deeper than `maxDepth` levels, replacing it with a sentinel string so the content
 * is still readable but safe to store.
 */
function clampNestingDepth(value: unknown, maxDepth = 10, currentDepth = 0): unknown {
  if (currentDepth >= maxDepth) {
    if (value === null || value === undefined) return value
    if (typeof value !== 'object') return value
    return '[truncated: too deeply nested]'
  }
  if (Array.isArray(value)) {
    return value.map((item) => clampNestingDepth(item, maxDepth, currentDepth + 1))
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value as object)) {
      result[key] = clampNestingDepth((value as Record<string, unknown>)[key], maxDepth, currentDepth + 1)
    }
    return result
  }
  return value
}

export function compactAssistantPersistenceForConvex(input: {
  content: string
  parts: Array<Record<string, unknown>>
}): { content: string; parts: Array<Record<string, unknown>> } {
  const content = truncateForPersistence(input.content, MAX_PERSISTED_ASSISTANT_CONTENT_CHARS)
  const parts: Array<Record<string, unknown>> = []
  let remainingPartTextChars = MAX_PERSISTED_PART_TEXT_TOTAL_CHARS

  for (const part of input.parts) {
    if (parts.length >= MAX_PERSISTED_ASSISTANT_PARTS) break

    if (part.type === 'text') {
      const text = typeof part.text === 'string' ? part.text : ''
      const max = Math.min(MAX_PERSISTED_TEXT_PART_CHARS, Math.max(0, remainingPartTextChars))
      if (!max) continue
      const nextText = truncateForPersistence(text, max)
      remainingPartTextChars -= Math.min(text.length, max)
      parts.push({ ...part, text: nextText })
      continue
    }

    if (part.type === 'reasoning') {
      const text = typeof part.text === 'string' ? part.text : ''
      const max = Math.min(MAX_PERSISTED_REASONING_PART_CHARS, Math.max(0, remainingPartTextChars))
      if (!max) continue
      const nextText = truncateForPersistence(text, max)
      remainingPartTextChars -= Math.min(text.length, max)
      parts.push({ ...part, text: nextText, state: part.state ?? 'done' })
      continue
    }

    if (part.type === 'tool-invocation') {
      const invocation = part.toolInvocation && typeof part.toolInvocation === 'object'
        ? (part.toolInvocation as Record<string, unknown>)
        : {}
      parts.push({
        ...part,
        toolInvocation: {
          ...invocation,
          toolInput: compactToolValueForPersistence(invocation.toolInput),
          toolOutput: compactToolValueForPersistence(invocation.toolOutput),
        },
      })
      continue
    }

    parts.push(clampNestingDepth(part) as Record<string, unknown>)
  }

  if (input.parts.length > parts.length) {
    parts.push({
      type: 'text',
      text: `[${input.parts.length - parts.length} additional assistant parts omitted for storage]`,
    })
  }

  return {
    content,
    parts: parts.length > 0 ? parts : [{ type: 'text', text: content }],
  }
}

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
  let content = textSegments.join('\n\n') || synthesizedToolSegments.join('\n\n') || fallback
  content = ensureAssistantPersistContent(content)

  const parts: Array<Record<string, unknown>> = []
  for (const step of list) {
    let reasoningText = ''
    if (step.reasoningText?.trim()) {
      reasoningText = step.reasoningText.trim()
    } else if (step.reasoning?.length) {
      reasoningText = step.reasoning
        .map((r) => (r && typeof r === 'object' && 'text' in r ? String((r as { text?: string }).text ?? '') : ''))
        .map((s) => s.trim())
        .filter(Boolean)
        .join('\n\n')
    }
    if (reasoningText) {
      parts.push({
        type: 'reasoning',
        text: normalizeAgentAssistantText(reasoningText),
        state: 'done',
      })
    }

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
          toolInput: clampNestingDepth(tc.input),
          toolOutput: clampNestingDepth(result?.output),
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
  if (parts.length === 0) {
    parts.push({ type: 'text', text: content })
  }

  // Fix word-split artifact: some reasoning models emit the first word(s) of the
  // response as thinking tokens (e.g. reasoningText="I don", text="'t have...").
  // Detect when a text part starts with an apostrophe continuation and move the
  // trailing word from the preceding reasoning part into the text part.
  for (let i = 0; i < parts.length - 1; i++) {
    const rPart = parts[i]
    const tPart = parts[i + 1]
    if (
      rPart?.type === 'reasoning' &&
      tPart?.type === 'text' &&
      typeof rPart.text === 'string' &&
      typeof tPart.text === 'string' &&
      /^'[a-zA-Z]/.test(tPart.text as string)
    ) {
      const rText = rPart.text as string
      const tText = tPart.text as string
      const lastWordMatch = rText.match(/(\S+)$/)
      if (lastWordMatch) {
        const word = lastWordMatch[1]!
        rPart.text = rText.slice(0, rText.length - word.length).trim()
        tPart.text = word + tText
      }
    }
  }

  return { content, parts }
}
