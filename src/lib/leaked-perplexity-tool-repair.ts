import type { StepResult, ToolSet } from 'ai'
import { FREE_TIER_AUTO_MODEL_ID } from '@/lib/models'
import { normalizeAgentAssistantText } from '@/lib/agent-assistant-text'
import { runPerplexitySearchDirectForRepair } from '@/lib/ai-gateway'
import { ensureAssistantPersistContent } from '@/lib/persist-assistant-turn'
import { summarizeErrorForLog } from '@/lib/safe-log'

function stepsHavePerplexitySearchWithOutput(
  steps: StepResult<ToolSet>[] | undefined,
): boolean {
  if (!steps?.length) return false
  for (const step of steps) {
    const byId = new Map((step.toolResults ?? []).map((r) => [r.toolCallId, r]))
    for (const tc of step.toolCalls ?? []) {
      if (tc.toolName !== 'perplexity_search') continue
      const r = byId.get(tc.toolCallId)
      if (r && r.output !== undefined && r.output !== null) return true
    }
  }
  return false
}

/** Strip bogus prefixes/suffixes weak models append to fake tool JSON. */
export function normalizeLeakedToolCallBlob(text: string): string {
  let t = text.trim()
  // Repeat: truncated blobs often end with `...20OLCALL>` after broken JSON.
  for (let i = 0; i < 4; i++) {
    const before = t
    t = t.replace(/^(?:OLCALL|TOOLCALL|TOOL_CALL)[>\s]*/i, '').trim()
    t = t.replace(/(?:OLCALL|TOOLCALL|TOOL_CALL)[>\s]*$/i, '').trim()
    if (t === before) break
  }
  return t
}

function looksLikeLeakedPerplexityToolSyntax(text: string): boolean {
  const t = text
  if (!t.trim()) return false
  return (
    /OLCALL|TOOLCALL|TOOL_CALL/i.test(t) ||
    /\{\s*"name"\s*:\s*"perplexity_search"/i.test(t) ||
    /\[\s*\{\s*"name"\s*:\s*"perplexity_search"/i.test(t) ||
    /"name"\s*:\s*"perplexity_search"/i.test(t)
  )
}

/** Extract `[...]` starting at `start` with string-aware bracket matching. */
function extractBalancedJsonArray(source: string, start: number): string | null {
  if (source[start] !== '[') return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < source.length; i++) {
    const c = source[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (c === '\\') {
        escape = true
        continue
      }
      if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return null
}

function normalizeQueryField(value: unknown): string | string[] | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const qs = value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    if (qs.length > 0) return qs.length === 1 ? qs[0]! : qs
  }
  return null
}

function readPerplexityQueryFromToolLikeObject(obj: unknown): string | string[] | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (o.name !== 'perplexity_search') return null
  const rawArgs = o.arguments ?? o.parameters
  if (typeof rawArgs === 'string' && rawArgs.trim()) {
    try {
      const inner = JSON.parse(rawArgs) as { query?: unknown }
      return normalizeQueryField(inner?.query)
    } catch {
      return null
    }
  }
  if (rawArgs && typeof rawArgs === 'object') {
    return normalizeQueryField((rawArgs as { query?: unknown }).query)
  }
  return null
}

/** Decode the inside of a JSON string (handles \\" and \\\\) — safe fallback when full JSON is broken. */
function decodeJsonStringContent(raw: string): string {
  try {
    const wrapped = '"' + raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
    return JSON.parse(wrapped) as string
  } catch {
    return raw
  }
}

/**
 * When the model prints truncated or invalid JSON (e.g. ends with `...20OLCALL>`), full parse fails
 * but `"query": "…"` is often complete. Pull that out first.
 */
function extractQueryViaRegex(text: string): string | string[] | null {
  // String form: "query": "search terms"
  const stringRe = /"query"\s*:\s*"((?:[^"\\]|\\.)*)"/g
  const stringMatches: string[] = []
  let m: RegExpExecArray | null
  while ((m = stringRe.exec(text)) !== null) {
    const decoded = decodeJsonStringContent(m[1] ?? '')
    if (decoded.trim()) stringMatches.push(decoded.trim())
  }
  if (stringMatches.length === 1) return stringMatches[0]!
  if (stringMatches.length > 1) return stringMatches

  // Array form: "query": ["a", "b"]
  const arrayMatch = /"query"\s*:\s*\[([\s\S]*?)\]/.exec(text)
  if (arrayMatch?.[1]) {
    const inner = arrayMatch[1]
    const parts = [...inner.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
      .map((x) => decodeJsonStringContent(x[1] ?? '').trim())
      .filter(Boolean)
    if (parts.length === 1) return parts[0]!
    if (parts.length > 1) return parts
  }

  return null
}

