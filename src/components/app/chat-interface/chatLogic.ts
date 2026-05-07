import type { UIMessage } from 'ai'
import { getToolName, isReasoningUIPart, isToolUIPart } from 'ai'
import type { AutomationDraftSummary } from '@/lib/automation-drafts'
import type { SkillDraftSummary } from '@/lib/skill-drafts'
import type { WebSourceItem } from '@/lib/web-sources'
import { safeHttpUrl } from '@/lib/safe-url'
import {
  normalizeAgentAssistantText,
  redactOpaqueNotebookFileIdsInVisibleText,
  splitRedactedThinkingSegments,
} from '@/lib/agent-assistant-text'
import { INTEGRATION_SERVICE_NAMES } from './constants'
import type {
  AssistantVisualBlock,
  AssistantVisualSegment,
  ChatOutput,
  ChatMessageMetadata,
  GenerationResult,
  LiveMessageDelta,
  RestoredOutputGroup,
  ServerConversationMessage,
  ToolVisualBlock,
} from './types'

export function getMessageText(msg: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!msg.parts) return ''
  return msg.parts.filter((p) => p.type === 'text').map((p) => p.text || '').join('')
}

export function messageHasVisibleAssistantActivity(msg: { parts?: Array<{ type: string; text?: string; toolInvocation?: unknown; url?: string }> }): boolean {
  return (msg.parts ?? []).some((part) => {
    if (part.type === 'text' || part.type === 'reasoning') return Boolean(part.text?.trim())
    if (part.type === 'tool-invocation') return Boolean(part.toolInvocation)
    if (part.type === 'file') return Boolean(part.url)
    return part.type.startsWith('tool-')
  })
}

export function chooseAssistantCandidate<T extends { role: string; parts?: Array<{ type: string; text?: string; toolInvocation?: unknown; url?: string }> }>(
  candidates: T[],
): T | null {
  if (candidates.length === 0) return null
  return candidates.find(messageHasVisibleAssistantActivity) ?? candidates[candidates.length - 1]!
}


/**
 * Preserve message `parts` order so tools and text interleave (matches stream / persisted transcript).
 */