/**
 * Parses leaked assistant text that contains JSON for `perplexity_search` instead of a real tool call.
 */
export function extractPerplexityQueryFromLeakedAssistantText(text: string): string | string[] | null {
  const searchIn = normalizeLeakedToolCallBlob(text)

  // 1) Regex first — works on truncated / garbage-suffixed blobs where JSON.parse fails.
  const fromRegex = extractQueryViaRegex(searchIn)
  if (fromRegex) return fromRegex

  const bracketStart = searchIn.indexOf('[')
  if (bracketStart >= 0) {
    const slice = extractBalancedJsonArray(searchIn, bracketStart)
    if (slice) {
      try {
        const parsed = JSON.parse(slice) as unknown
        if (Array.isArray(parsed) && parsed[0]) {
          const q = readPerplexityQueryFromToolLikeObject(parsed[0])
          if (q) return q
        }
      } catch {
        // fall through
      }
    }
    // Unclosed `[` — try regex on the substring from `[` to end
    const tail = searchIn.slice(bracketStart)
    const fromPartial = extractQueryViaRegex(tail)
    if (fromPartial) return fromPartial
  }

  const braceStart = searchIn.indexOf('{')
  if (braceStart >= 0) {
    for (let end = braceStart + 1; end <= searchIn.length; end++) {
      const chunk = searchIn.slice(braceStart, end)
      if (!chunk.endsWith('}')) continue
      try {
        const parsed = JSON.parse(chunk) as unknown
        const q = readPerplexityQueryFromToolLikeObject(parsed)
        if (q) return q
      } catch {
        continue
      }
    }
    const fromBraceRegex = extractQueryViaRegex(searchIn.slice(braceStart))
    if (fromBraceRegex) return fromBraceRegex
  }

  return null
}

function formatPerplexityToolOutputForAssistantText(out: unknown): string {
  if (typeof out === 'string') return out.trim()
  if (out && typeof out === 'object') {
    const o = out as Record<string, unknown>
    const direct =
      o.answer ?? o.text ?? o.content ?? o.summary ?? o.response
    if (typeof direct === 'string' && direct.trim()) return direct.trim()
    const results = o.results
    if (Array.isArray(results) && results.length > 0) {
      const lines = results.map((r, i) => {
        if (r && typeof r === 'object') {
          const e = r as Record<string, unknown>
          const title = typeof e.title === 'string' ? e.title : ''
          const url = typeof e.url === 'string' ? e.url : ''
          const snippet = typeof e.snippet === 'string' ? e.snippet : ''
          const head = title || url || `Source ${i + 1}`
          const body = [snippet, url].filter(Boolean).join('\n')
          return body ? `${head}\n${body}` : head
        }
        return String(r)
      })
      return lines.join('\n\n')
    }
  }
  try {
    const s = JSON.stringify(out, null, 2)
    return s.length > 16_000 ? `${s.slice(0, 16_000)}\n…` : s
  } catch {
    return String(out)
  }
}

export async function maybeRepairFreeTierLeakedPerplexityText(params: {
  modelId: string
  steps: StepResult<ToolSet>[] | undefined
  text: string
  accessToken: string | undefined
}): Promise<string | null> {
  const { modelId, steps, text, accessToken } = params
  if (modelId !== FREE_TIER_AUTO_MODEL_ID) return null
  if (stepsHavePerplexitySearchWithOutput(steps)) return null
  if (!looksLikeLeakedPerplexityToolSyntax(text)) return null

  const query = extractPerplexityQueryFromLeakedAssistantText(text)
  if (!query) {
    console.warn('[leaked-perplexity-tool-repair] Leaked syntax detected but could not parse query')
    return null
  }

  try {
    const raw = await runPerplexitySearchDirectForRepair(accessToken, query)
    const body = formatPerplexityToolOutputForAssistantText(raw)
    const header =
      typeof query === 'string'
        ? `**Web search** (${query})\n\n`
        : `**Web search** (${query.join(' · ')})\n\n`
    const combined = normalizeAgentAssistantText(header + body)
    const out = ensureAssistantPersistContent(combined)
    console.log('[leaked-perplexity-tool-repair] Repaired leaked perplexity_search JSON with direct Gateway search')
    return out
  } catch (err) {
    console.error('[leaked-perplexity-tool-repair] Direct repair failed:', summarizeErrorForLog(err))
    return null
  }
}