export function buildAssistantVisualSequence(parts: unknown[] | undefined): AssistantVisualBlock[] {
  if (!parts?.length) return []
  const out: AssistantVisualBlock[] = []
  for (const p of parts) {
    const legacy = p as {
      type?: string
      toolInvocation?: {
        toolCallId?: string
        toolName?: string
        state?: string
        toolInput?: Record<string, unknown>
        toolOutput?: unknown
      }
    }
    if (legacy?.type === 'tool-invocation' && legacy.toolInvocation?.toolName) {
      const inv = legacy.toolInvocation
      out.push({
        kind: 'tool',
        key: (inv.toolCallId && inv.toolCallId.trim()) || `legacy-inv-${out.length}`,
        name: inv.toolName as string,
        state: inv.state ?? 'output-available',
        toolInput: inv.toolInput,
        toolOutput: inv.toolOutput,
      })
      continue
    }
    if (isToolUIPart(p as never)) {
      const part = p as {
        toolCallId?: string
        state: string
        input?: Record<string, unknown>
        output?: unknown
      }
      out.push({
        kind: 'tool',
        key: (part.toolCallId && part.toolCallId.trim()) || `sdk-tool-${out.length}`,
        name: getToolName(p as never),
        state: part.state,
        toolInput: part.input,
        toolOutput: part.output,
      })
      continue
    }
    if (isReasoningUIPart(p as never)) {
      const part = p as { type: 'reasoning'; text?: string; state?: string }
      const merged = normalizeAgentAssistantText(part.text?.trim() || '')
      if (!merged) continue
      const prev = out[out.length - 1]
      if (prev?.kind === 'reasoning') {
        prev.text = normalizeAgentAssistantText(`${prev.text}\n\n${merged}`)
      } else {
        out.push({
          kind: 'reasoning',
          key: `reasoning-${out.length}`,
          text: merged,
          state: part.state,
        })
      }
      continue
    }
    const pt = p as { type?: string; text?: string; url?: string; mediaType?: string }
    if (pt.type === 'file' && typeof pt.url === 'string' && pt.url) {
      out.push({ kind: 'file', url: pt.url, mediaType: pt.mediaType })
      continue
    }
    if (pt.type === 'text' && typeof pt.text === 'string') {
      const segList = splitRedactedThinkingSegments(pt.text)
      for (const seg of segList) {
        if (seg.kind === 'text') {
          const merged = normalizeAgentAssistantText(seg.text)
          if (!merged) continue
          const prev = out[out.length - 1]
          if (prev?.kind === 'text') {
            prev.text = normalizeAgentAssistantText(`${prev.text}\n\n${merged}`)
          } else {
            out.push({ kind: 'text', text: merged })
          }
        } else {
          const merged = redactOpaqueNotebookFileIdsInVisibleText(seg.text.trim())
          if (!merged) continue
          const prev = out[out.length - 1]
          if (prev?.kind === 'reasoning') {
            prev.text = redactOpaqueNotebookFileIdsInVisibleText(
              `${prev.text}\n\n${merged}`.trim(),
            )
          } else {
            out.push({
              kind: 'reasoning',
              key: `reasoning-${out.length}`,
              text: merged,
            })
          }
        }
      }
    }
  }
  // Reasoning now renders as its own standalone collapsible segment; no folding.

  // Fix word-split artifact: some reasoning models (e.g. routed by openrouter/free) emit
  // the first word(s) of the response as thinking tokens. The AI SDK puts these in a
  // `reasoning` part and the text part starts mid-word with an apostrophe (e.g.
  // reasoning="I don", text="'t have..."). Detect this pattern and move the trailing
  // word fragment from the reasoning block into the text block.
  for (let i = 0; i < out.length - 1; i++) {
    const rBlk = out[i]
    const tBlk = out[i + 1]
    if (
      rBlk?.kind === 'reasoning' &&
      tBlk?.kind === 'text' &&
      /^'[a-zA-Z]/.test(tBlk.text)
    ) {
      const lastWordMatch = rBlk.text.match(/(\S+)$/)
      if (lastWordMatch) {
        const word = lastWordMatch[1]!
        rBlk.text = rBlk.text.slice(0, rBlk.text.length - word.length).trim()
        tBlk.text = word + tBlk.text
      }
    }
  }

  return out
}

export function assistantBlocksToPlainText(blocks: AssistantVisualBlock[]): string {
  return blocks
    .filter((b): b is { kind: 'text'; text: string } => b.kind === 'text')
    .map((b) => b.text)
    .join('\n\n')
}
export function pickFirstStringFromInput(input: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!input) return null
  for (const k of keys) {
    const v = input[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function titleCaseUnderscore(id: string): string {
  return id
    .trim()
    .split(/_+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function describeComposioSearchToolsInput(input?: Record<string, unknown>): string | null {
  if (!input) return null
  const hint =
    pickFirstStringFromInput(input, ['use_case', 'intent', 'description', 'goal', 'task']) ??
    (typeof input.query === 'string' ? input.query : null)
  if (hint) {
    const clipped = hint.length > 120 ? `${hint.slice(0, 120)}…` : hint
    return `Finding the right tools — ${clipped}`
  }
  const qs = input.queries
  if (Array.isArray(qs) && qs.length && typeof qs[0] === 'string' && qs[0].trim()) {
    const q = qs[0]!.trim()
    const clipped = q.length > 80 ? `${q.slice(0, 80)}…` : q
    return `Searching apps for “${clipped}”`
  }
  return null
}


function serviceNameFromComposioTool(toolName: string): string | null {
  const u = toolName.toUpperCase()
  const keys = Object.keys(INTEGRATION_SERVICE_NAMES).sort((a, b) => b.length - a.length)
  for (const prefix of keys) {
    if (u.startsWith(`${prefix}_`)) {
      return INTEGRATION_SERVICE_NAMES[prefix] ?? null
    }
  }
  return null
}

function describeComposioIntegrationTool(toolName: string, input?: Record<string, unknown>): string {
  const service = serviceNameFromComposioTool(toolName)
  const u = toolName.toUpperCase()
  const q =
    input &&
    pickFirstStringFromInput(input, [
      'query',
      'search_query',
      'q',
      'search',
      'prompt',
      'message',
      'subject',
      'body',
      'text',
    ])

  if (service) {
    if (q && (u.includes('SEARCH') || u.includes('FIND') || u.includes('QUERY') || u.includes('LIST_MESSAGE'))) {
      const clipped = q.length > 56 ? `${q.slice(0, 56)}…` : q
      return `Searching ${service} for “${clipped}”`
    }
    if (/(SEND|POST|CREATE_MESSAGE|REPLY)/.test(u) && u.includes('MAIL')) {
      return `Sending mail in ${service}`
    }
    if (/(SEND|POST|MESSAGE)/.test(u) && u.includes('SLACK')) {
      return `Sending a message in ${service}`
    }
    if (/(CREATE_EVENT|ADD_EVENT|INSERT_EVENT|SCHEDULE)/.test(u)) {
      return `Scheduling an event in ${service}`
    }
    if (/(LIST_MESSAGES|FETCH|INBOX|THREAD)/.test(u) && u.includes('GMAIL')) {
      return `Reading mail in ${service}`
    }
    if (/(LIST_EVENT|GET_EVENT|SEARCH_EVENT|FIND_EVENT|FREE_BUSY|AVAILABILITY)/.test(u)) {
      return `Looking at events in ${service}`
    }
    if (/(UPDATE_EVENT|PATCH_EVENT|EDIT_EVENT)/.test(u)) {
      return `Updating an event in ${service}`
    }
    if (/(DELETE_EVENT|REMOVE_EVENT|CANCEL_EVENT)/.test(u)) {
      return `Updating calendar in ${service}`
    }
    if (/(CREATE|ADD|NEW)/.test(u) && !/(CREATE_EVENT)/.test(u)) {
      return `Creating in ${service}`
    }
    if (/(UPDATE|EDIT|PATCH)/.test(u)) {
      return `Updating ${service}`
    }
    if (/(DELETE|REMOVE)/.test(u)) {
      return `Deleting in ${service}`
    }
    if (/(LIST|SEARCH|FETCH|GET|FIND|QUERY|READ)/.test(u)) {
      return `Searching ${service}`
    }
    return `Using ${service}`
  }

  if (u.includes('MULTI_EXECUTE')) {
    return 'Running connected app actions'
  }
  if (u.includes('SEARCH_TOOLS')) {
    return describeComposioSearchToolsInput(input) ?? 'Finding the right tools for your task'
  }

  return titleCaseUnderscore(toolName.replace(/^composio_/i, ''))
}

export function getDescriptiveToolLabel(toolName: string, toolInput?: Record<string, unknown>): string {
  const map: Record<string, string> = {
    browser_run_task: 'Browsing the web',
    interactive_browser_session: 'Browsing the web',
    perplexity_search: 'Searching the web',
    parallel_search: 'Deep web research',
    search_knowledge: 'Searching your knowledge',
    list_skills: 'Checking your skills',
    list_notes: 'Listing your notes',
    get_note: 'Opening a note',
    create_note: 'Creating a note',
    update_note: 'Updating a note',
    delete_note: 'Deleting a note',
    save_memory: 'Saving to memory',
    update_memory: 'Updating memory',
    delete_memory: 'Deleting memory',
    generate_image: 'Generating an image',
    generate_video: 'Generating a video',
    run_daytona_sandbox: 'Running your workspace',
  }
  if (map[toolName]) return map[toolName]!

  if (toolName === 'COMPOSIO_SEARCH_TOOLS') {
    return describeComposioSearchToolsInput(toolInput) ?? 'Finding the right tools for your task'
  }

  if (/composio|GMAIL_|GOOGLE_|SLACK_|NOTION_|GITHUB_|LINEAR_|OUTLOOK_|CAL_COM/i.test(toolName)) {
    return describeComposioIntegrationTool(toolName, toolInput)
  }

  if (toolName === 'perplexity_search' && toolInput) {
    const q = pickFirstStringFromInput(toolInput, ['query', 'q'])
    if (q) {
      const clipped = q.length > 72 ? `${q.slice(0, 72)}…` : q
      return `Searching the web for “${clipped}”`
    }
  }

  if (toolName === 'parallel_search' && toolInput) {
    const o = pickFirstStringFromInput(toolInput, ['objective'])
    if (o) {
      const clipped = o.length > 72 ? `${o.slice(0, 72)}…` : o
      return `Researching: “${clipped}”`
    }
  }

  if (toolName.startsWith('mcp_')) {
    const rest = toolName.slice(4)
    const firstUnderscore = rest.indexOf('_')
    if (firstUnderscore > 0) {
      const serverSlug = rest.slice(0, firstUnderscore)
      const toolSlug = rest.slice(firstUnderscore + 1)
      const serverName = titleCaseUnderscore(serverSlug)
      const toolDisplayName = titleCaseUnderscore(toolSlug)
      return `${serverName} MCP: ${toolDisplayName}`
    }
  }

  return titleCaseUnderscore(toolName)
}


function buildAssistantVisualSegmentsRaw(blocks: AssistantVisualBlock[]): AssistantVisualSegment[] {
  const out: AssistantVisualSegment[] = []
  let i = 0
  while (i < blocks.length) {
    const b = blocks[i]!
    if (b.kind === 'reasoning') {
      out.push({ kind: 'reasoning', block: b, originIndex: i })
      i++
      continue
    }
    if (b.kind === 'tool' && (b.name === 'browser_run_task' || b.name === 'interactive_browser_session')) {
      out.push({ kind: 'browser', block: b, originIndex: i })
      i++
      continue
    }
    if (b.kind === 'tool') {
      const start = i
      const group: ToolVisualBlock[] = []
      while (i < blocks.length) {
        const t = blocks[i]!
        if (t.kind !== 'tool' || t.name === 'browser_run_task' || t.name === 'interactive_browser_session') break
        group.push(t)
        i++
      }
      out.push({ kind: 'tools', tools: group, originIndex: start })
      continue
    }
    if (b.kind === 'file') {
      out.push({ kind: 'file', block: b, originIndex: i })
      i++
      continue
    }
    if (b.kind === 'text') {
      out.push({ kind: 'text', block: b, originIndex: i })
      i++
      continue
    }
    i++
  }
  return out
}

export function buildAssistantVisualSegments(blocks: AssistantVisualBlock[]): AssistantVisualSegment[] {
  // Reasoning renders as its own first-class segment (see `ReasoningBlock`), so we no longer
  // collapse reasoning between tool groups; each reasoning chunk stays visible next to the
  // tools it describes.
  return buildAssistantVisualSegmentsRaw(blocks)
}

function isToolChainSegment(seg: AssistantVisualSegment): boolean {
  return seg.kind === 'browser' || seg.kind === 'tools'
}

export function computeToolChainFlags(segments: AssistantVisualSegment[]): Array<{ chainTop: boolean; chainBottom: boolean }> {
  return segments.map((seg, i) => ({
    chainTop: i > 0 && isToolChainSegment(segments[i - 1]!) && isToolChainSegment(seg),
    chainBottom:
      i < segments.length - 1 && isToolChainSegment(seg) && isToolChainSegment(segments[i + 1]!),
  }))
}
export function getMessageImages(msg: { parts?: Array<{ type: string; url?: string; mediaType?: string }> }): string[] {
  if (!msg.parts) return []
  return msg.parts
    .filter((p) => p.type === 'file' && p.url && (p.mediaType?.startsWith('image/') ?? true))
    .map((p) => p.url!)
}

export function getUserMessageDocNames(msg: unknown): string[] {
  const m = msg as { metadata?: ChatMessageMetadata }
  const fromMeta = m.metadata?.indexedDocuments
  if (Array.isArray(fromMeta) && fromMeta.length > 0) return fromMeta
  return []
}

/** Strip `[Indexed documents: …]` from display text and return attachment names (from persisted content). */
export function splitUserDisplayText(fullText: string): { bodyText: string; docNames: string[] } {
  const re = /\[Indexed documents:\s*([^\]]+)\]/g
  const docNames: string[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(fullText)) !== null) {
    docNames.push(...match[1]!.split(',').map((s) => s.trim()).filter(Boolean))
  }
  const bodyText = fullText.replace(re, '').replace(/\n{3,}/g, '\n\n').trim()
  return { bodyText, docNames }
}

export function getUserTurnId(msg: { id: string; turnId?: string }): string | null {
  if (typeof msg.turnId === 'string' && msg.turnId.trim()) return msg.turnId.trim()
  return msg.id?.trim() || null
}

export function getUserReplyThreadMeta(msg: unknown): { replyToTurnId: string; replySnippet: string } | null {
  const m = msg as {
    metadata?: ChatMessageMetadata
    replyToTurnId?: string
    replySnippet?: string
  }
  const tid = m.metadata?.replyToTurnId?.trim() || m.replyToTurnId?.trim()
  if (!tid) return null
  const snippet = (m.metadata?.replySnippet || m.replySnippet || 'Earlier message').trim()
  return { replyToTurnId: tid, replySnippet: snippet }
}

export function getRoutedModelId(msg: unknown): string | null {
  const m = msg as {
    metadata?: ChatMessageMetadata
    routedModelId?: string
  }
  const routedModelId = m.metadata?.routedModelId?.trim() || m.routedModelId?.trim()
  return routedModelId || null
}

export function messageMatchesLocalTurn(msg: { id?: string; turnId?: string }, turnId: string): boolean {
  const persistedTurnId = msg.turnId?.trim()
  if (persistedTurnId) return persistedTurnId === turnId
  const localId = msg.id?.trim() || ''
  return localId === turnId || localId.startsWith(`${turnId}::`)
}

/** Remove assistant (and any non-user tail) after the given user turn so the exchange can be re-streamed. */
export function stripAssistantAfterUserTurn(messages: UIMessage[], turnId: string): UIMessage[] {
  let userIdx = -1
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i] as UIMessage & { id?: string }
    if (m.role === 'user' && messageMatchesLocalTurn(m, turnId)) {
      userIdx = i
      break
    }
  }
  if (userIdx < 0) return messages
  let end = userIdx + 1
  while (end < messages.length && messages[end]!.role !== 'user') {
    end++
  }
  if (end === userIdx + 1) return messages
  return [...messages.slice(0, userIdx + 1), ...messages.slice(end)]
}

export function replaceAssistantForTurn(
  messages: UIMessage[],
  turnId: string,
  assistantFromServer: ServerConversationMessage,
): UIMessage[] {
  const next = [...messages]
  let matchedUser = false
  for (let i = 0; i < next.length; i++) {
    const msg = next[i] as UIMessage & { turnId?: string }
    if (msg.role === 'user') {
      if (matchedUser) break
      matchedUser = messageMatchesLocalTurn(msg, turnId)
      continue
    }
    if (matchedUser && msg.role === 'assistant') {
      next[i] = assistantFromServer as unknown as UIMessage
      return next
    }
  }
  return next
}

function isToolInvocationPart(part: Record<string, unknown>): part is Record<string, unknown> & {
  toolInvocation: {
    toolCallId?: string
    toolName?: string
    toolInput?: unknown
    toolOutput?: unknown
    state?: string
  }
} {
  return typeof part.toolInvocation === 'object' && part.toolInvocation !== null
}

export function mergeLiveStreamingParts(
  existingParts: Array<Record<string, unknown>>,
  newParts: Array<Record<string, unknown>>,
) {
  let nextParts = existingParts
  for (const part of newParts) {
    const last = nextParts[nextParts.length - 1]
    if (
      part.type === 'reasoning' &&
      last?.type === 'reasoning' &&
      typeof part.text === 'string'
    ) {
      nextParts = [
        ...nextParts.slice(0, -1),
        {
          ...last,
          text: `${typeof last.text === 'string' ? last.text : ''}${part.text}`,
          state: part.state ?? last.state,
        },
      ]
      continue
    }

    if (isToolInvocationPart(part)) {
      const incoming = part.toolInvocation
      const toolCallId = incoming.toolCallId
      if (toolCallId) {
        const existingIdx = nextParts.findIndex(
          (candidate) =>
            isToolInvocationPart(candidate) &&
            candidate.toolInvocation.toolCallId === toolCallId,
        )
        if (existingIdx >= 0) {
          const existing = nextParts[existingIdx]!
          if (isToolInvocationPart(existing)) {
            nextParts = [
              ...nextParts.slice(0, existingIdx),
              {
                type: 'tool-invocation',
                toolInvocation: {
                  ...existing.toolInvocation,
                  ...incoming,
                  toolName:
                    incoming.toolName === 'unknown_tool'
                      ? existing.toolInvocation.toolName
                      : incoming.toolName,
                  toolInput: incoming.toolInput ?? existing.toolInvocation.toolInput,
                  toolOutput: incoming.toolOutput ?? existing.toolInvocation.toolOutput,
                },
              },
              ...nextParts.slice(existingIdx + 1),
            ]
            continue
          }
        }
      }
    }

    nextParts = [...nextParts, part]
  }
  return nextParts
}

export function applyLiveMessageDeltaParts(
  existingParts: Array<Record<string, unknown>>,
  delta: LiveMessageDelta,
) {
  let nextParts = existingParts
  if (delta.textDelta) {
    const last = nextParts[nextParts.length - 1]
    if (last?.type === 'text') {
      nextParts = [
        ...nextParts.slice(0, -1),
        {
          ...last,
          text: `${typeof last.text === 'string' ? last.text : ''}${delta.textDelta}`,
        },
      ]
    } else {
      nextParts = [...nextParts, { type: 'text', text: delta.textDelta }]
    }
  }
  if (delta.newParts?.length) {
    nextParts = mergeLiveStreamingParts(nextParts, delta.newParts)
  }
  return nextParts
}

export function getDraftFromToolBlock(block: ToolVisualBlock): { kind: 'skill'; draft: SkillDraftSummary } | { kind: 'automation'; draft: AutomationDraftSummary } | null {
  const output =
    block.toolOutput && typeof block.toolOutput === 'object'
      ? (block.toolOutput as Record<string, unknown>)
      : null
  if (!output || output.success !== true) return null

  if (block.name === 'draft_skill_from_chat' && output.draft && typeof output.draft === 'object') {
    return { kind: 'skill', draft: output.draft as SkillDraftSummary }
  }
  if (block.name === 'draft_automation_from_chat' && output.draft && typeof output.draft === 'object') {
    return { kind: 'automation', draft: output.draft as AutomationDraftSummary }
  }
  return null
}

function safeReadString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeWebUrl(raw: string): string | null {
  return safeHttpUrl(raw)
}

function pickSourceTitle(entry: Record<string, unknown>, fallbackUrl: string): string {
  const candidate =
    safeReadString(entry.title) ??
    safeReadString(entry.name) ??
    safeReadString(entry.domain) ??
    safeReadString(entry.host)
  if (candidate) return candidate
  try {
    const parsed = new URL(fallbackUrl)
    return parsed.hostname.replace(/^www\./i, '')
  } catch {
    return fallbackUrl
  }
}

function collectSourceCandidatesFromUnknown(
  value: unknown,
  origin: 'web-search' | 'browser',
  acc: WebSourceItem[],
  seen: Set<string>,
  depth = 0,
) {
  if (depth > 5) return
  if (Array.isArray(value)) {
    for (const item of value) collectSourceCandidatesFromUnknown(item, origin, acc, seen, depth + 1)
    return
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      const urlMatches = value.match(/https?:\/\/[^\s)\]]+/g)
      if (!urlMatches) return
      for (const rawUrl of urlMatches) {
        const normalized = normalizeWebUrl(rawUrl)
        if (!normalized || seen.has(normalized)) continue
        seen.add(normalized)
        acc.push({
          url: normalized,
          title: pickSourceTitle({}, normalized),
          origin,
        })
      }
    }
    return
  }

  const rec = value as Record<string, unknown>
  const possibleUrl =
    safeReadString(rec.url) ??
    safeReadString(rec.link) ??
    safeReadString(rec.href) ??
    safeReadString(rec.sourceUrl) ??
    safeReadString(rec.source_url)
  if (possibleUrl) {
    const normalized = normalizeWebUrl(possibleUrl)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      acc.push({
        url: normalized,
        title: pickSourceTitle(rec, normalized),
        snippet:
          safeReadString(rec.snippet) ??
          safeReadString(rec.excerpt) ??
          safeReadString(rec.summary) ??
          safeReadString(rec.description) ??
          undefined,
        origin,
      })
    }
  }

  for (const child of Object.values(rec)) {
    if (child && (typeof child === 'object' || typeof child === 'string')) {
      collectSourceCandidatesFromUnknown(child, origin, acc, seen, depth + 1)
    }
  }
}

export function collectWebSourcesFromBlocks(blocks: AssistantVisualBlock[]): WebSourceItem[] {
  const items: WebSourceItem[] = []
  const seen = new Set<string>()
  for (const block of blocks) {
    if (block.kind !== 'tool') continue
    if (block.state !== 'output-available') continue
    if (
      block.name !== 'perplexity_search' &&
      block.name !== 'parallel_search' &&
      block.name !== 'browser_run_task' &&
      block.name !== 'interactive_browser_session'
    ) continue
    collectSourceCandidatesFromUnknown(
      block.toolOutput,
      block.name === 'perplexity_search' || block.name === 'parallel_search' ? 'web-search' : 'browser',
      items,
      seen,
    )
  }
  return items
}

/** Extract structured sources from a single tool block (used by the web-search row). */
export function collectWebSourcesFromSingleBlock(block: ToolVisualBlock): WebSourceItem[] {
  if (block.state !== 'output-available') return []
  const items: WebSourceItem[] = []
  const seen = new Set<string>()
  collectSourceCandidatesFromUnknown(
    block.toolOutput,
    block.name === 'perplexity_search' || block.name === 'parallel_search' ? 'web-search' : 'browser',
    items,
    seen,
  )
  return items
}

export function faviconUrl(pageUrl: string): string {
  try {
    const host = new URL(pageUrl).hostname
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`
  } catch {
    return ''
  }
}

export function hostFromUrl(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

export function scrollToExchangeTurn(turnId: string) {
  const safe = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(turnId) : turnId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  document.querySelector(`[data-exchange-turn="${safe}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Act assistant for a user turn: `actChat` mirrors `chat0` until streaming appends the assistant only to `actChat`,
 * so the assistant is at the same index as the user + 1. Falls back to id-based scan inside `actChat`.
 */
export function resolveActAssistant(
  chat0Linear: Array<{ id?: string; role: string }>,
  actMsgs: Array<{ id?: string; role: string; parts?: Array<{ type: string; text?: string; toolInvocation?: unknown; url?: string }> }>,
  userMsgId: string,
) {
  const i = chat0Linear.findIndex((m) => m.role === 'user' && m.id === userMsgId)
  if (i >= 0) {
    const candidates: typeof actMsgs = []
    for (let j = i + 1; j < actMsgs.length; j++) {
      const m = actMsgs[j]!
      if (m.role === 'user') break
      if (m.role === 'assistant') candidates.push(m)
    }
    const selected = chooseAssistantCandidate(candidates)
    if (selected) return selected
  }
  const ui = actMsgs.findIndex((m) => m.id === userMsgId && m.role === 'user')
  if (ui >= 0) {
    const candidates: typeof actMsgs = []
    for (let j = ui + 1; j < actMsgs.length; j++) {
      const m = actMsgs[j]!
      if (m.role === 'user') break
      if (m.role === 'assistant') candidates.push(m)
    }
    return chooseAssistantCandidate(candidates)
  }
  return null
}


export async function generateTitle(text: string): Promise<string | null> {
  try {
    const res = await fetch('/api/app/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (res.ok) {
      const data = await res.json()
      return (data.title as string)?.trim() || null
    }
  } catch { /* ignore */ }
  return null
}
export function errorLabel(err: Error | null | undefined): string | null {
  if (!err) return null
  const m = err.message || ''
  if (m.includes('OpenRouter') || m.includes('rate-limited') || m.includes('rate limit')) {
    return m
  }
  if (err.message?.includes('weekly_limit')) return 'Weekly limit reached — upgrade to a paid plan for unlimited messages.'
  if (err.message?.includes('premium_model')) return 'This model requires a paid plan.'
  if (err.message?.includes('generation_not_allowed')) return 'This action requires a paid plan.'
  if (err.message?.includes('insufficient_credits')) return 'No budget remaining.'
  if (err.message?.includes('storage_limit_exceeded')) return 'Overlay storage limit reached. Delete files or outputs, or upgrade your plan.'
  if (err.message?.includes('bandwidth_limit_exceeded')) return 'File bandwidth limit reached for this billing period.'
  if (err.message?.includes('supported image formats') || err.message?.includes('does not represent a valid image')) {
    return 'Unsupported image format. Use JPEG, PNG, GIF, or WebP.'
  }
  if (/model.*not found|not found.*model|model_not_found/i.test(m)) {
    return 'That model is not available from the provider right now. Try another model.'
  }
  return 'Something went wrong. Please try again.'
}


// ─── constants ───────────────────────────────────────────────────────────────

export function chatGreetingLine(firstName: string | undefined) {
  const raw = firstName?.trim()
  if (!raw) return 'hi there'
  const word = raw.split(/\s+/)[0] ?? raw
  const nice = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  return `Hi ${nice}!`
}

export function sanitizeEmptyChatStarters(prompts: string[], firstName?: string): string[] {
  const trimmedFirstName = firstName?.trim()
  const firstNamePattern = trimmedFirstName
    ? new RegExp(`\\b${trimmedFirstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    : null

  return prompts
    .filter((prompt) => typeof prompt === 'string')
    .map((prompt) => prompt.trim())
    .filter((prompt) => prompt.length > 0)
    .filter((prompt) => !/\boverlay\b/i.test(prompt))
    .filter((prompt) => !(firstNamePattern?.test(prompt) ?? false))
    .slice(0, 4)
}
export function groupOutputsIntoExchanges(outputs: ChatOutput[]): RestoredOutputGroup[] {
  const isMediaOutput = (output: ChatOutput): output is ChatOutput & { type: 'image' | 'video' } =>
    output.type === 'image' || output.type === 'video'

  const sorted = outputs
    .filter(isMediaOutput)
    .sort((a, b) => a.createdAt - b.createdAt)
  const groups: RestoredOutputGroup[] = []

  for (const output of sorted) {
    const prev = groups[groups.length - 1]
    const normalizedTurnId = output.turnId?.trim() || null
    const shouldMerge =
      prev &&
      prev.type === output.type &&
      (
        (normalizedTurnId && prev.turnId === normalizedTurnId) ||
        (
          !normalizedTurnId &&
          !prev.turnId &&
          prev.prompt === output.prompt &&
          Math.abs(output.createdAt - prev.createdAt) < 60_000
        )
      )

    const result: GenerationResult = {
      type: output.type,
      status:
        output.status === 'pending'
          ? 'generating'
          : output.status === 'completed'
          ? 'completed'
          : 'failed',
      url: output.url,
      modelUsed: output.modelId,
      outputId: output._id,
      error: output.status === 'failed' ? 'Generation failed' : undefined,
    }

    if (shouldMerge) {
      prev.modelIds.push(output.modelId)
      prev.results.push(result)
      continue
    }

    groups.push({
      type: output.type,
      prompt: output.prompt,
      modelIds: [output.modelId],
      results: [result],
      createdAt: output.createdAt,
      turnId: normalizedTurnId,
    })
  }

  return groups
}

export function buildMediaSummary(type: 'image' | 'video', prompt: string, modelIds: string[], completedCount: number, failedCount: number): string {
  const noun = type === 'image' ? (completedCount === 1 ? 'image' : 'images') : (completedCount === 1 ? 'video' : 'videos')
  const modelList = modelIds.join(', ')
  const failureSuffix = failedCount > 0 ? ` ${failedCount} generation${failedCount === 1 ? '' : 's'} failed.` : ''
  return `Generated ${completedCount} ${noun} for the prompt "${prompt}" using ${modelList}.${failureSuffix}`
}
