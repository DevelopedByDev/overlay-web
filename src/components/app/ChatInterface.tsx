'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Plus,
  Trash2,
  ChevronDown,
  ImageIcon,
  FileText,
  X,
  AlertCircle,
  Check,
  FolderOpen,
  Video,
  Download,
  Copy,
  Reply,
  Pencil,
  BrainCircuit,
  ArrowUp,
  Play,
  MessageSquare,
} from 'lucide-react'
import { Chat, useChat } from '@ai-sdk/react'
import { DefaultChatTransport, getToolName, isReasoningUIPart, isToolUIPart, type UIMessage } from 'ai'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { TopUpPreferenceControl } from '@/components/billing/TopUpPreferenceControl'
import {
  CHAT_MODEL_QUALITY_PRIORITY,
  DEFAULT_MODEL_ID,
  FREE_TIER_AUTO_MODEL_ID,
  IMAGE_MODELS,
  VIDEO_MODELS,
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_VIDEO_MODEL_ID,
  getChatModelDisplayName,
  getModel,
  getModelsByIntelligence,
  getVideoModelsBySubMode,
  type ChatModel,
  type GenerationMode,
  type VideoSubMode,
} from '@/lib/models'
import type { SourceCitationMap } from '@/lib/ask-knowledge-context'
import { AskActModeToggle, GenerationModeToggle } from './GenerationModeToggle'
import {
  CHAT_CREATED_EVENT,
  CHAT_TITLE_UPDATED_EVENT,
  dispatchChatCreated,
  dispatchChatTitleUpdated,
  sanitizeChatTitle,
  type ChatCreatedDetail,
  type ChatTitleUpdatedDetail,
} from '@/lib/chat-title'
import { useAsyncSessions } from '@/lib/async-sessions-store'
import { useWordLevelStreaming } from '@/lib/use-word-level-streaming'
import { MarkdownMessage } from './MarkdownMessage'
import { DelayedTooltip } from './DelayedTooltip'
import { normalizeAgentAssistantText } from '@/lib/agent-assistant-text'
import type { OutputType } from '@/lib/output-types'
import { useAppSettings } from './AppSettingsProvider'
import { DEFAULT_CHAT_SUGGESTIONS } from '@/lib/chat-suggestions-defaults'
import {
  buildAutomationDraftFromTurn,
  buildSkillDraftFromTurn,
  type AutomationDraftSummary,
  type ChatAutomationSuggestionSummary,
  type SkillDraftSummary,
} from '@/lib/automation-drafts'

function ModelBadges({ m, isHovered, isFreeTier }: { m: ChatModel; isHovered: boolean; isFreeTier: boolean }) {
  const router = useRouter()
  const showUpgrade = isFreeTier && m.cost > 0

  if (isHovered) {
    return (
      <span className="flex items-center gap-1 shrink-0 h-5">
        {showUpgrade && (
          <span
            onClick={(e) => { e.stopPropagation(); router.push('/account') }}
            className="inline-flex items-center h-5 px-1.5 rounded-full text-[9px] font-semibold leading-none cursor-pointer transition-colors"
            style={{
              background: 'var(--chat-badge-upgrade-bg)',
              color: 'var(--chat-badge-upgrade-fg)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--chat-badge-upgrade-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--chat-badge-upgrade-bg)'
            }}
          >
            Upgrade
          </span>
        )}
        <span className={`inline-flex items-center h-5 px-1.5 rounded-full text-[9px] font-semibold leading-none tracking-tight ${
          m.cost === 0 ? '' : 'bg-[var(--surface-subtle)] text-[var(--muted)]'
        }`}
        style={m.cost === 0 ? { background: 'var(--chat-badge-free-bg)', color: 'var(--chat-badge-free-fg)' } : undefined}
        >
          {m.cost === 0 ? 'Free' : '$'.repeat(m.cost)}
        </span>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 shrink-0 h-5">
      {showUpgrade && (
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded"
          style={{ background: 'var(--chat-badge-upgrade-bg)', color: 'var(--chat-badge-upgrade-fg)' }}
        >
          <ArrowUp size={10} strokeWidth={2} />
        </span>
      )}
      {m.supportsVision && (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[var(--surface-subtle)] text-[var(--muted)]">
          <ImageIcon size={10} strokeWidth={1.75} />
        </span>
      )}
      {m.supportsReasoning && (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[var(--surface-subtle)] text-[var(--muted)]">
          <BrainCircuit size={10} strokeWidth={1.75} />
        </span>
      )}
    </span>
  )
}

function getAssistantAfterUserExchangeIndex(msgs: UIMessage[], exchIdx: number): UIMessage | null {
  let uCount = 0
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].role === 'user') {
      if (uCount === exchIdx) {
        for (let j = i + 1; j < msgs.length; j++) {
          if (msgs[j].role === 'assistant') return msgs[j]
          if (msgs[j].role === 'user') break
        }
        return null
      }
      uCount++
    }
  }
  return null
}

function cloneUiMessageForThread(msg: UIMessage): UIMessage {
  try {
    return structuredClone(msg) as UIMessage
  } catch {
    return JSON.parse(JSON.stringify(msg)) as UIMessage
  }
}

/** Assistants for exchange `k` from prior picker models, best-first then remaining prev order. */
function collectAssistantsForExchangeSorted(
  prevOrder: string[],
  snapshots: UIMessage[][],
  qualityPriority: readonly string[],
  k: number,
): UIMessage[] {
  const bySlotModel = new Map<string, UIMessage[]>()
  prevOrder.forEach((id, j) => {
    bySlotModel.set(id, snapshots[j] ?? [])
  })
  const prevSet = new Set(prevOrder)
  const orderedIds: string[] = []
  for (const pid of qualityPriority) {
    if (prevSet.has(pid) && !orderedIds.includes(pid)) orderedIds.push(pid)
  }
  for (const id of prevOrder) {
    if (!orderedIds.includes(id)) orderedIds.push(id)
  }
  const out: UIMessage[] = []
  for (const id of orderedIds) {
    const thread = bySlotModel.get(id)
    if (!thread) continue
    const a = getAssistantAfterUserExchangeIndex(thread, k)
    if (a) out.push(a)
  }
  return out
}

/**
 * Prior context for a **new** picker model: same user turns as slot 0, then per-turn assistant chosen
 * from prior models so each physical slot gets a different answer when multiple variants existed
 * (slot index rotates through quality-sorted candidates). Avoids every chip sharing one "best" reply.
 */
function buildSynthesizedThreadForPickerSlot(
  prevOrder: string[],
  snapshots: UIMessage[][],
  qualityPriority: readonly string[],
  physicalSlotIndex: number,
): UIMessage[] {
  const primary = snapshots[0] ?? []
  const userMsgs: UIMessage[] = []
  for (const m of primary) {
    if (m.role === 'user') userMsgs.push(m)
  }
  if (userMsgs.length === 0) return []

  const out: UIMessage[] = []
  for (let k = 0; k < userMsgs.length; k++) {
    out.push(cloneUiMessageForThread(userMsgs[k]!))
    const candidates = collectAssistantsForExchangeSorted(prevOrder, snapshots, qualityPriority, k)
    if (candidates.length === 0) continue
    const pick = candidates[physicalSlotIndex % candidates.length]!
    out.push(cloneUiMessageForThread(pick))
  }
  return out
}

interface Conversation {
  _id: string
  title: string
  lastModified: number
  lastMode?: 'ask' | 'act'
  askModelIds?: string[]
  actModelId?: string
}

interface AttachedImage {
  dataUrl: string
  mimeType: string
  name: string
}

interface PendingChatDocument {
  clientId: string
  name: string
  status: 'uploading' | 'ready' | 'error'
  error?: string
}

interface ChatOutput {
  _id: string
  type: OutputType
  status: 'pending' | 'completed' | 'failed'
  prompt: string
  modelId: string
  url?: string
  createdAt: number
  turnId?: string
}

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  planKind?: 'free' | 'paid'
  creditsUsed: number
  creditsTotal: number
  budgetUsedCents?: number
  budgetTotalCents?: number
  budgetRemainingCents?: number
  autoTopUpEnabled?: boolean
  topUpAmountCents?: number
  autoTopUpAmountCents?: number
  topUpMinAmountCents?: number
  topUpMaxAmountCents?: number
  topUpStepAmountCents?: number
  dailyUsage: { ask: number; write: number; agent: number }
  dailyLimits: { ask: number; write: number; agent: number }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function getMessageText(msg: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!msg.parts) return ''
  return msg.parts.filter((p) => p.type === 'text').map((p) => p.text || '').join('')
}

type AssistantVisualBlock =
  | {
      kind: 'tool'
      key: string
      name: string
      state: string
      toolInput?: Record<string, unknown>
      toolOutput?: unknown
      /** Model reasoning folded from the following `reasoning` part (see `foldReasoningIntoPrecedingTools`) */
      reasoningText?: string
      reasoningState?: string
      reasoningKey?: string
    }
  | { kind: 'text'; text: string }
  | { kind: 'file'; url: string; mediaType?: string }
  | { kind: 'reasoning'; key: string; text: string; state?: string }

/**
 * Preserve message `parts` order so tools and text interleave (matches stream / persisted transcript).
 */
function buildAssistantVisualSequence(parts: unknown[] | undefined): AssistantVisualBlock[] {
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
      const merged = normalizeAgentAssistantText(pt.text)
      if (!merged) continue
      const prev = out[out.length - 1]
      if (prev?.kind === 'text') {
        prev.text = normalizeAgentAssistantText(`${prev.text}\n\n${merged}`)
      } else {
        out.push({ kind: 'text', text: merged })
      }
    }
  }
  return foldReasoningIntoPrecedingTools(out)
}

/**
 * Fold a `reasoning` part that immediately follows one or more `tool` parts onto the last tool
 * in that run so the UI can show it as collapsible “thinking” under that tool row.
 */
function foldReasoningIntoPrecedingTools(blocks: AssistantVisualBlock[]): AssistantVisualBlock[] {
  const out: AssistantVisualBlock[] = []
  let i = 0
  while (i < blocks.length) {
    const cur = blocks[i]!
    if (cur.kind === 'tool') {
      const run: AssistantVisualBlock[] = []
      while (i < blocks.length && blocks[i]!.kind === 'tool') {
        run.push(blocks[i]!)
        i++
      }
      let folded: Extract<AssistantVisualBlock, { kind: 'reasoning' }> | null = null
      if (i < blocks.length && blocks[i]!.kind === 'reasoning') {
        folded = blocks[i]! as Extract<AssistantVisualBlock, { kind: 'reasoning' }>
        i++
      }
      const tools = run.map((b) => {
        const t = b as Extract<AssistantVisualBlock, { kind: 'tool' }>
        return { ...t }
      })
      if (folded && tools.length > 0) {
        const lastIdx = tools.length - 1
        const last = tools[lastIdx]!
        tools[lastIdx] = {
          ...last,
          reasoningText: folded.text,
          reasoningState: folded.state,
          reasoningKey: folded.key,
        }
      }
      for (const t of tools) out.push(t)
      continue
    }
    out.push(cur)
    i++
  }
  return out
}

function assistantBlocksToPlainText(blocks: AssistantVisualBlock[]): string {
  return blocks
    .filter((b): b is { kind: 'text'; text: string } => b.kind === 'text')
    .map((b) => b.text)
    .join('\n\n')
}

const TOOL_UI_DONE_STATES = new Set(['output-available', 'output-error', 'output-denied'])

const OVERLAY_LOGO_SRC = '/assets/overlay-logo.png'

function pickFirstStringFromInput(input: Record<string, unknown> | undefined, keys: string[]): string | null {
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

const INTEGRATION_SERVICE_NAMES: Record<string, string> = {
  GMAIL: 'Gmail',
  GOOGLE_CALENDAR: 'Google Calendar',
  GOOGLE_DRIVE: 'Google Drive',
  GOOGLE_SHEETS: 'Google Sheets',
  GOOGLE_DOCS: 'Google Docs',
  SLACK: 'Slack',
  NOTION: 'Notion',
  GITHUB: 'GitHub',
  LINEAR: 'Linear',
  DISCORD: 'Discord',
  OUTLOOK: 'Outlook',
  CAL_COM: 'Cal.com',
  TWITTER: 'Twitter',
  HUBSPOT: 'HubSpot',
  SALESFORCE: 'Salesforce',
  AIRTABLE: 'Airtable',
  ZOOM: 'Zoom',
  TRELLO: 'Trello',
  JIRA: 'Jira',
  DROPBOX: 'Dropbox',
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

function getDescriptiveToolLabel(toolName: string, toolInput?: Record<string, unknown>): string {
  const map: Record<string, string> = {
    browser_run_task: 'Browsing the web',
    perplexity_search: 'Searching the web',
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

  return titleCaseUnderscore(toolName)
}

type ToolVisualBlock = Extract<AssistantVisualBlock, { kind: 'tool' }>

type AssistantVisualSegment =
  | { kind: 'reasoning'; block: Extract<AssistantVisualBlock, { kind: 'reasoning' }>; originIndex: number }
  | { kind: 'text'; block: Extract<AssistantVisualBlock, { kind: 'text' }>; originIndex: number }
  | { kind: 'file'; block: Extract<AssistantVisualBlock, { kind: 'file' }>; originIndex: number }
  | { kind: 'browser'; block: ToolVisualBlock; originIndex: number }
  | { kind: 'tools'; tools: ToolVisualBlock[]; originIndex: number }

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
    if (b.kind === 'tool' && b.name === 'browser_run_task') {
      out.push({ kind: 'browser', block: b, originIndex: i })
      i++
      continue
    }
    if (b.kind === 'tool') {
      const start = i
      const group: ToolVisualBlock[] = []
      while (i < blocks.length) {
        const t = blocks[i]!
        if (t.kind !== 'tool' || t.name === 'browser_run_task') break
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

/**
 * Merge consecutive `tools` segments when only standalone `reasoning` (thinking) appears between them,
 * so a long run of tools without body text becomes one "N tools called" group.
 */
function mergeConsecutiveToolSegments(segments: AssistantVisualSegment[]): AssistantVisualSegment[] {
  const out: AssistantVisualSegment[] = []
  let i = 0
  while (i < segments.length) {
    const s = segments[i]!
    if (s.kind !== 'tools') {
      out.push(s)
      i++
      continue
    }
    const merged = [...s.tools]
    const origin = s.originIndex
    i++
    while (i < segments.length) {
      const next = segments[i]!
      if (next.kind === 'reasoning') {
        i++
        continue
      }
      if (next.kind === 'tools') {
        merged.push(...next.tools)
        i++
        continue
      }
      break
    }
    out.push({ kind: 'tools', tools: merged, originIndex: origin })
  }
  return out
}

function buildAssistantVisualSegments(blocks: AssistantVisualBlock[]): AssistantVisualSegment[] {
  return mergeConsecutiveToolSegments(buildAssistantVisualSegmentsRaw(blocks))
}

function isToolChainSegment(seg: AssistantVisualSegment): boolean {
  return seg.kind === 'browser' || seg.kind === 'tools'
}

function computeToolChainFlags(segments: AssistantVisualSegment[]): Array<{ chainTop: boolean; chainBottom: boolean }> {
  return segments.map((seg, i) => ({
    chainTop: i > 0 && isToolChainSegment(segments[i - 1]!) && isToolChainSegment(seg),
    chainBottom:
      i < segments.length - 1 && isToolChainSegment(seg) && isToolChainSegment(segments[i + 1]!),
  }))
}

function ToolLineLogo() {
  return (
    <Image
      src={OVERLAY_LOGO_SRC}
      alt=""
      width={16}
      height={16}
      className="mt-0.5 size-4 shrink-0 select-none"
      draggable={false}
    />
  )
}

/** Vertical connector between consecutive tool rows (logo stays top-aligned; line in logo column). */
function ToolLogoColumn({ connectTop, connectBottom }: { connectTop: boolean; connectBottom: boolean }) {
  const showLine = connectTop || connectBottom
  const logoBottom = 'calc(0.125rem + 1rem)' /* mt-0.5 + size-4 */
  return (
    <div className="relative flex w-4 shrink-0 flex-col items-center self-stretch">
      {showLine && (
        <div
          className="absolute left-1/2 z-0 w-px -translate-x-1/2 bg-[var(--surface-subtle)]"
          aria-hidden
          style={
            connectTop && connectBottom
              ? { top: 0, bottom: 0 }
              : connectTop
                ? { top: 0, height: logoBottom }
                : { top: logoBottom, bottom: 0 }
          }
        />
      )}
      <div className="relative z-[1] shrink-0 rounded-full bg-[var(--background)] p-px">
        <ToolLineLogo />
      </div>
      <div className="min-h-0 flex-1" />
    </div>
  )
}

/** Standalone model reasoning while streaming — no text; same chrome as a tool row with shimmer. */
function ThinkingShimmerRow() {
  return (
    <div className="w-full px-1 py-0.5">
      <div className="message-appear flex max-w-[min(100%,36rem)] items-stretch gap-2.5 py-1 text-[13px] leading-snug">
        <ToolLogoColumn connectTop={false} connectBottom={false} />
        <span className="tool-line-shimmer min-w-0">Thinking</span>
      </div>
    </div>
  )
}

function ToolCallRowWithReasoning({
  block,
  variant = 'default',
  connectTop = false,
  connectBottom = false,
}: {
  block: ToolVisualBlock
  variant?: 'default' | 'nested'
  connectTop?: boolean
  connectBottom?: boolean
}) {
  const toolDone = TOOL_UI_DONE_STATES.has(block.state)
  const err = block.state === 'output-error' || block.state === 'output-denied'
  const running = !toolDone && !err
  const label = getDescriptiveToolLabel(block.name, block.toolInput)

  const pad = variant === 'nested' ? 'py-0.5' : 'py-1'

  return (
    <div className="w-full max-w-[min(100%,36rem)]">
      <div className={`flex items-stretch gap-2.5 ${pad} text-[13px] leading-snug`}>
        <ToolLogoColumn connectTop={connectTop} connectBottom={connectBottom} />
        <span
          className={`min-w-0 ${
            running && !err ? 'tool-line-shimmer' : err ? 'text-red-600' : 'text-[var(--tool-line-label)]'
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

function SingleToolCallRow({
  block,
  connectTop,
  connectBottom,
}: {
  block: ToolVisualBlock
  connectTop: boolean
  connectBottom: boolean
}) {
  return (
    <div className="w-full px-1 py-0.5">
      <ToolCallRowWithReasoning block={block} connectTop={connectTop} connectBottom={connectBottom} />
    </div>
  )
}

function ToolCallsCollapsedGroup({
  tools,
  connectTop,
  connectBottom,
}: {
  tools: ToolVisualBlock[]
  connectTop: boolean
  connectBottom: boolean
}) {
  const [open, setOpen] = useState(false)
  const n = tools.length
  const anyRunning = tools.some((t) => !TOOL_UI_DONE_STATES.has(t.state))
  const anyErr = tools.some((t) => t.state === 'output-error' || t.state === 'output-denied')
  const summary =
    anyErr
      ? `${n} tools called`
      : anyRunning
        ? `${n} tools in progress`
        : `${n} tools called`

  return (
    <div className="w-full px-1 py-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-auto w-fit max-w-full items-stretch gap-2.5 rounded-md px-0 py-1 text-left text-[13px] leading-snug text-[var(--tool-line-label)] hover:bg-transparent"
      >
        <ToolLogoColumn connectTop={connectTop} connectBottom={connectBottom} />
        <span className="inline-flex min-w-0 items-center gap-1">
          <span className={`min-w-0 ${anyRunning && !anyErr ? 'tool-line-shimmer' : ''}`}>{summary}</span>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className={`shrink-0 text-[var(--tool-line-chevron)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {tools.map((t, idx) => (
            <ToolCallRowWithReasoning
              key={t.key}
              block={t}
              variant="nested"
              connectTop={idx > 0}
              connectBottom={idx < tools.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BrowserToolBlock({
  block,
  connectTop,
  connectBottom,
}: {
  block: ToolVisualBlock
  connectTop: boolean
  connectBottom: boolean
}) {
  const isDone = block.state === 'output-available'
  const isError = block.state === 'output-error' || block.state === 'output-denied'
  const task = typeof block.toolInput?.task === 'string' ? block.toolInput.task.trim() : ''
  const toolOutput =
    block.toolOutput && typeof block.toolOutput === 'object'
      ? (block.toolOutput as Record<string, unknown>)
      : undefined
  const liveUrl = typeof toolOutput?.liveUrl === 'string' ? toolOutput.liveUrl : null
  const label = getDescriptiveToolLabel('browser_run_task', block.toolInput)
  const running = !isDone && !isError
  const hasDetails = Boolean(task || liveUrl)
  /** After the tool finishes, details start collapsed; user expands with the chevron. */
  const [userExpanded, setUserExpanded] = useState(false)
  const showDetails =
    (running && Boolean(task)) || (isDone && userExpanded && hasDetails)

  if (isError) {
    return (
      <div className="w-full px-1 py-0.5">
        <div className="flex max-w-[min(100%,36rem)] items-stretch gap-2.5 py-1 text-[13px] leading-snug">
          <ToolLogoColumn connectTop={connectTop} connectBottom={connectBottom} />
          <span className="min-w-0 flex-1 text-red-600">{label} — couldn’t complete</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-1 py-0.5">
      <div className="max-w-[min(100%,36rem)]">
        <div className="flex items-stretch gap-2.5 text-[13px] leading-snug">
           <ToolLogoColumn connectTop={connectTop} connectBottom={connectBottom} />
           <div className="min-w-0 flex-1">
             <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
               <span className={running ? 'tool-line-shimmer' : 'text-[var(--tool-line-label)]'}>{label}</span>
              {hasDetails && isDone ? (
                <button
                  type="button"
                  onClick={() => setUserExpanded((open) => !open)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                  aria-label={userExpanded ? 'Collapse browser tool details' : 'Expand browser tool details'}
                >
                  <ChevronDown
                    size={14}
                    strokeWidth={1.75}
                    className={`transition-transform duration-200 ${userExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {hasDetails ? (
          <div
            className={`ml-[26px] overflow-hidden transition-all duration-300 ${showDetails ? 'max-h-[520px] pt-2' : 'max-h-0'}`}
          >
            {showDetails ? (
              <div key={userExpanded ? 'open' : running ? 'streaming' : 'closed'} className="space-y-3 message-appear">
                {task ? (
                  <p className="text-[12px] leading-relaxed text-[var(--muted)]">{task}</p>
                ) : null}
                {liveUrl && isDone ? (
                  <iframe
                    src={liveUrl}
                    title="Browser Use live browser"
                    sandbox="allow-scripts allow-same-origin"
                    className="h-[280px] w-full rounded-xl border border-[var(--border)] bg-[var(--background)]"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function DraftSuggestionCard({
  title,
  description,
  badge,
  reason,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  title: string
  description: string
  badge: string
  reason: string
  primaryLabel: string
  secondaryLabel?: string
  onPrimary: () => void
  onSecondary?: () => void
}) {
  return (
    <div className="w-full px-1 py-1.5">
      <div className="max-w-[min(100%,36rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
              {badge}
            </span>
            <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{title}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">{description}</p>
            <p className="mt-2 text-[11px] text-[var(--muted)]">{reason}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPrimary}
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--foreground)] px-3 py-1.5 text-[12px] font-medium text-[var(--background)] transition-colors hover:opacity-85"
          >
            {primaryLabel}
          </button>
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
            >
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function getMessageImages(msg: { parts?: Array<{ type: string; url?: string; mediaType?: string }> }): string[] {
  if (!msg.parts) return []
  return msg.parts
    .filter((p) => p.type === 'file' && p.url && (p.mediaType?.startsWith('image/') ?? true))
    .map((p) => p.url!)
}

type ChatMessageMetadata = {
  indexedDocuments?: string[]
  replyToTurnId?: string
  replySnippet?: string
  sourceCitations?: SourceCitationMap
  routedModelId?: string
  automationSuggestion?: ChatAutomationSuggestionSummary
}

type DraftModalState =
  | {
      kind: 'automation'
      draft: AutomationDraftSummary
    }
  | {
      kind: 'skill'
      draft: SkillDraftSummary
    }

function getUserMessageDocNames(msg: unknown): string[] {
  const m = msg as { metadata?: ChatMessageMetadata }
  const fromMeta = m.metadata?.indexedDocuments
  if (Array.isArray(fromMeta) && fromMeta.length > 0) return fromMeta
  return []
}

/** Strip `[Indexed documents: …]` from display text and return attachment names (from persisted content). */
function splitUserDisplayText(fullText: string): { bodyText: string; docNames: string[] } {
  const re = /\[Indexed documents:\s*([^\]]+)\]/g
  const docNames: string[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(fullText)) !== null) {
    docNames.push(...match[1]!.split(',').map((s) => s.trim()).filter(Boolean))
  }
  const bodyText = fullText.replace(re, '').replace(/\n{3,}/g, '\n\n').trim()
  return { bodyText, docNames }
}

function getUserTurnId(msg: { id: string; turnId?: string }): string | null {
  if (typeof msg.turnId === 'string' && msg.turnId.trim()) return msg.turnId.trim()
  return msg.id?.trim() || null
}

function getUserReplyThreadMeta(msg: unknown): { replyToTurnId: string; replySnippet: string } | null {
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

function getRoutedModelId(msg: unknown): string | null {
  const m = msg as {
    metadata?: ChatMessageMetadata
    routedModelId?: string
  }
  const routedModelId = m.metadata?.routedModelId?.trim() || m.routedModelId?.trim()
  return routedModelId || null
}

function getAutomationSuggestion(msg: unknown): ChatAutomationSuggestionSummary | null {
  const m = msg as {
    metadata?: ChatMessageMetadata
  }
  return m.metadata?.automationSuggestion ?? null
}

type ServerConversationMessage = {
  id: string
  turnId?: string
  role: 'user' | 'assistant'
  parts: Array<{
    type: string
    text?: string
    url?: string
    mediaType?: string
    fileName?: string
    state?: string
  }>
  model?: string
  metadata?: ChatMessageMetadata
  replyToTurnId?: string
  replySnippet?: string
  routedModelId?: string
}

function messageMatchesLocalTurn(msg: { id?: string; turnId?: string }, turnId: string): boolean {
  const persistedTurnId = msg.turnId?.trim()
  if (persistedTurnId) return persistedTurnId === turnId
  const localId = msg.id?.trim() || ''
  return localId === turnId || localId.startsWith(`${turnId}::`)
}

function replaceAssistantForTurn(
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

function getDraftFromToolBlock(block: ToolVisualBlock):
  | { kind: 'automation'; draft: AutomationDraftSummary }
  | { kind: 'skill'; draft: SkillDraftSummary }
  | null {
  const output =
    block.toolOutput && typeof block.toolOutput === 'object'
      ? (block.toolOutput as Record<string, unknown>)
      : null
  if (!output || output.success !== true) return null

  if (block.name === 'draft_automation_from_chat' && output.draft && typeof output.draft === 'object') {
    return { kind: 'automation', draft: output.draft as AutomationDraftSummary }
  }
  if (block.name === 'draft_skill_from_chat' && output.draft && typeof output.draft === 'object') {
    return { kind: 'skill', draft: output.draft as SkillDraftSummary }
  }
  return null
}

function scrollToExchangeTurn(turnId: string) {
  const safe = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(turnId) : turnId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  document.querySelector(`[data-exchange-turn="${safe}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Act assistant for a user turn: `actChat` mirrors `chat0` until streaming appends the assistant only to `actChat`,
 * so the assistant is at the same index as the user + 1. Falls back to id-based scan inside `actChat`.
 */
function resolveActAssistant(
  chat0Linear: Array<{ id?: string; role: string }>,
  actMsgs: Array<{ id?: string; role: string }>,
  userMsgId: string,
) {
  const i = chat0Linear.findIndex((m) => m.role === 'user' && m.id === userMsgId)
  if (i >= 0) {
    const next = actMsgs[i + 1]
    if (next?.role === 'assistant') return next
  }
  const ui = actMsgs.findIndex((m) => m.id === userMsgId && m.role === 'user')
  if (ui >= 0) {
    for (let j = ui + 1; j < actMsgs.length; j++) {
      const m = actMsgs[j]!
      if (m.role === 'assistant') return m
      if (m.role === 'user') break
    }
  }
  return null
}


async function generateTitle(text: string): Promise<string | null> {
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

// ─── ExchangeBlock ───────────────────────────────────────────────────────────

interface ExchangeBlockProps {
  userMsgId: string
  userBodyText: string
  userDocumentNames: string[]
  userImages: string[]
  exchIdx: number
  /** Model id for this tab — stable key for markdown remount when picker slots change */
  responseModelId: string
  /** Ordered tools, text, and file parts as they appear in the assistant message */
  assistantVisualBlocks: AssistantVisualBlock[]
  isStreaming: boolean
  errorMessage: string | null
  exchModelList: string[]
  selectedTab: number
  onTabSelect: (tabIdx: number) => void
  isLoadingTabs: boolean
  responseInProgress: boolean
  sourceCitations?: SourceCitationMap
  automationSuggestion?: ChatAutomationSuggestionSummary | null
  turnIdForActions: string | null
  modelLabel: string
  onDeleteTurn: () => void
  onReply: () => void
  /** User stopped streaming for this exchange; show notice + footer actions. */
  interrupted?: boolean
  actionsLocked: boolean
  isExiting?: boolean
  replyThreadMeta: { replyToTurnId: string; replySnippet: string } | null
  onJumpToReply: (turnId: string) => void
  onOpenDraft: (state: DraftModalState) => void
}

function ExchangeBlock({
  userMsgId, userBodyText, userDocumentNames, userImages, exchIdx, responseModelId, assistantVisualBlocks, isStreaming, errorMessage,
  exchModelList, selectedTab, onTabSelect, isLoadingTabs, responseInProgress, sourceCitations, automationSuggestion,
  turnIdForActions, modelLabel, onDeleteTurn, onReply, interrupted = false, actionsLocked, isExiting = false, replyThreadMeta, onJumpToReply,
  onOpenDraft,
}: ExchangeBlockProps) {
    const showTextBubble = userBodyText.length > 0
    const assistantPlainText = assistantBlocksToPlainText(assistantVisualBlocks)
    const hasDraftToolCard = assistantVisualBlocks.some(
      (block) => block.kind === 'tool' && !!getDraftFromToolBlock(block),
    )
    const lastTextBlockIndex = (() => {
      let idx = -1
      for (let i = 0; i < assistantVisualBlocks.length; i++) {
        if (assistantVisualBlocks[i]!.kind === 'text') idx = i
      }
      return idx
    })()
    const assistantSegments = useMemo(
      () => buildAssistantVisualSegments(assistantVisualBlocks),
      [assistantVisualBlocks],
    )
    const toolChainFlags = useMemo(() => computeToolChainFlags(assistantSegments), [assistantSegments])
    const responseSettled = !responseInProgress
    const copyPlainText =
      interrupted && !errorMessage
        ? assistantPlainText.trim()
          ? `${assistantPlainText}\n\nResponse was interrupted.`
          : 'Response was interrupted.'
        : assistantPlainText
    const showFooter =
      responseSettled && (assistantPlainText.length > 0 || !!errorMessage || interrupted)
    return (
      <div
        className={`flex flex-col gap-2 message-appear transition-all duration-300 ease-out ${
          isExiting ? 'pointer-events-none opacity-0 -translate-y-1' : 'translate-y-0 opacity-100'
        }`}
        data-exchange-idx={exchIdx}
        data-exchange-turn={turnIdForActions ?? undefined}
      >
        {/* User message */}
        <div className="flex min-w-0 justify-end">
          <div className="flex min-w-0 max-w-[min(92%,36rem)] flex-col items-end gap-2 sm:max-w-[75%]">
            {replyThreadMeta && (
              <button
                type="button"
                onClick={() => onJumpToReply(replyThreadMeta.replyToTurnId)}
                className="mb-1 max-w-full rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-left text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--foreground)]"
              >
                <span className="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
                  <Reply size={12} strokeWidth={1.75} className="shrink-0 text-[var(--muted)]" />
                  Replying to
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[var(--muted)]">{replyThreadMeta.replySnippet}</span>
              </button>
            )}
            {userImages.length > 0 && (
              <div className="flex w-full flex-wrap justify-end gap-1.5">
                {userImages.map((src, i) => (
                  <img key={i} src={src} alt="attached"
                    className="max-w-[200px] max-h-[200px] rounded-xl object-cover" />
                ))}
              </div>
            )}
            {userDocumentNames.length > 0 && (
              <div className="flex w-full flex-wrap justify-end gap-1.5">
                {userDocumentNames.map((name) => (
                  <div
                    key={name}
                    className="flex max-w-[220px] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs text-[var(--muted)] shadow-sm"
                  >
                    <FileText size={13} className="shrink-0 text-[var(--muted)]" />
                    <span className="truncate font-medium text-[var(--foreground)]">{name}</span>
                  </div>
                ))}
              </div>
            )}
            {showTextBubble && (
              <div className="chat-user-bubble ml-auto min-w-0 max-w-full break-words select-text rounded-2xl rounded-br-sm border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-sm leading-relaxed text-[var(--foreground)] sm:px-4">
                <span className="whitespace-pre-wrap">{userBodyText}</span>
              </div>
            )}
          </div>
        </div>

        {/* Inline model tabs — only shown when multiple models are active for this exchange */}
        {exchModelList.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            {exchModelList.map((mId, tabIdx) => {
              const mName = getChatModelDisplayName(mId)
              const isActive = tabIdx === selectedTab
              return (
                <button
                  key={mId}
                  onClick={() => !isLoadingTabs && onTabSelect(tabIdx)}
                  disabled={isLoadingTabs}
                  className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                    isLoadingTabs ? 'cursor-not-allowed opacity-60' : ''
                  } ${
                    isActive ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-[var(--surface-subtle)] text-[var(--muted)] hover:bg-[var(--border)]'
                  }`}
                >
                  {mName}
                </button>
              )
            })}
          </div>
        )}

        {assistantSegments.map((seg, segIdx) => {
          const chain = toolChainFlags[segIdx]!
          if (seg.kind === 'reasoning') {
            const active =
              seg.block.state === 'streaming' ||
              (isStreaming && seg.block.state !== 'done')
            if (!active) return null
            return (
              <ThinkingShimmerRow key={`${exchIdx}-seq-r-${seg.originIndex}-${seg.block.key}`} />
            )
          }
          if (seg.kind === 'browser') {
            return (
              <BrowserToolBlock
                key={`${exchIdx}-seq-${seg.originIndex}-${seg.block.key}`}
                block={seg.block}
                connectTop={chain.chainTop}
                connectBottom={chain.chainBottom}
              />
            )
          }
          if (seg.kind === 'tools') {
            if (seg.tools.length === 1) {
              const t = seg.tools[0]!
              const draft = getDraftFromToolBlock(t)
              if (draft) {
                return (
                  <DraftSuggestionCard
                    key={`${exchIdx}-draft-${seg.originIndex}-${t.key}`}
                    title={draft.kind === 'automation' ? draft.draft.title : draft.draft.name}
                    description={draft.kind === 'automation' ? draft.draft.description : draft.draft.description}
                    badge={draft.kind === 'automation' ? 'Automation Draft' : 'Skill Draft'}
                    reason={draft.kind === 'automation' ? draft.draft.reason : draft.draft.reason}
                    primaryLabel="Review draft"
                    secondaryLabel={draft.kind === 'automation' ? 'Create automation' : 'Save skill'}
                    onPrimary={() => onOpenDraft(draft.kind === 'automation'
                      ? { kind: 'automation', draft: draft.draft }
                      : { kind: 'skill', draft: draft.draft })}
                    onSecondary={() => onOpenDraft(draft.kind === 'automation'
                      ? { kind: 'automation', draft: draft.draft }
                      : { kind: 'skill', draft: draft.draft })}
                  />
                )
              }
              return (
                <SingleToolCallRow
                  key={`${exchIdx}-seq-${seg.originIndex}-${t.key}`}
                  block={t}
                  connectTop={chain.chainTop}
                  connectBottom={chain.chainBottom}
                />
              )
            }
            return (
              <ToolCallsCollapsedGroup
                key={`${exchIdx}-seq-tools-${seg.originIndex}`}
                tools={seg.tools}
                connectTop={chain.chainTop}
                connectBottom={chain.chainBottom}
              />
            )
          }
          if (seg.kind === 'file') {
            const block = seg.block
            const isImg = (block.mediaType?.startsWith('image/') ?? true)
            const isVideo = block.mediaType?.startsWith('video/') ?? false
            if (!isImg && !isVideo) return null
            return (
              <div key={`${exchIdx}-seq-${seg.originIndex}-file`} className="w-full px-1 py-1">
                {isImg ? (
                  <img
                    src={block.url}
                    alt="Generated"
                    className="max-w-full max-h-[320px] rounded-xl border border-[var(--border)] object-contain"
                  />
                ) : (
                  <video
                    src={block.url}
                    controls
                    preload="metadata"
                    playsInline
                    className="max-w-full max-h-[320px] rounded-xl border border-[var(--border)] object-contain"
                  />
                )}
              </div>
            )
          }
          const block = seg.block
          const isLastText = seg.originIndex === lastTextBlockIndex
          return (
            <div
              key={`${exchIdx}-seq-${seg.originIndex}-text`}
              className="w-full px-1 py-1 text-sm leading-relaxed text-[var(--foreground)]"
            >
              <MarkdownMessage
                key={`md-${userMsgId}-${responseModelId}-${seg.originIndex}`}
                text={block.text}
                isStreaming={isStreaming && isLastText}
                sourceCitations={isLastText ? sourceCitations : undefined}
                suppressTypingIndicator
                wordLevelStreaming={wordLevelStreaming}
              />
            </div>
          )
        })}

        {!isStreaming && !errorMessage && automationSuggestion && !hasDraftToolCard ? (
          <DraftSuggestionCard
            title={automationSuggestion.kind === 'automation' ? 'Turn This Into An Automation' : 'Save This As A Skill'}
            description={
              automationSuggestion.kind === 'automation'
                ? 'This Act workflow looks repeatable. Review a draft before saving it into Automations.'
                : 'This workflow looks reusable. Review a draft before saving it as a skill.'
            }
            badge={automationSuggestion.kind === 'automation' ? 'Suggested Automation' : 'Suggested Skill'}
            reason={automationSuggestion.reason}
            primaryLabel="Review draft"
            onPrimary={() =>
              onOpenDraft(
                automationSuggestion.kind === 'automation'
                  ? {
                      kind: 'automation',
                      draft: buildAutomationDraftFromTurn({
                        userText: userBodyText,
                        assistantText: assistantPlainText,
                        reason: automationSuggestion.reason,
                      }),
                    }
                  : {
                      kind: 'skill',
                      draft: buildSkillDraftFromTurn({
                        userText: userBodyText,
                        assistantText: assistantPlainText,
                        reason: automationSuggestion.reason,
                      }),
                    },
              )
            }
          />
        ) : null}

        {responseInProgress && (
          <div className="flex items-center px-1 py-2 min-h-7" aria-live="polite" aria-busy="true">
            <div className="md-typing-indicator" aria-label="Response loading">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {errorMessage && !responseInProgress && (
          <div className="flex justify-start">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs"
              style={{
                background: 'var(--chat-alert-error-bg)',
                borderColor: 'var(--chat-alert-error-border)',
                color: 'var(--chat-alert-error-text)',
              }}
            >
              <AlertCircle size={12} />
              {errorMessage}
            </div>
          </div>
        )}

        {interrupted && responseSettled && !errorMessage && (
          <div className="flex justify-start px-1 py-1">
            <p className="text-sm text-[var(--muted)]">Response was interrupted.</p>
          </div>
        )}

        {showFooter && (
          <div className="message-appear flex items-center gap-1 px-1 pt-0.5">
            <FlashCopyIconButton
              copyText={copyPlainText}
              disabled={copyPlainText.length === 0 || isExiting}
              ariaLabel="Copy response"
            />
            <button
              type="button"
              onClick={onDeleteTurn}
              disabled={!turnIdForActions || actionsLocked || isExiting}
              className="rounded-md p-1.5 text-[var(--muted)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-90 active:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Delete this turn from history"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onReply}
              disabled={isExiting}
              className="rounded-md p-1.5 text-[var(--muted)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-90 active:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Reply"
            >
              <Reply size={14} strokeWidth={1.75} />
            </button>
            <span className="ml-2 min-w-0 text-left text-[11px] text-[var(--muted-light)]">{modelLabel}</span>
          </div>
        )}
      </div>
    )
}

// ─── error label ─────────────────────────────────────────────────────────────

function errorLabel(err: Error | null | undefined): string | null {
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

function FlashCopyIconButton({
  copyText,
  disabled,
  ariaLabel = 'Copy',
}: {
  copyText: string
  disabled?: boolean
  ariaLabel?: string
}) {
  const [showCheck, setShowCheck] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
  }, [])

  const handleClick = async () => {
    if (disabled || !copyText) return
    try {
      await navigator.clipboard.writeText(copyText)
    } catch {
      return
    }
    setShowCheck(true)
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setShowCheck(false)
      timerRef.current = null
    }, 900)
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={disabled || !copyText}
      className={`rounded-md p-1.5 text-[var(--muted)] transition-all duration-200 hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 ${
        showCheck ? 'text-emerald-600 hover:text-emerald-600 hover:bg-[#ecfdf5]' : ''
      }`}
      aria-label={ariaLabel}
    >
      {showCheck ? <Check size={14} strokeWidth={1.75} /> : <Copy size={14} strokeWidth={1.75} />}
    </button>
  )
}

function DraftReviewModal({
  state,
  saving,
  onClose,
  onSaveAutomation,
  onSaveSkill,
}: {
  state: DraftModalState | null
  saving: boolean
  onClose: () => void
  onSaveAutomation: (draft: AutomationDraftSummary) => Promise<void>
  onSaveSkill: (draft: SkillDraftSummary) => Promise<void>
}) {
  if (!state) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl rounded-t-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <h3 className="text-sm font-medium text-[var(--foreground)]">
              {state.kind === 'automation' ? 'Review Automation Draft' : 'Review Skill Draft'}
            </h3>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">
              {state.kind === 'automation' ? state.draft.reason : state.draft.reason}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            aria-label="Close draft review"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 px-4 py-4">
          {state.kind === 'automation' ? (
            <>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <p className="text-sm font-medium text-[var(--foreground)]">{state.draft.title}</p>
                <p className="mt-1 text-[12px] text-[var(--muted)]">{state.draft.description}</p>
                <div className="mt-3 grid gap-2 text-[12px] text-[var(--muted)] sm:grid-cols-2">
                  <p>Mode: {state.draft.mode === 'act' ? 'Act' : 'Ask'}</p>
                  <p>Model: {getChatModelDisplayName(state.draft.modelId)}</p>
                  <p>Confidence: {state.draft.confidence}</p>
                  <p>Integrations: {state.draft.detectedIntegrations.join(', ') || 'None detected'}</p>
                  <p className="sm:col-span-2">
                    Schedule: {state.draft.suggestedSchedule?.label || 'No schedule inferred. You can edit this later in Automations.'}
                  </p>
                </div>
              </div>
              <pre className="max-h-[280px] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-[11px] leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">
                {state.draft.instructionsMarkdown}
              </pre>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <p className="text-sm font-medium text-[var(--foreground)]">{state.draft.name}</p>
                <p className="mt-1 text-[12px] text-[var(--muted)]">{state.draft.description}</p>
                <div className="mt-3 grid gap-2 text-[12px] text-[var(--muted)] sm:grid-cols-2">
                  <p>Confidence: {state.draft.confidence}</p>
                  <p>Integrations: {state.draft.detectedIntegrations.join(', ') || 'None detected'}</p>
                </div>
              </div>
              <pre className="max-h-[280px] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-[11px] leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">
                {state.draft.instructions}
              </pre>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void (state.kind === 'automation' ? onSaveAutomation(state.draft) : onSaveSkill(state.draft))}
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--foreground)] px-3 py-1.5 text-[12px] font-medium text-[var(--background)] transition-colors hover:opacity-85 disabled:opacity-60"
          >
            {saving ? 'Saving…' : state.kind === 'automation' ? 'Create automation' : 'Save skill'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── constants ───────────────────────────────────────────────────────────────

function chatGreetingLine(firstName: string | undefined) {
  const raw = firstName?.trim()
  if (!raw) return 'hi there'
  const word = raw.split(/\s+/)[0] ?? raw
  const nice = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  return `Hi ${nice}!`
}

function sanitizeEmptyChatStarters(prompts: string[], firstName?: string): string[] {
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

const DEFAULT_CHAT_TITLE = 'New Chat'
const CHAT_MODEL_KEY = 'overlay_chat_model'
const ASK_MODEL_SELECTION_MODE_KEY = 'overlay_ask_model_selection_mode'
const IMAGE_MODEL_SELECTION_MODE_KEY = 'overlay_image_model_selection_mode'
const VIDEO_MODEL_SELECTION_MODE_KEY = 'overlay_video_model_selection_mode'
const SELECTED_IMAGE_MODELS_KEY = 'overlay_selected_image_models'
const SELECTED_VIDEO_MODELS_KEY = 'overlay_selected_video_models'
const ACT_MODEL_KEY = 'overlay_act_model'
const COMPOSER_MODE_KEY = 'overlay_composer_mode'
const CHAT_GEN_MODE_KEY = 'overlay_chat_generation_mode'
const VIDEO_SUB_MODE_KEY = 'overlay_video_sub_mode'

const VIDEO_SUB_MODES: { value: VideoSubMode; label: string }[] = [
  { value: 'text-to-video',      label: 'Text to Video' },
  { value: 'image-to-video',     label: 'Image to Video' },
  { value: 'reference-to-video', label: 'Reference to Video' },
  { value: 'motion-control',     label: 'Motion Control' },
  { value: 'video-editing',      label: 'Video Editing' },
]
const VIDEO_SUB_MODE_LABELS = Object.fromEntries(
  VIDEO_SUB_MODES.map(({ value, label }) => [value, label])
) as Record<VideoSubMode, string>

const SUPPORTED_INPUT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

interface GenerationResult {
  type: 'image' | 'video'
  status: 'generating' | 'completed' | 'failed'
  url?: string
  modelUsed?: string
  outputId?: string
  error?: string
  upgradeRequired?: boolean
}

type AskModelSelectionMode = 'single' | 'multiple'

interface ConversationUiState {
  composerMode: 'ask' | 'act'
  selectedActModel: string
  selectedModels: string[]
  askModelSelectionMode: AskModelSelectionMode
  exchangeModes: ('ask' | 'act')[]
  exchangeModels: string[][]
  selectedTabPerExchange: number[]
  activeChatTitle: string | null
  generationResults: Map<number, GenerationResult[]>
  exchangeGenTypes: ('text' | 'image' | 'video')[]
  isFirstMessage: boolean
  orphanModelThreads: Map<string, UIMessage[]>
  lastGeneratedImageUrl: string | null
}

interface ConversationRuntime {
  askChats: [Chat<UIMessage>, Chat<UIMessage>, Chat<UIMessage>, Chat<UIMessage>]
  actChat: Chat<UIMessage>
  hydrated: boolean
  ui: ConversationUiState
}

function cloneGenerationResultsMap(source: Map<number, GenerationResult[]>): Map<number, GenerationResult[]> {
  return new Map(
    Array.from(source.entries()).map(([idx, results]) => [
      idx,
      results.map((result) => ({ ...result })),
    ]),
  )
}

function cloneOrphanModelThreadsMap(source: Map<string, UIMessage[]>): Map<string, UIMessage[]> {
  return new Map(
    Array.from(source.entries()).map(([modelId, thread]) => [
      modelId,
      thread.map((msg) => cloneUiMessageForThread(msg)),
    ]),
  )
}

function cloneConversationUiState(state: ConversationUiState): ConversationUiState {
  return {
    composerMode: state.composerMode,
    selectedActModel: state.selectedActModel,
    selectedModels: [...state.selectedModels],
    askModelSelectionMode: state.askModelSelectionMode,
    exchangeModes: [...state.exchangeModes],
    exchangeModels: state.exchangeModels.map((models) => [...models]),
    selectedTabPerExchange: [...state.selectedTabPerExchange],
    activeChatTitle: state.activeChatTitle,
    generationResults: cloneGenerationResultsMap(state.generationResults),
    exchangeGenTypes: [...state.exchangeGenTypes],
    isFirstMessage: state.isFirstMessage,
    orphanModelThreads: cloneOrphanModelThreadsMap(state.orphanModelThreads),
    lastGeneratedImageUrl: state.lastGeneratedImageUrl,
  }
}

function createConversationUiState(
  overrides: Partial<ConversationUiState> = {},
): ConversationUiState {
  return {
    composerMode: overrides.composerMode ?? 'act',
    selectedActModel: overrides.selectedActModel ?? DEFAULT_MODEL_ID,
    selectedModels: [...(overrides.selectedModels ?? [DEFAULT_MODEL_ID])],
    askModelSelectionMode: overrides.askModelSelectionMode ?? 'single',
    exchangeModes: [...(overrides.exchangeModes ?? [])],
    exchangeModels: (overrides.exchangeModels ?? []).map((models) => [...models]),
    selectedTabPerExchange: [...(overrides.selectedTabPerExchange ?? [])],
    activeChatTitle: overrides.activeChatTitle ?? null,
    generationResults: overrides.generationResults
      ? cloneGenerationResultsMap(overrides.generationResults)
      : new Map(),
    exchangeGenTypes: [...(overrides.exchangeGenTypes ?? [])],
    isFirstMessage: overrides.isFirstMessage ?? true,
    orphanModelThreads: overrides.orphanModelThreads
      ? cloneOrphanModelThreadsMap(overrides.orphanModelThreads)
      : new Map(),
    lastGeneratedImageUrl: overrides.lastGeneratedImageUrl ?? null,
  }
}

function createConversationRuntime(
  chatId: string,
  uiOverrides: Partial<ConversationUiState> = {},
): ConversationRuntime {
  const askChats: ConversationRuntime['askChats'] = [
    new Chat({
      id: `${chatId}:ask:0`,
      transport: new DefaultChatTransport({ api: '/api/app/conversations/ask' }),
    }),
    new Chat({
      id: `${chatId}:ask:1`,
      transport: new DefaultChatTransport({ api: '/api/app/conversations/ask' }),
    }),
    new Chat({
      id: `${chatId}:ask:2`,
      transport: new DefaultChatTransport({ api: '/api/app/conversations/ask' }),
    }),
    new Chat({
      id: `${chatId}:ask:3`,
      transport: new DefaultChatTransport({ api: '/api/app/conversations/ask' }),
    }),
  ]

  return {
    askChats,
    actChat: new Chat({
      id: `${chatId}:act`,
      transport: new DefaultChatTransport({ api: '/api/app/conversations/act' }),
      onFinish: ({ messages }) => {
        askChats[0].messages = [...messages]
      },
    }),
    hydrated: false,
    ui: createConversationUiState(uiOverrides),
  }
}

/** Single image/video cell: mesh placeholder while generating; crossfade → media after load. */
function MediaSlotOutput({
  genType,
  isMulti,
  modelName,
  result,
}: {
  genType: 'image' | 'video'
  isMulti: boolean
  modelName: string
  result: GenerationResult | undefined
}) {
  const singleBoxStyle: React.CSSProperties | undefined =
    !isMulti
      ? genType === 'image'
        ? { width: 208, height: 208, minWidth: 208, minHeight: 208, boxSizing: 'border-box' }
        : { width: 288, height: 160, minWidth: 288, minHeight: 160, boxSizing: 'border-box' }
      : undefined

  const multiFrameClass =
    genType === 'image'
      ? 'h-[320px] w-full sm:h-[420px]'
      : 'h-[210px] w-full sm:h-[240px]'
  const errorFrameClass = isMulti ? `${multiFrameClass} flex items-center justify-center` : ''
  const multiStatusLabel = !result || result.status === 'generating'
    ? (genType === 'image' ? 'Creating image' : 'Creating video')
    : ''

  return (
    <div className={`flex min-w-0 flex-col ${isMulti ? 'w-full gap-1.5' : 'gap-2 self-start'}`}>
      {isMulti ? (
        <div className="h-5 text-xs font-medium text-[var(--muted)]">
          {multiStatusLabel}
        </div>
      ) : (!result || result.status === 'generating') ? (
        <p className="text-xs font-medium text-[var(--muted)]">
          {genType === 'image' ? 'Creating image' : 'Creating video'}
        </p>
      ) : null}

      {!result || result.status === 'generating' ? (
        <div
          className={`media-gen-mesh box-border shrink-0 overflow-hidden rounded-xl border border-[#e4e4e7] ${isMulti ? multiFrameClass : ''}`}
          style={singleBoxStyle}
          aria-hidden
        />
      ) : result.status !== 'completed' || !result.url ? (
        <div
          className={`rounded-xl border ${
            isMulti ? errorFrameClass : 'flex items-center gap-2 px-3 py-2 text-xs'
          }`}
          style={{
            ...(!isMulti ? singleBoxStyle : {}),
            background: 'var(--chat-media-error-bg)',
            borderColor: 'var(--chat-media-error-border)',
            color: 'var(--chat-alert-error-text)',
          }}
        >
          {isMulti ? (
            <div className="mx-auto flex max-w-[240px] flex-col items-center gap-2 px-5 text-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-red-500 shadow-sm">
                <AlertCircle size={18} />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium" style={{ color: 'var(--chat-alert-error-text)' }}>
                  {result.upgradeRequired ? `${genType === 'image' ? 'Image' : 'Video'} generation requires a paid plan` : 'Generation failed'}
                </p>
                {result.upgradeRequired ? (
                  <p className="text-xs leading-relaxed opacity-90">
                    <a href="/pricing" className="underline underline-offset-2 hover:opacity-70">Upgrade here</a> to generate {genType === 'image' ? 'images' : 'videos'}.
                  </p>
                ) : (
                  <p className="text-xs leading-relaxed opacity-90">{result.error ?? 'Please try again.'}</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <AlertCircle size={12} />
              {result.upgradeRequired
                ? <><span>{genType === 'image' ? 'Image' : 'Video'} generation requires a paid plan. </span><a href="/pricing" className="underline underline-offset-2 hover:opacity-70">Upgrade here</a></>
                : (result.error ?? 'Failed')
              }
            </>
          )}
        </div>
      ) : (
        <MediaCompletedReveal
          key={result.url}
          genType={genType}
          isMulti={isMulti}
          modelName={modelName}
          url={result.url}
        />
      )}
    </div>
  )
}

function MediaCompletedReveal({
  genType,
  isMulti,
  modelName,
  url,
}: {
  genType: 'image' | 'video'
  isMulti: boolean
  modelName: string
  url: string
}) {
  const [ready, setReady] = useState(false)
  const frameClass =
    genType === 'image'
      ? isMulti
        ? 'h-[320px] w-full sm:h-[420px]'
        : ''
      : isMulti
        ? 'h-[210px] w-full sm:h-[240px]'
        : ''

  const singleBoxStyle: React.CSSProperties | undefined =
    !isMulti
      ? genType === 'image'
        ? { width: 208, height: 208, minWidth: 208, minHeight: 208, boxSizing: 'border-box' }
        : { width: 288, height: 160, minWidth: 288, minHeight: 160, boxSizing: 'border-box' }
      : undefined

  const markReady = useCallback(() => setReady(true), [])

  return (
    <div
      className={`relative group max-w-full shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] ${isMulti ? 'w-full' : ''} ${frameClass}`}
      style={singleBoxStyle}
    >
      <div
        className={`media-gen-mesh pointer-events-none absolute inset-0 z-10 rounded-xl transition-opacity duration-300 ease-out ${
          ready ? 'opacity-0' : 'opacity-100'
        }`}
        aria-hidden
      />
      {genType === 'image' ? (
        <img
          src={url}
          alt={`Generated by ${modelName}`}
          onLoad={markReady}
          onError={markReady}
          className={`absolute inset-0 z-20 block h-full w-full rounded-xl transition-opacity duration-300 ease-out ${
            isMulti ? 'object-contain object-center' : 'border border-[var(--border)] object-contain'
          } ${ready ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <video
          src={url}
          controls
          preload="metadata"
          playsInline
          onLoadedData={markReady}
          onLoadedMetadata={markReady}
          onCanPlay={markReady}
          onError={markReady}
          className={`absolute inset-0 z-20 block h-full w-full rounded-xl ${isMulti ? 'object-contain object-center' : 'border border-[var(--border)]'} transition-opacity duration-300 ease-out ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-16 bg-gradient-to-b from-black/55 via-black/18 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-3 p-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="min-w-0 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-medium leading-none text-white/95 backdrop-blur-[1px]">
          <span className="block truncate">{modelName}</span>
        </span>
        <a
          href={url}
          download={genType === 'image' ? 'generated.png' : 'generated.mp4'}
          className="pointer-events-auto shrink-0 rounded-full bg-[var(--glass-bg)] p-1.5 shadow-sm transition-colors hover:bg-[var(--surface-elevated)]"
          title="Download"
        >
          <Download size={13} className="text-[var(--foreground)]" />
        </a>
      </div>
      {genType === 'video' && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-300 ease-out group-hover:opacity-0">
          <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white shadow-sm transition-opacity duration-300 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}>
            <Play size={16} fill="currentColor" />
          </span>
        </div>
      )}
    </div>
  )
}

interface RestoredOutputGroup {
  type: 'image' | 'video'
  prompt: string
  modelIds: string[]
  results: GenerationResult[]
  createdAt: number
  turnId?: string | null
}

function groupOutputsIntoExchanges(outputs: ChatOutput[]): RestoredOutputGroup[] {
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

function buildMediaSummary(type: 'image' | 'video', prompt: string, modelIds: string[], completedCount: number, failedCount: number): string {
  const noun = type === 'image' ? (completedCount === 1 ? 'image' : 'images') : (completedCount === 1 ? 'video' : 'videos')
  const modelList = modelIds.join(', ')
  const failureSuffix = failedCount > 0 ? ` ${failedCount} generation${failedCount === 1 ? '' : 's'} failed.` : ''
  return `Generated ${completedCount} ${noun} for the prompt "${prompt}" using ${modelList}.${failureSuffix}`
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ChatInterface({
  userId,
  firstName,
  hideSidebar,
  projectName,
}: {
  userId: string
  firstName?: string
  hideSidebar?: boolean
  projectName?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { settings } = useAppSettings()
  const [wordLevelStreaming] = useWordLevelStreaming()
  const { startSession, completeSession, markRead, setActiveViewer, getUnread, sessions } = useAsyncSessions()
  const activeChatIdRef = useRef<string | null>(null)
  const loadChatRequestRef = useRef(0)
  const runtimesRef = useRef(new Map<string, ConversationRuntime>())
  const emptyRuntimeRef = useRef(createConversationRuntime('__empty__'))

  // Clear active viewer + ref when this tab unmounts so any in-flight .then() sees isActive=false
  useEffect(() => {
    return () => {
      activeChatIdRef.current = null
      setActiveViewer(null)
    }
  }, [setActiveViewer])

  const [chats, setChats] = useState<Conversation[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [composerMode, setComposerMode] = useState<'ask' | 'act'>('act')
  /** Exchange index where the user pressed Stop; cleared on chat switch / new chat. */
  const [interruptedExchangeIdx, setInterruptedExchangeIdx] = useState<number | null>(null)
  const [selectedActModel, setSelectedActModel] = useState<string>(DEFAULT_MODEL_ID)
  const [selectedModels, setSelectedModels] = useState<string[]>([DEFAULT_MODEL_ID])
  const [askModelSelectionMode, setAskModelSelectionMode] = useState<AskModelSelectionMode>('single')
  /** After first paint — avoids free-tier Auto reset racing ahead of localStorage restore. */
  const [chatPrefsHydrated, setChatPrefsHydrated] = useState(false)
  const [isSwitchingChat, setIsSwitchingChat] = useState(false)
  const [exchangeModes, setExchangeModes] = useState<('ask' | 'act')[]>([])

  useEffect(() => {
    const saved = localStorage.getItem(CHAT_MODEL_KEY)
    let restoredSelectedModels: string[] | null = null
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          restoredSelectedModels = parsed.slice(0, 4)
          setSelectedModels(restoredSelectedModels)
        }
      } catch {
        restoredSelectedModels = [saved]
        setSelectedModels(restoredSelectedModels)
      }
    }
    const savedAskSelectionMode = localStorage.getItem(ASK_MODEL_SELECTION_MODE_KEY)
    if (savedAskSelectionMode === 'single' || savedAskSelectionMode === 'multiple') {
      setAskModelSelectionMode(savedAskSelectionMode)
    } else if ((restoredSelectedModels?.length ?? 1) > 1) {
      setAskModelSelectionMode('multiple')
    }
    const savedAct = localStorage.getItem(ACT_MODEL_KEY)
    if (savedAct) setSelectedActModel(savedAct)
    const savedComposerMode = localStorage.getItem(COMPOSER_MODE_KEY)
    if (savedComposerMode === 'ask' || savedComposerMode === 'act') {
      setComposerMode(savedComposerMode)
    }
    const savedMode = localStorage.getItem(CHAT_GEN_MODE_KEY) as GenerationMode | null
    if (savedMode && ['text', 'image', 'video'].includes(savedMode)) setGenerationMode(savedMode)

    const imgMode = localStorage.getItem(IMAGE_MODEL_SELECTION_MODE_KEY)
    if (imgMode === 'single' || imgMode === 'multiple') {
      setImageModelSelectionMode(imgMode)
    }
    const vidMode = localStorage.getItem(VIDEO_MODEL_SELECTION_MODE_KEY)
    if (vidMode === 'single' || vidMode === 'multiple') {
      setVideoModelSelectionMode(vidMode)
    }
    try {
      const rawImg = localStorage.getItem(SELECTED_IMAGE_MODELS_KEY)
      if (rawImg) {
        const parsed = JSON.parse(rawImg) as unknown
        if (Array.isArray(parsed) && parsed.length > 0) {
          const allowed = new Set(IMAGE_MODELS.map((m) => m.id))
          const next = parsed.filter((id): id is string => typeof id === 'string' && allowed.has(id)).slice(0, 4)
          if (next.length > 0) setSelectedImageModels(next)
        }
      }
    } catch {
      /* keep default */
    }
    try {
      const rawVid = localStorage.getItem(SELECTED_VIDEO_MODELS_KEY)
      if (rawVid) {
        const parsed = JSON.parse(rawVid) as unknown
        if (Array.isArray(parsed) && parsed.length > 0) {
          const allowed = new Set(VIDEO_MODELS.map((m) => m.id))
          const next = parsed.filter((id): id is string => typeof id === 'string' && allowed.has(id)).slice(0, 4)
          if (next.length > 0) setSelectedVideoModels(next)
        }
      }
    } catch {
      /* keep default */
    }

    setChatPrefsHydrated(true)
  }, [])

  const [exchangeModels, setExchangeModels] = useState<string[][]>([])
  const [selectedTabPerExchange, setSelectedTabPerExchange] = useState<number[]>([])

  // Tracks the title of the active chat independently of the sidebar `chats` list.
  // Needed for project chats which are excluded from the global chats:list query.
  const [activeChatTitle, setActiveChatTitle] = useState<string | null>(null)

  const [generationMode, setGenerationMode] = useState<GenerationMode>('text')
  const [generationChip, setGenerationChip] = useState<'image' | 'video' | null>(null)
  const [generationResults, setGenerationResults] = useState<Map<number, GenerationResult[]>>(new Map())
  const [exchangeGenTypes, setExchangeGenTypes] = useState<('text' | 'image' | 'video')[]>([])
  const [selectedImageModels, setSelectedImageModels] = useState<string[]>([DEFAULT_IMAGE_MODEL_ID])
  const [selectedVideoModels, setSelectedVideoModels] = useState<string[]>([DEFAULT_VIDEO_MODEL_ID])
  const [imageModelSelectionMode, setImageModelSelectionMode] = useState<AskModelSelectionMode>('single')
  const [videoModelSelectionMode, setVideoModelSelectionMode] = useState<AskModelSelectionMode>('single')
  const [videoSubMode, setVideoSubMode] = useState<VideoSubMode>(() => {
    try {
      const saved = localStorage.getItem(VIDEO_SUB_MODE_KEY)
      return (saved as VideoSubMode | null) ?? 'text-to-video'
    } catch { return 'text-to-video' }
  })
  const lastGeneratedImageUrlRef = useRef<string | null>(null)

  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showVideoSubModePicker, setShowVideoSubModePicker] = useState(false)
  const [hoveredModelId, setHoveredModelId] = useState<string | null>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)
  const [input, setInput] = useState('')
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [isOptimisticLoading, setIsOptimisticLoading] = useState(false)
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const [pendingChatDocuments, setPendingChatDocuments] = useState<PendingChatDocument[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [composerNotice, setComposerNotice] = useState<string | null>(null)
  const [topUpAmountDraftCents, setTopUpAmountDraftCents] = useState(800)
  const [autoTopUpEnabledDraft, setAutoTopUpEnabledDraft] = useState(false)
  const [billingActionLoading, setBillingActionLoading] = useState<'checkout' | 'save' | null>(null)
  /**
   * Empty-chat suggestion chips: defaults show immediately; API merges Convex-persisted / freshly generated prompts.
   */
  const [emptyChatStarters, setEmptyChatStarters] = useState<string[]>(() => sanitizeEmptyChatStarters([...DEFAULT_CHAT_SUGGESTIONS], firstName))

  useEffect(() => {
    let cancelled = false
    let refetchTimer: number | undefined

    const apply = (data: { prompts?: string[]; stale?: boolean }) => {
      if (cancelled) return
      if (Array.isArray(data.prompts) && data.prompts.length === 4) {
        setEmptyChatStarters(sanitizeEmptyChatStarters(data.prompts, firstName))
      }
      if (data.stale) {
        refetchTimer = window.setTimeout(() => {
          if (cancelled) return
          void fetch('/api/app/chat-suggestions', { credentials: 'same-origin' })
            .then((r) => r.json())
            .then((d: { prompts?: string[] }) => {
              if (cancelled) return
              if (Array.isArray(d.prompts) && d.prompts.length === 4) {
                setEmptyChatStarters(sanitizeEmptyChatStarters(d.prompts, firstName))
              }
            })
            .catch(() => {
              /* keep current */
            })
        }, 4500)
      }
    }

    fetch('/api/app/chat-suggestions', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then(apply)
      .catch(() => {
        /* keep defaults */
      })

    return () => {
      cancelled = true
      if (refetchTimer !== undefined) window.clearTimeout(refetchTimer)
    }
  }, [userId, firstName])

  const [replyContext, setReplyContext] = useState<{
    snippet: string
    bodyForModel: string
    replyToTurnId?: string
  } | null>(null)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  /** User turn ids currently playing the delete (fade-out) animation */
  const [exitingTurnIds, setExitingTurnIds] = useState<string[]>([])
  /** Mobile: chat history opens from bottom sheet (primary sidebar is desktop-only). */
  const [mobileChatListOpen, setMobileChatListOpen] = useState(false)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingChatTitle, setEditingChatTitle] = useState('')
  const [draftModalState, setDraftModalState] = useState<DraftModalState | null>(null)
  const [isDraftSaving, setIsDraftSaving] = useState(false)

  useEffect(() => {
    setExitingTurnIds([])
  }, [activeChatId])

  useEffect(() => {
    if (!mobileChatListOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileChatListOpen])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const shouldScrollRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modelPickerRef = useRef<HTMLDivElement>(null)
  const videoSubModePickerRef = useRef<HTMLDivElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const wasStreamingRef = useRef(false)
  // Stores the pending title so loadChats() never overwrites it before the PATCH lands
  const pendingTitleRef = useRef<{ chatId: string; title: string } | null>(null)

  const ensureConversationRuntime = useCallback((chatId: string, uiOverrides?: Partial<ConversationUiState>) => {
    const existing = runtimesRef.current.get(chatId)
    if (existing) {
      if (uiOverrides) {
        existing.ui = createConversationUiState({
          ...existing.ui,
          ...uiOverrides,
          generationResults: uiOverrides.generationResults ?? existing.ui.generationResults,
          orphanModelThreads: uiOverrides.orphanModelThreads ?? existing.ui.orphanModelThreads,
        })
      }
      return existing
    }

    const runtime = createConversationRuntime(chatId, uiOverrides)
    runtimesRef.current.set(chatId, runtime)
    return runtime
  }, [])

  const applyUiStateToView = useCallback((ui: ConversationUiState) => {
    setComposerMode(ui.composerMode)
    setSelectedActModel(ui.selectedActModel)
    setSelectedModels([...ui.selectedModels])
    setAskModelSelectionMode(ui.askModelSelectionMode)
    setExchangeModes([...ui.exchangeModes])
    setExchangeModels(ui.exchangeModels.map((models) => [...models]))
    setSelectedTabPerExchange([...ui.selectedTabPerExchange])
    setActiveChatTitle(ui.activeChatTitle)
    setGenerationResults(cloneGenerationResultsMap(ui.generationResults))
    setExchangeGenTypes([...ui.exchangeGenTypes])
    setIsFirstMessage(ui.isFirstMessage)
    lastGeneratedImageUrlRef.current = ui.lastGeneratedImageUrl
  }, [])

  const buildActiveUiStateSnapshot = useCallback((): ConversationUiState => {
    const activeRuntime = activeChatId ? ensureConversationRuntime(activeChatId) : null
    return createConversationUiState({
      composerMode,
      selectedActModel,
      selectedModels,
      askModelSelectionMode,
      exchangeModes,
      exchangeModels,
      selectedTabPerExchange,
      activeChatTitle,
      generationResults,
      exchangeGenTypes,
      isFirstMessage,
      orphanModelThreads: activeRuntime?.ui.orphanModelThreads,
      lastGeneratedImageUrl: lastGeneratedImageUrlRef.current,
    })
  }, [
    activeChatId,
    activeChatTitle,
    composerMode,
    ensureConversationRuntime,
    exchangeGenTypes,
    exchangeModels,
    exchangeModes,
    generationResults,
    isFirstMessage,
    askModelSelectionMode,
    selectedActModel,
    selectedModels,
    selectedTabPerExchange,
  ])

  const persistActiveRuntimeUiState = useCallback(() => {
    if (!activeChatId) return
    const runtime = ensureConversationRuntime(activeChatId)
    runtime.ui = buildActiveUiStateSnapshot()
    runtime.hydrated = true
  }, [activeChatId, buildActiveUiStateSnapshot, ensureConversationRuntime])

  const updateRuntimeUiState = useCallback((
    chatId: string,
    updater: (prev: ConversationUiState) => ConversationUiState,
  ) => {
    const runtime = ensureConversationRuntime(chatId)
    runtime.ui = updater(cloneConversationUiState(runtime.ui))
    if (activeChatIdRef.current === chatId) {
      applyUiStateToView(runtime.ui)
    }
  }, [applyUiStateToView, ensureConversationRuntime])

  useEffect(() => {
    function handleChatCreated(event: Event) {
      const { detail } = event as CustomEvent<ChatCreatedDetail>
      const nextChat = detail?.chat
      if (!nextChat?._id) return
      setChats((prev) => {
        const existingIndex = prev.findIndex((chat) => chat._id === nextChat._id)
        if (existingIndex === -1) return [nextChat, ...prev]
        const existing = prev[existingIndex]
        const merged = {
          ...existing,
          ...nextChat,
          title: nextChat.title || existing.title,
        }
        const withoutExisting = prev.filter((chat) => chat._id !== nextChat._id)
        return [merged, ...withoutExisting]
      })
    }

    function handleChatTitleUpdated(event: Event) {
      const { detail } = event as CustomEvent<ChatTitleUpdatedDetail>
      if (!detail?.chatId || !detail.title) return
      setChats((prev) => prev.map((chat) => (
        chat._id === detail.chatId ? { ...chat, title: detail.title } : chat
      )))
      updateRuntimeUiState(detail.chatId, (prev) => ({ ...prev, activeChatTitle: detail.title }))
      if (activeChatIdRef.current === detail.chatId) {
        setActiveChatTitle(detail.title)
      }
    }
    window.addEventListener(CHAT_CREATED_EVENT, handleChatCreated)
    window.addEventListener(CHAT_TITLE_UPDATED_EVENT, handleChatTitleUpdated)
    return () => {
      window.removeEventListener(CHAT_CREATED_EVENT, handleChatCreated)
      window.removeEventListener(CHAT_TITLE_UPDATED_EVENT, handleChatTitleUpdated)
    }
  }, [updateRuntimeUiState])

  const activeRuntime = activeChatId ? ensureConversationRuntime(activeChatId) : emptyRuntimeRef.current
  const chat0 = useChat({ chat: activeRuntime.askChats[0] })
  const chat1 = useChat({ chat: activeRuntime.askChats[1] })
  const chat2 = useChat({ chat: activeRuntime.askChats[2] })
  const chat3 = useChat({ chat: activeRuntime.askChats[3] })
  const actChat = useChat({ chat: activeRuntime.actChat })

  const chatInstances = useMemo(() => [chat0, chat1, chat2, chat3], [chat0, chat1, chat2, chat3])
  const activeAskChats = activeRuntime.askChats

  const remapChatSlotsForNewModelOrder = useCallback((prevOrder: string[], nextOrder: string[]) => {
    const snapshots = activeAskChats.map((chat) => [...chat.messages])
    const byModel = new Map<string, UIMessage[]>()
    prevOrder.forEach((id, j) => {
      byModel.set(id, snapshots[j]!)
    })
    const orphan = activeRuntime.ui.orphanModelThreads
    for (const id of prevOrder) {
      if (!nextOrder.includes(id)) {
        const j = prevOrder.indexOf(id)
        const snap = j >= 0 ? snapshots[j] : undefined
        if (snap) orphan.set(id, [...snap])
      }
    }
    for (let i = 0; i < 4; i++) {
      if (i < nextOrder.length) {
        const mid = nextOrder[i]!
        let thread = byModel.get(mid)
        if (!thread) {
          const o = orphan.get(mid)
          if (o) {
            thread = [...o]
            orphan.delete(mid)
          }
        }
        if (thread) activeAskChats[i].messages = thread
        else {
          const synth = buildSynthesizedThreadForPickerSlot(
            prevOrder,
            snapshots,
            CHAT_MODEL_QUALITY_PRIORITY,
            i,
          )
          activeAskChats[i].messages = synth
        }
      } else {
        activeAskChats[i].messages = []
      }
    }
  }, [activeAskChats, activeRuntime.ui.orphanModelThreads])

  const isActiveLoading =
    activeAskChats
      .slice(0, selectedModels.length)
      .some((c) => c.status === 'streaming' || c.status === 'submitted') ||
    actChat.status === 'streaming' ||
    actChat.status === 'submitted'

  const supportsVision =
    composerMode === 'act'
      ? (getModel(selectedActModel)?.supportsVision ?? false)
      : selectedModels.every((id) => getModel(id)?.supportsVision ?? false)

  const isFreeTier = (entitlements?.planKind ?? (entitlements?.tier === 'free' ? 'free' : 'paid')) === 'free'
  const premiumModelBlocked =
    isFreeTier &&
    (composerMode === 'act'
      ? selectedActModel !== FREE_TIER_AUTO_MODEL_ID
      : selectedModels.some((id) => id !== FREE_TIER_AUTO_MODEL_ID))
  const creditsExhausted =
    !isFreeTier &&
    entitlements != null &&
    (entitlements.budgetTotalCents ?? entitlements.creditsTotal * 100) > 0 &&
    (entitlements.budgetUsedCents ?? entitlements.creditsUsed) >= (entitlements.budgetTotalCents ?? entitlements.creditsTotal * 100)
  const isSendBlocked = premiumModelBlocked || creditsExhausted

  useEffect(() => {
    persistActiveRuntimeUiState()
  }, [persistActiveRuntimeUiState])

  useEffect(() => {
    if (!chatPrefsHydrated || !isFreeTier || activeChatId) return
    const askAlreadyAuto =
      selectedModels.length === 1 && selectedModels[0] === FREE_TIER_AUTO_MODEL_ID
    const actAlreadyAuto = selectedActModel === FREE_TIER_AUTO_MODEL_ID
    if (askAlreadyAuto && actAlreadyAuto) return

    setSelectedModels([FREE_TIER_AUTO_MODEL_ID])
    setAskModelSelectionMode('single')
    setSelectedActModel(FREE_TIER_AUTO_MODEL_ID)
    localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify([FREE_TIER_AUTO_MODEL_ID]))
    localStorage.setItem(ASK_MODEL_SELECTION_MODE_KEY, 'single')
    localStorage.setItem(ACT_MODEL_KEY, FREE_TIER_AUTO_MODEL_ID)
  }, [chatPrefsHydrated, activeChatId, isFreeTier, selectedActModel, selectedModels])

  useEffect(() => {
    localStorage.setItem(COMPOSER_MODE_KEY, composerMode)
  }, [composerMode])

  // ── data loading ──────────────────────────────────────────────────────────

  const loadSubscription = useCallback(async () => {
    try {
      const res = await fetch('/api/app/subscription')
      if (res.ok) {
        const data = await res.json()
        setEntitlements(data)
        setTopUpAmountDraftCents(data.topUpAmountCents ?? data.autoTopUpAmountCents ?? 800)
        setAutoTopUpEnabledDraft(Boolean(data.autoTopUpEnabled))
      }
    } catch { /* ignore */ }
  }, [])

  const buildTopUpReturnPath = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams?.toString() ?? '')
    nextParams.delete('topup_success')
    nextParams.delete('topup_session_id')
    nextParams.delete('topup_canceled')
    const query = nextParams.toString()
    return `${pathname}${query ? `?${query}` : ''}`
  }, [pathname, searchParams])

  const handleStartTopUp = useCallback(async () => {
    setBillingActionLoading('checkout')
    try {
      const response = await fetch('/api/topups/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: topUpAmountDraftCents,
          autoTopUpEnabled: autoTopUpEnabledDraft,
          returnPath: buildTopUpReturnPath(),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.url) {
        setComposerNotice(data.error || 'Failed to start top-up checkout.')
        return
      }
      window.location.href = data.url
    } catch {
      setComposerNotice('Failed to start top-up checkout.')
    } finally {
      setBillingActionLoading(null)
    }
  }, [autoTopUpEnabledDraft, buildTopUpReturnPath, topUpAmountDraftCents])

  const handleSaveTopUpPreference = useCallback(async () => {
    setBillingActionLoading('save')
    try {
      const response = await fetch('/api/subscription/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoTopUpEnabled: autoTopUpEnabledDraft,
          topUpAmountCents: topUpAmountDraftCents,
          grantOffSessionConsent: autoTopUpEnabledDraft,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setComposerNotice(data.error || 'Failed to save top-up preference.')
        return
      }
      await loadSubscription()
      setComposerNotice('Top-up preference updated.')
      window.setTimeout(() => setComposerNotice((current) => current === 'Top-up preference updated.' ? null : current), 5000)
    } catch {
      setComposerNotice('Failed to save top-up preference.')
    } finally {
      setBillingActionLoading(null)
    }
  }, [autoTopUpEnabledDraft, loadSubscription, topUpAmountDraftCents])

  useEffect(() => {
    const topUpSuccess = searchParams?.get('topup_success') === 'true'
    const topUpSessionId = searchParams?.get('topup_session_id')
    const topUpCanceled = searchParams?.get('topup_canceled') === 'true'

    if (!topUpSuccess && !topUpCanceled) return

    const nextParams = new URLSearchParams(searchParams?.toString() ?? '')
    nextParams.delete('topup_success')
    nextParams.delete('topup_session_id')
    nextParams.delete('topup_canceled')
    const nextUrl = `${pathname}${nextParams.toString() ? `?${nextParams.toString()}` : ''}`

    if (topUpCanceled) {
      setComposerNotice('Top-up checkout canceled.')
      router.replace(nextUrl)
      return
    }

    if (!topUpSessionId) return

    let cancelled = false
    void fetch('/api/topups/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: topUpSessionId }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (cancelled) return
        if (response.ok) {
          setComposerNotice(`Top-up applied: $${(Number(data.amountCents ?? 0) / 100).toFixed(2)}.`)
          await loadSubscription()
        } else {
          setComposerNotice(data.error || 'We could not verify your top-up.')
        }
      })
      .catch(() => {
        if (!cancelled) setComposerNotice('We could not verify your top-up.')
      })
      .finally(() => {
        if (!cancelled) router.replace(nextUrl)
      })

    return () => {
      cancelled = true
    }
  }, [loadSubscription, pathname, router, searchParams])

  // Snapshot pendingTitleRef before the async fetch so a concurrent PATCH completing mid-flight
  // can't clear the ref before we've applied the override to the incoming server chats.
  const loadChats = useCallback(async () => {
    try {
      const pending = pendingTitleRef.current
      const res = await fetch('/api/app/conversations')
      if (res.ok) {
        const serverChats: Conversation[] = await res.json()
        setChats(
          pending
            ? serverChats.map((c) => (c._id === pending.chatId ? { ...c, title: pending.title } : c))
            : serverChats
        )
        // Clear the ref once the server has confirmed the title
        if (pending && serverChats.some((c) => c._id === pending.chatId && c.title === pending.title)) {
          if (pendingTitleRef.current?.chatId === pending.chatId) pendingTitleRef.current = null
        }
      }
    } catch { /* ignore */ }
  }, [])

  // Update title in local state + pendingTitleRef immediately, then broadcast.
  const applyChatTitleUpdate = useCallback((chatId: string, title: string) => {
    const nextTitle = sanitizeChatTitle(title, DEFAULT_CHAT_TITLE)
    pendingTitleRef.current = { chatId, title: nextTitle }
    setChats((prev) => {
      const exists = prev.some((c) => c._id === chatId)
      if (!exists) {
        // Chat not yet in local state (edge case: generateTitle resolved before createNewChat state settled)
        return [{ _id: chatId, title: nextTitle, lastModified: Date.now() }, ...prev]
      }
      return prev.map((c) => (c._id === chatId ? { ...c, title: nextTitle } : c))
    })
    updateRuntimeUiState(chatId, (prev) => ({ ...prev, activeChatTitle: nextTitle }))
    if (activeChatIdRef.current === chatId) {
      setActiveChatTitle((prev) => prev !== null ? nextTitle : prev)
    }
    dispatchChatTitleUpdated({ chatId, title: nextTitle })
    return nextTitle
  }, [updateRuntimeUiState])

  const beginChatRename = useCallback((chatId: string, title: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setEditingChatId(chatId)
    setEditingChatTitle(title)
  }, [])

  const cancelChatRename = useCallback(() => {
    setEditingChatId(null)
    setEditingChatTitle('')
  }, [])

  const commitChatRename = useCallback(async (chatId: string) => {
    const previousTitle =
      chats.find((chat) => chat._id === chatId)?.title ??
      (activeChatIdRef.current === chatId ? activeChatTitle ?? DEFAULT_CHAT_TITLE : DEFAULT_CHAT_TITLE)
    const nextTitle = sanitizeChatTitle(editingChatTitle, previousTitle)

    cancelChatRename()
    if (nextTitle === previousTitle) return

    applyChatTitleUpdate(chatId, nextTitle)

    try {
      const res = await fetch('/api/app/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: chatId, title: nextTitle }),
      })
      if (!res.ok) throw new Error('Failed to rename chat')
    } catch {
      applyChatTitleUpdate(chatId, previousTitle)
    } finally {
      void loadChats()
    }
  }, [activeChatTitle, applyChatTitleUpdate, cancelChatRename, chats, editingChatTitle, loadChats])

  // Called on the first message of a new chat. Immediately shows a fallback title,
  // then replaces it with the GPT OSS 20B-generated title once it arrives.
  const startFirstMessageRename = useCallback((chatId: string, text: string) => {
    const fallbackTitle = applyChatTitleUpdate(chatId, text)

    void generateTitle(text).then(async (aiTitle) => {
      const finalTitle = applyChatTitleUpdate(chatId, aiTitle || fallbackTitle)
      try {
        const res = await fetch('/api/app/conversations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: chatId, title: finalTitle }),
        })
        if (res.ok) void loadChats()
      } catch { /* keep local title */ }
    })
  }, [applyChatTitleUpdate, loadChats])

  useEffect(() => { loadChats(); loadSubscription() }, [loadChats, loadSubscription])

  useEffect(() => {
    if (!activeChatId) return
    const t = window.setTimeout(() => {
      void fetch('/api/app/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeChatId,
          lastMode: composerMode,
          askModelIds: selectedModels,
          actModelId: selectedActModel,
        }),
      })
    }, 600)
    return () => clearTimeout(t)
  }, [composerMode, selectedModels, selectedActModel, activeChatId])

  // Auto-load a specific chat when embedded in project view (`id` = conversation)
  const showOwnSidebar = !hideSidebar && settings.useSecondarySidebar
  const idParam = searchParams?.get('id') ?? null
  /** When chat is opened inside a project, files/docs attach to this project for search scoping. */
  const rawEmbedProjectId = hideSidebar ? searchParams?.get('projectId')?.trim() ?? null : null
  const embedProjectId =
    rawEmbedProjectId &&
    /^[a-z0-9]+$/i.test(rawEmbedProjectId) &&
    rawEmbedProjectId.length >= 16 &&
    rawEmbedProjectId.length <= 64
      ? rawEmbedProjectId
      : null
  // Skip reloading the same chat we just created/switched to locally; otherwise the
  // route update can race the optimistic first-turn state and snap the UI back to empty.
  useEffect(() => {
    if (!idParam || activeChatIdRef.current === idParam) return
    void loadChat(idParam)
    // `loadChat` is intentionally excluded so this only reacts to route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam])

  useEffect(() => {
    if (wasStreamingRef.current && !isActiveLoading && chat0.messages.length > 0) {
      loadSubscription()
    }
    wasStreamingRef.current = isActiveLoading
    if (isActiveLoading) setIsOptimisticLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveLoading, chat0.messages.length])

  useEffect(() => {
    if (shouldScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      shouldScrollRef.current = false
    }
  }, [chat0.messages, actChat.messages])

  useEffect(() => {
    if (!showModelPicker) {
      setHoveredModelId(null)
      return
    }
    function handleOutside(e: MouseEvent) {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node))
        setShowModelPicker(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowModelPicker(false)
    }
    document.addEventListener('mousedown', handleOutside, true)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside, true)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showModelPicker])

  useEffect(() => {
    if (!showVideoSubModePicker) return
    function handleOutside(e: MouseEvent) {
      if (videoSubModePickerRef.current && !videoSubModePickerRef.current.contains(e.target as Node))
        setShowVideoSubModePicker(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowVideoSubModePicker(false)
    }
    document.addEventListener('mousedown', handleOutside, true)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside, true)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showVideoSubModePicker])

  useEffect(() => {
    if (!showAttachMenu) return
    function handleOutside(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node))
        setShowAttachMenu(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showAttachMenu])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const maxHeight = 160
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [input])

  // ── response lookup ────────────────────────────────────────────────────────

  function getResponseForExchangeForModel(modelId: string, exchIdx: number): UIMessage | null {
    const liveIdx = selectedModels.indexOf(modelId)
    const msgs =
      liveIdx >= 0
        ? activeAskChats[liveIdx].messages
        : activeRuntime.ui.orphanModelThreads.get(modelId) ?? []
    let uCount = 0
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].role === 'user') {
        if (uCount === exchIdx) {
          for (let j = i + 1; j < msgs.length; j++) {
            if (msgs[j].role === 'assistant') return msgs[j]
            if (msgs[j].role === 'user') break
          }
          return null
        }
        uCount++
      }
    }
    return null
  }

  // ── stable callbacks ───────────────────────────────────────────────────────

  const handleTabSelect = useCallback((exchIdx: number, tabIdx: number) => {
    setSelectedTabPerExchange((prev) => {
      const next = [...prev]
      next[exchIdx] = tabIdx
      return next
    })
  }, [])

  const beginReplyToAssistantText = useCallback((assistantText: string, targetUserTurnId: string | null) => {
    const t = assistantText.trim()
    if (!t) {
      textareaRef.current?.focus()
      return
    }
    setReplyContext({
      snippet: t.length > 160 ? `${t.slice(0, 160)}…` : t,
      bodyForModel: t.slice(0, 16000),
      ...(targetUserTurnId ? { replyToTurnId: targetUserTurnId } : {}),
    })
    textareaRef.current?.focus()
  }, [])

  const beginReplyToMediaPrompt = useCallback((prompt: string, kind: 'image' | 'video', targetUserTurnId: string | null) => {
    const t = prompt.trim()
    if (!t) {
      textareaRef.current?.focus()
      return
    }
    setReplyContext({
      snippet: t.length > 120 ? `${t.slice(0, 120)}…` : t,
      bodyForModel: `[Prior ${kind} generation request]\n${t.slice(0, 12000)}`,
      ...(targetUserTurnId ? { replyToTurnId: targetUserTurnId } : {}),
    })
    textareaRef.current?.focus()
  }, [])

  const jumpToReplyTarget = useCallback((turnId: string) => {
    scrollToExchangeTurn(turnId)
  }, [])

  const saveAutomationDraft = useCallback(async (draft: AutomationDraftSummary) => {
    setIsDraftSaving(true)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      const res = await fetch('/api/app/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          sourceType: 'inline',
          instructionsMarkdown: draft.instructionsMarkdown,
          mode: draft.mode,
          modelId: draft.modelId,
          status: 'active',
          timezone,
          scheduleKind: draft.suggestedSchedule?.kind ?? 'daily',
          scheduleConfig: draft.suggestedSchedule?.config ?? { localTime: '09:00' },
          ...(embedProjectId ? { projectId: embedProjectId } : {}),
        }),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to create automation draft')
      }
      setDraftModalState(null)
      setComposerNotice('Automation created. Review it in Automations.')
      window.setTimeout(() => setComposerNotice(null), 5000)
    } catch (error) {
      setComposerNotice(error instanceof Error ? error.message : 'Failed to create automation.')
      window.setTimeout(() => setComposerNotice(null), 6000)
    } finally {
      setIsDraftSaving(false)
    }
  }, [embedProjectId])

  const saveSkillDraft = useCallback(async (draft: SkillDraftSummary) => {
    setIsDraftSaving(true)
    try {
      const res = await fetch('/api/app/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          instructions: draft.instructions,
          enabled: true,
          ...(embedProjectId ? { projectId: embedProjectId } : {}),
        }),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to save skill draft')
      }
      setDraftModalState(null)
      setComposerNotice('Skill saved. It will now be available in chat.')
      window.setTimeout(() => setComposerNotice(null), 5000)
    } catch (error) {
      setComposerNotice(error instanceof Error ? error.message : 'Failed to save skill.')
      window.setTimeout(() => setComposerNotice(null), 6000)
    } finally {
      setIsDraftSaving(false)
    }
  }, [embedProjectId])

  const handleComposerModeChange = useCallback((next: 'ask' | 'act') => {
    if (next === 'act') {
      // Keep Act aligned with the primary Ask slot so the picker does not jump to a different model.
      const primary = selectedModels[0] ?? selectedActModel
      setSelectedActModel(primary)
      localStorage.setItem(ACT_MODEL_KEY, primary)
    } else {
      const nextAsk =
        selectedModels.length <= 1
          ? [selectedActModel]
          : [selectedActModel, ...selectedModels.slice(1)].slice(0, 4)
      setSelectedModels(nextAsk)
      localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(nextAsk))
    }
    setComposerMode(next)
  }, [selectedModels, selectedActModel])

  const handleAskModelSelectionModeChange = useCallback((next: AskModelSelectionMode) => {
    if (isActiveLoading || composerMode !== 'ask') return
    if (next === askModelSelectionMode) return

    localStorage.setItem(ASK_MODEL_SELECTION_MODE_KEY, next)
    setAskModelSelectionMode(next)

    if (next === 'single' && selectedModels.length > 1) {
      const prev = [...selectedModels]
      const nextModels = [prev[0]!]
      remapChatSlotsForNewModelOrder(prev, nextModels)
      setSelectedModels(nextModels)
      localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(nextModels))
    }
  }, [askModelSelectionMode, composerMode, isActiveLoading, remapChatSlotsForNewModelOrder, selectedModels])

  const handleImageModelSelectionModeChange = useCallback(
    (next: AskModelSelectionMode) => {
      if (isActiveLoading || generationMode !== 'image') return
      if (next === imageModelSelectionMode) return
      if (isFreeTier && next === 'multiple') return
      localStorage.setItem(IMAGE_MODEL_SELECTION_MODE_KEY, next)
      setImageModelSelectionMode(next)
      if (next === 'single' && selectedImageModels.length > 1) {
        const one = [selectedImageModels[0]!]
        setSelectedImageModels(one)
        localStorage.setItem(SELECTED_IMAGE_MODELS_KEY, JSON.stringify(one))
      }
    },
    [generationMode, imageModelSelectionMode, isActiveLoading, isFreeTier, selectedImageModels],
  )

  const handleVideoModelSelectionModeChange = useCallback(
    (next: AskModelSelectionMode) => {
      if (isActiveLoading || generationMode !== 'video') return
      if (next === videoModelSelectionMode) return
      if (isFreeTier && next === 'multiple') return
      localStorage.setItem(VIDEO_MODEL_SELECTION_MODE_KEY, next)
      setVideoModelSelectionMode(next)
      if (next === 'single' && selectedVideoModels.length > 1) {
        const one = [selectedVideoModels[0]!]
        setSelectedVideoModels(one)
        localStorage.setItem(SELECTED_VIDEO_MODELS_KEY, JSON.stringify(one))
      }
    },
    [generationMode, videoModelSelectionMode, isActiveLoading, isFreeTier, selectedVideoModels],
  )

  function handleVideoSubModeChange(subMode: VideoSubMode) {
    if (isActiveLoading) return
    setVideoSubMode(subMode)
    try { localStorage.setItem(VIDEO_SUB_MODE_KEY, subMode) } catch { /* ignore */ }
    const models = getVideoModelsBySubMode(subMode)
    const first = models[0]?.id
    if (first && !models.some((m) => selectedVideoModels.includes(m.id))) {
      setSelectedVideoModels([first])
      try { localStorage.setItem(SELECTED_VIDEO_MODELS_KEY, JSON.stringify([first])) } catch { /* ignore */ }
    }
  }

  function toggleImageModelInPicker(modelId: string) {
    if (isActiveLoading) return
    if (imageModelSelectionMode === 'single') {
      if (selectedImageModels.length === 1 && selectedImageModels[0] === modelId) return
      const next = [modelId]
      setSelectedImageModels(next)
      localStorage.setItem(SELECTED_IMAGE_MODELS_KEY, JSON.stringify(next))
      setShowModelPicker(false)
      return
    }
    const isSel = selectedImageModels.includes(modelId)
    if (isSel) {
      if (selectedImageModels.length === 1) return
      const next = selectedImageModels.filter((x) => x !== modelId)
      setSelectedImageModels(next)
      localStorage.setItem(SELECTED_IMAGE_MODELS_KEY, JSON.stringify(next))
    } else {
      if (selectedImageModels.length >= 4) return
      const next = [...selectedImageModels, modelId]
      setSelectedImageModels(next)
      localStorage.setItem(SELECTED_IMAGE_MODELS_KEY, JSON.stringify(next))
    }
  }

  function toggleVideoModelInPicker(modelId: string) {
    if (isActiveLoading) return
    if (videoModelSelectionMode === 'single') {
      if (selectedVideoModels.length === 1 && selectedVideoModels[0] === modelId) return
      const next = [modelId]
      setSelectedVideoModels(next)
      localStorage.setItem(SELECTED_VIDEO_MODELS_KEY, JSON.stringify(next))
      setShowModelPicker(false)
      return
    }
    const isSel = selectedVideoModels.includes(modelId)
    if (isSel) {
      if (selectedVideoModels.length === 1) return
      const next = selectedVideoModels.filter((x) => x !== modelId)
      setSelectedVideoModels(next)
      localStorage.setItem(SELECTED_VIDEO_MODELS_KEY, JSON.stringify(next))
    } else {
      if (selectedVideoModels.length >= 4) return
      const next = [...selectedVideoModels, modelId]
      setSelectedVideoModels(next)
      localStorage.setItem(SELECTED_VIDEO_MODELS_KEY, JSON.stringify(next))
    }
  }

  // ── chat management ────────────────────────────────────────────────────────

  function clearTransientComposerState() {
    setPendingChatDocuments([])
    setReplyContext(null)
    setAttachmentError(null)
    setComposerNotice(null)
  }

  function clearRuntimeMessages(runtime: ConversationRuntime) {
    runtime.askChats.forEach((chat) => {
      chat.messages = []
    })
    runtime.actChat.messages = []
  }

  function resetRuntimeState(runtime: ConversationRuntime, uiOverrides: Partial<ConversationUiState> = {}) {
    clearRuntimeMessages(runtime)
    runtime.ui = createConversationUiState(uiOverrides)
  }

  function syncStandaloneChatUrl(chatId: string | null) {
    if (hideSidebar) return
    router.replace(chatId ? `/app/chat?id=${encodeURIComponent(chatId)}` : '/app/chat')
  }

  async function createNewChat(): Promise<string | null> {
    persistActiveRuntimeUiState()
    const res = await fetch('/api/app/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: DEFAULT_CHAT_TITLE,
        askModelIds: selectedModels,
        actModelId: selectedActModel,
        lastMode: composerMode,
        ...(embedProjectId ? { projectId: embedProjectId } : {}),
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setInterruptedExchangeIdx(null)
      const newChat: Conversation = {
        _id: data.id,
        title: DEFAULT_CHAT_TITLE,
        lastModified: Date.now(),
        lastMode: composerMode,
        askModelIds: selectedModels,
        actModelId: selectedActModel,
      }
      setChats((prev) => [newChat, ...prev])
      dispatchChatCreated({ chat: newChat })
      const runtime = ensureConversationRuntime(data.id, {
        composerMode,
        selectedActModel,
        selectedModels,
        askModelSelectionMode,
        activeChatTitle: DEFAULT_CHAT_TITLE,
        isFirstMessage: true,
      })
      resetRuntimeState(runtime, {
        composerMode,
        selectedActModel,
        selectedModels,
        askModelSelectionMode,
        activeChatTitle: DEFAULT_CHAT_TITLE,
        isFirstMessage: true,
      })
      runtime.hydrated = true
      activeChatIdRef.current = data.id
      setActiveViewer(data.id)
      setActiveChatId(data.id)
      syncStandaloneChatUrl(data.id)
      applyUiStateToView(runtime.ui)
      clearTransientComposerState()
      return data.id
    }
    return null
  }

  async function loadChat(chatId: string) {
    const requestId = ++loadChatRequestRef.current
    persistActiveRuntimeUiState()
    clearTransientComposerState()
    setInterruptedExchangeIdx(null)
    markRead(chatId)
    activeChatIdRef.current = chatId
    setActiveViewer(chatId)
    setActiveChatId(chatId)
    syncStandaloneChatUrl(chatId)
    const runtime = ensureConversationRuntime(chatId)
    pendingTitleRef.current = null

    // Fast path: runtime already loaded — switch instantly with no spinner or API calls.
    if (runtime.hydrated) {
      applyUiStateToView(runtime.ui)
      return
    }

    const existingChat = chats.find((chat) => chat._id === chatId)
    setIsSwitchingChat(true)
    runtime.hydrated = false
    try {
      const [messagesRes, outputsRes, metaRes] = await Promise.all([
        fetch(`/api/app/conversations?conversationId=${chatId}&messages=true`),
        fetch(`/api/app/outputs?conversationId=${chatId}`),
        fetch(`/api/app/conversations?conversationId=${chatId}`),
      ])
      if (requestId !== loadChatRequestRef.current) return
      if (!messagesRes.ok) {
        clearRuntimeMessages(runtime)
        runtime.hydrated = false
        setComposerNotice('Could not load chat messages. Try again.')
        window.setTimeout(() => setComposerNotice(null), 5000)
        return
      }
      const data = await messagesRes.json()
      if (requestId !== loadChatRequestRef.current) return
      type RawMsg = {
        id: string
        turnId?: string
        mode?: 'ask' | 'act'
        role: 'user' | 'assistant'
        parts: Array<{
          type: string
          text?: string
          url?: string
          mediaType?: string
          fileName?: string
        }>
        model?: string
        metadata?: ChatMessageMetadata
        replyToTurnId?: string
        replySnippet?: string
        routedModelId?: string
      }
      let rawMessages: RawMsg[] = data.messages || []
      rawMessages = rawMessages.map((msg) => {
        if (msg.role !== 'user' || !msg.replyToTurnId?.trim()) return msg
        return {
          ...msg,
          metadata: {
            ...(msg.metadata ?? {}),
            replyToTurnId: msg.replyToTurnId.trim(),
            ...(msg.replySnippet ? { replySnippet: msg.replySnippet } : {}),
          },
        }
      })

      const outputs: ChatOutput[] = outputsRes.ok ? await outputsRes.json() : []
      if (requestId !== loadChatRequestRef.current) return
      const outputGroups = groupOutputsIntoExchanges(outputs)

      if (rawMessages.length === 0 && outputGroups.length > 0) {
        rawMessages = outputGroups.map((group, idx) => ({
          id: `restored-output-${idx}`,
          turnId: `out-${idx}`,
          mode: 'ask' as const,
          role: 'user' as const,
          parts: [{ type: 'text', text: group.prompt }],
        }))
      }

      const hasUserMessages = rawMessages.some((msg) => msg.role === 'user')
      let resolvedTitle = existingChat?.title ?? null
      let resolvedComposerMode = existingChat?.lastMode ?? composerMode
      let resolvedSelectedModels = existingChat?.askModelIds?.slice(0, 4) ?? selectedModels
      let resolvedActModel = existingChat?.actModelId ?? selectedActModel
      if (metaRes.ok) {
        const meta = await metaRes.json() as {
          title?: string
          lastMode?: 'ask' | 'act'
          askModelIds?: string[]
          actModelId?: string
        }
        if (requestId !== loadChatRequestRef.current) return
        if (meta.title) resolvedTitle = meta.title
        if (meta.lastMode) resolvedComposerMode = meta.lastMode
        if (meta.askModelIds?.length) {
          resolvedSelectedModels = meta.askModelIds.slice(0, 4)
          localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(resolvedSelectedModels))
        }
        if (meta.actModelId) {
          resolvedActModel = meta.actModelId
          localStorage.setItem(ACT_MODEL_KEY, meta.actModelId)
        }
      }

      if (requestId !== loadChatRequestRef.current) return

      const exchanges: Array<{
        userMsg: RawMsg
        responses: Array<{ model: string; msg: RawMsg }>
        mode: 'ask' | 'act'
      }> = []

      const hasTurnIds = rawMessages.some((m) => m.turnId)
      if (hasTurnIds) {
        const turnOrder: string[] = []
        const byTurn = new Map<string, { user?: RawMsg; assistants: RawMsg[] }>()
        for (const msg of rawMessages) {
          const tid = msg.turnId || msg.id
          if (!byTurn.has(tid)) {
            byTurn.set(tid, { assistants: [] })
            turnOrder.push(tid)
          }
          const g = byTurn.get(tid)!
          if (msg.role === 'user') g.user = msg
          else g.assistants.push(msg)
        }
        for (const tid of turnOrder) {
          const g = byTurn.get(tid)!
          if (!g.user && g.assistants.length > 0) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[ChatInterface] Orphan assistant rows without user message for turn', tid)
            }
            const mode = (g.assistants[0]?.mode || 'ask') as 'ask' | 'act'
            const orphanResponses = g.assistants.map((a) => ({
              model: a.model || DEFAULT_MODEL_ID,
              msg: a,
            }))
            const lastEx = exchanges[exchanges.length - 1]
            if (lastEx) {
              for (const r of orphanResponses) {
                lastEx.responses.push(r)
              }
            } else {
              exchanges.push({
                userMsg: {
                  id: `synthetic-user-${tid}`,
                  turnId: tid,
                  role: 'user',
                  mode,
                  parts: [{ type: 'text', text: '[Earlier message unavailable]' }],
                },
                responses: orphanResponses,
                mode,
              })
            }
            continue
          }
          if (!g.user) continue
          const mode = (g.assistants[0]?.mode || g.user.mode || 'ask') as 'ask' | 'act'
          const responses = g.assistants.map((a) => ({
            model: a.model || DEFAULT_MODEL_ID,
            msg: a,
          }))
          exchanges.push({ userMsg: g.user, responses, mode })
        }
      } else {
        let cur: (typeof exchanges)[0] | null = null
        for (const msg of rawMessages) {
          if (msg.role === 'user') {
            if (cur) exchanges.push(cur)
            cur = { userMsg: msg, responses: [], mode: 'ask' }
          } else if (msg.role === 'assistant' && cur) {
            cur.responses.push({ model: msg.model || DEFAULT_MODEL_ID, msg })
          }
        }
        if (cur) exchanges.push(cur)
      }

      const exchangeModesFromServer = exchanges.map((e) => e.mode)
      const uniqueModels: string[] = []
      for (const ex of exchanges) {
        for (const { model } of ex.responses) {
          if (!uniqueModels.includes(model)) uniqueModels.push(model)
        }
      }

      if (requestId !== loadChatRequestRef.current) return

      clearRuntimeMessages(runtime)

      if (uniqueModels.length === 0) {
        const linear: RawMsg[] = []
        for (const ex of exchanges) {
          linear.push(ex.userMsg)
          for (const r of ex.responses) linear.push(r.msg)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        runtime.askChats[0].messages = linear as any
      } else {
        const slotModels = uniqueModels.slice(0, 4)
        localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(slotModels))
        resolvedSelectedModels = slotModels

        slotModels.forEach((modelId, slotIdx) => {
          const msgs: RawMsg[] = []
          for (const ex of exchanges) {
            msgs.push(ex.userMsg)
            if (ex.mode === 'act') {
              const r = ex.responses[0]
              if (r && r.model === modelId) msgs.push(r.msg)
            } else {
              const r = ex.responses.find((x) => x.model === modelId)
              if (r) msgs.push(r.msg)
            }
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          runtime.askChats[slotIdx].messages = msgs as any
        })
      }

      const actLinear: RawMsg[] = []
      for (const ex of exchanges) {
        if (ex.mode !== 'act') continue
        actLinear.push(ex.userMsg)
        if (ex.responses[0]) actLinear.push(ex.responses[0].msg)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runtime.actChat.messages = actLinear as any

      const restoredGenTypes: ('text' | 'image' | 'video')[] = exchanges.map(() => 'text')
      const restoredResults = new Map<number, GenerationResult[]>()
      const restoredExchangeModels = exchanges.map((ex) => ex.responses.map((r) => r.model))

      let nextOutputGroupIdx = 0
      for (let idx = 0; idx < exchanges.length; idx++) {
        const exchangeTurnId = exchanges[idx].userMsg.turnId?.trim() || null
        const userPrompt = getMessageText(exchanges[idx].userMsg).trim()
        const matchIdx = outputGroups.findIndex((group, groupIdx) => {
          if (groupIdx < nextOutputGroupIdx) return false
          // When the user turn has a turnId, only match outputs with the same turnId.
          // Prompt-only matching caused false positives (e.g. image outputs without turnId
          // matching unrelated text turns that shared the same prompt), which hid assistant text.
          if (exchangeTurnId) {
            const gt = group.turnId?.trim() || null
            return gt === exchangeTurnId
          }
          return !group.turnId?.trim() && group.prompt.trim() === userPrompt
        })
        if (matchIdx === -1) continue

        const group = outputGroups[matchIdx]
        nextOutputGroupIdx = matchIdx + 1
        restoredGenTypes[idx] = group.type
        restoredResults.set(idx, group.results)
        restoredExchangeModels[idx] = group.modelIds
      }

      runtime.ui = createConversationUiState({
        composerMode: resolvedComposerMode,
        selectedActModel: resolvedActModel,
        selectedModels: resolvedSelectedModels,
        askModelSelectionMode: resolvedSelectedModels.length > 1 ? 'multiple' : askModelSelectionMode,
        exchangeModes: exchangeModesFromServer,
        exchangeModels: restoredExchangeModels,
        selectedTabPerExchange: exchanges.map(() => 0),
        activeChatTitle: resolvedTitle,
        generationResults: restoredResults,
        exchangeGenTypes: restoredGenTypes,
        isFirstMessage: !hasUserMessages,
      })
      if (requestId !== loadChatRequestRef.current) return
      runtime.hydrated = true
      applyUiStateToView(runtime.ui)
    } catch (err) {
      console.error('[ChatInterface] loadChat failed:', err)
      clearRuntimeMessages(runtime)
      runtime.hydrated = false
      setComposerNotice('Could not load this chat. Try again.')
      window.setTimeout(() => setComposerNotice(null), 5000)
    }
    finally {
      if (requestId === loadChatRequestRef.current) setIsSwitchingChat(false)
    }
  }

  async function handleDeleteTurnById(turnId: string) {
    const cid = activeChatIdRef.current ?? activeChatId
    if (!cid || !turnId) {
      setComposerNotice('Cannot delete this message right now.')
      window.setTimeout(() => setComposerNotice(null), 4000)
      return
    }
    const EXIT_MS = 300
    setExitingTurnIds((prev) => (prev.includes(turnId) ? prev : [...prev, turnId]))
    await new Promise((r) => window.setTimeout(r, EXIT_MS))
    try {
      const res = await fetch('/api/app/conversations/message', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: cid, turnId }),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setComposerNotice(payload.error || 'Could not delete this turn.')
        window.setTimeout(() => setComposerNotice(null), 5000)
        return
      }
      runtimesRef.current.delete(cid)
      await loadChat(cid)
    } catch {
      setComposerNotice('Could not delete this turn.')
      window.setTimeout(() => setComposerNotice(null), 5000)
    } finally {
      setExitingTurnIds((prev) => prev.filter((id) => id !== turnId))
    }
  }

  async function deleteChat(chatId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/app/conversations?conversationId=${chatId}`, { method: 'DELETE' })
    runtimesRef.current.delete(chatId)
    if (activeChatId === chatId) {
      setActiveChatId(null)
      activeChatIdRef.current = null
      pendingTitleRef.current = null
      applyUiStateToView(createConversationUiState({
        composerMode,
        selectedActModel,
        selectedModels,
        askModelSelectionMode,
      }))
      clearTransientComposerState()
      setActiveViewer(null)
      syncStandaloneChatUrl(null)
    }
    await loadChats()
  }

  function removePendingDocument(clientId: string) {
    setPendingChatDocuments((prev) => prev.filter((d) => d.clientId !== clientId))
  }

  function queueDocumentUpload(file: File) {
    const clientId = crypto.randomUUID()
    setAttachmentError(null)
    setPendingChatDocuments((prev) => [...prev, { clientId, name: file.name, status: 'uploading' }])
    const form = new FormData()
    form.append('file', file)
    if (embedProjectId) form.append('projectId', embedProjectId)
    void fetch('/api/app/files/ingest-document', {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          setPendingChatDocuments((prev) =>
            prev.map((d) =>
              d.clientId === clientId
                ? { ...d, status: 'error' as const, error: err.error ?? 'Could not index file' }
                : d,
            ),
          )
          return
        }
        setPendingChatDocuments((prev) =>
          prev.map((d) => (d.clientId === clientId ? { ...d, status: 'ready' as const } : d)),
        )
      })
      .catch(() => {
        setPendingChatDocuments((prev) =>
          prev.map((d) =>
            d.clientId === clientId
              ? { ...d, status: 'error' as const, error: 'Network error' }
              : d,
          ),
        )
      })
  }

  function addDocumentsFromPicker(files: FileList | File[] | null) {
    if (!files?.length) return
    Array.from(files).forEach((file) => queueDocumentUpload(file))
  }

  function addImages(files: FileList | File[]) {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      if (!SUPPORTED_INPUT_IMAGE_TYPES.has(file.type)) {
        setAttachmentError(`Unsupported image format: ${file.name}. Use JPEG, PNG, GIF, or WebP.`)
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        setAttachmentError(null)
        setAttachedImages((prev) => [...prev, { dataUrl, mimeType: file.type, name: file.name }])
      }
      reader.readAsDataURL(file)
    })
  }

  function handlePaste(e: React.ClipboardEvent) {
    const imageFiles = Array.from(e.clipboardData.items)
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f != null)
    if (imageFiles.length > 0) {
      e.preventDefault()
      addImages(imageFiles)
    }
  }

  const effectiveGenType = generationChip ?? (generationMode !== 'text' ? generationMode : null)

async function hydrateCompletedAskTurnFromServer(
    chatId: string,
    turnId: string,
    modelIds: string[],
  ) {
    try {
      const res = await fetch(`/api/app/conversations?conversationId=${encodeURIComponent(chatId)}&messages=true`)
      if (!res.ok) return

      const data = await res.json() as { messages?: ServerConversationMessage[] }
      const allMessages = Array.isArray(data.messages) ? data.messages : []
      const assistantsByModel = new Map<string, ServerConversationMessage>()
      const assistantsInTurn: ServerConversationMessage[] = []

      for (const msg of allMessages) {
        if (msg.role !== 'assistant') continue
        if (!messageMatchesLocalTurn(msg, turnId)) continue
        assistantsInTurn.push(msg)
        const modelKey = msg.model?.trim()
        if (!modelKey) continue
        assistantsByModel.set(modelKey, msg)
      }

      if (assistantsInTurn.length === 0) return

      const runtime = ensureConversationRuntime(chatId)
      const usedAssistantIds = new Set<string>()
      modelIds.forEach((modelId, idx) => {
        const chat = runtime.askChats[idx]
        if (!chat) return

        let serverAssistant = assistantsByModel.get(modelId)
        if (!serverAssistant) {
          serverAssistant = assistantsInTurn.find((msg) => !usedAssistantIds.has(msg.id))
        }
        if (!serverAssistant) return
        usedAssistantIds.add(serverAssistant.id)
        chat.messages = replaceAssistantForTurn(chat.messages, turnId, serverAssistant)
      })
    } catch (err) {
      console.error('[ChatInterface] Failed to hydrate completed assistant turn', err)
    }
  }

  async function handleSend() {
    const replyCtxSnapshot = replyContext
    const text = input.trim()
    const hasReadyDocs = pendingChatDocuments.some((d) => d.status === 'ready')
    const composerModeSnapshot = composerMode
    const selectedModelsSnapshot = [...selectedModels]
    const selectedActModelSnapshot = selectedActModel
    const activeChatTitleSnapshot = activeChatTitle
    const selectedImageModelsSnapshot = [...selectedImageModels]
    const selectedVideoModelsSnapshot = [...selectedVideoModels]
    const attachedImagesSnapshot = [...attachedImages]
    if (isActiveLoading) return

    if (pendingChatDocuments.some((d) => d.status === 'uploading')) {
      setAttachmentError('Wait for documents to finish indexing.')
      return
    }
    if (pendingChatDocuments.some((d) => d.status === 'error')) {
      setAttachmentError('Remove failed documents before sending.')
      return
    }

    setIsOptimisticLoading(true)

    // ── Image / Video generation path ──────────────────────────────────────
    if (effectiveGenType === 'image' || effectiveGenType === 'video') {
      if (!text && attachedImages.length === 0) return
      if (isSendBlocked) return
      const chatId = activeChatId || await createNewChat()
      if (!chatId) return
      const targetRuntime = ensureConversationRuntime(chatId)

      setInput('')
      setAttachedImages([])
      setGenerationChip(null)
      setReplyContext(null)
      const wasFirst = isFirstMessage
      setIsFirstMessage(false)
      shouldScrollRef.current = true

      const promptForModel =
        replyCtxSnapshot?.bodyForModel && text
          ? `${text}\n\n---\n[User is replying in thread to prior content]\n${replyCtxSnapshot.bodyForModel}`
          : text
      const mediaSessionMode = composerModeSnapshot === 'act' ? 'act' : 'ask'

      // Inject a placeholder user message into the primary chat slot so the exchange renders
      const exchIdx = targetRuntime.ui.exchangeModels.length
      const mediaTurnId = crypto.randomUUID()
      const activeModels = effectiveGenType === 'image' ? selectedImageModelsSnapshot : selectedVideoModelsSnapshot
      updateRuntimeUiState(chatId, (prev) => {
        const nextGenerationResults = cloneGenerationResultsMap(prev.generationResults)
        nextGenerationResults.set(
          exchIdx,
          activeModels.map(() => ({ type: effectiveGenType as 'image' | 'video', status: 'generating' as const })),
        )
        return {
          ...prev,
          exchangeModes: [...prev.exchangeModes, composerModeSnapshot],
          exchangeModels: [...prev.exchangeModels, [...activeModels]],
          selectedTabPerExchange: [...prev.selectedTabPerExchange, 0],
          exchangeGenTypes: [...prev.exchangeGenTypes, effectiveGenType],
          generationResults: nextGenerationResults,
          isFirstMessage: false,
        }
      })

      const mediaUserMessageParts: { type: string; text?: string; url?: string; mediaType?: string }[] = []
      if (text) mediaUserMessageParts.push({ type: 'text', text })
      for (const img of attachedImagesSnapshot) {
        mediaUserMessageParts.push({ type: 'file', url: img.dataUrl, mediaType: img.mimeType })
      }
      const mediaUserMessage = {
        id: mediaTurnId,
        role: 'user',
        parts: mediaUserMessageParts,
        ...(replyCtxSnapshot?.replyToTurnId
          ? {
              metadata: {
                replyToTurnId: replyCtxSnapshot.replyToTurnId,
                replySnippet: replyCtxSnapshot.snippet,
              },
            }
          : {}),
      }
      targetRuntime.askChats.slice(0, selectedModelsSnapshot.length).forEach((chat) => {
        chat.messages = [
          ...chat.messages,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mediaUserMessage as any,
        ]
      })
      void fetch('/api/app/conversations/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: chatId,
          turnId: mediaTurnId,
          mode: composerModeSnapshot,
          role: 'user',
          content: text,
          parts: [{ type: 'text', text }],
          modelId: selectedModelsSnapshot[0],
          ...(replyCtxSnapshot?.replyToTurnId
            ? { replyToTurnId: replyCtxSnapshot.replyToTurnId, replySnippet: replyCtxSnapshot.snippet }
            : {}),
        }),
      })

      if (wasFirst && text) startFirstMessageRename(chatId, text)
      startSession(chatId, mediaSessionMode, activeChatTitleSnapshot ?? '', targetRuntime.askChats[0].messages.length)

      // ── Block generation for free-tier users ───────────────────────────────
      if (isFreeTier) {
        setTimeout(() => {
          updateRuntimeUiState(chatId, (prev) => {
            const next = cloneGenerationResultsMap(prev.generationResults)
            const arr = activeModels.map(() => ({
              type: effectiveGenType as 'image' | 'video',
              status: 'failed' as const,
              upgradeRequired: true,
            }))
            next.set(exchIdx, arr)
            return { ...prev, generationResults: next }
          })
          completeSession(chatId, activeChatIdRef.current === chatId)
        }, 5000)
        return
      }

      if (effectiveGenType === 'image') {
        // Prefer an explicitly attached reference image; fall back to the last generated image
        const imageUrl = attachedImagesSnapshot[0]?.dataUrl ?? targetRuntime.ui.lastGeneratedImageUrl
        const generationTasks = activeModels.map((modelId, mIdx) =>
          fetch('/api/app/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptForModel, modelId, conversationId: chatId, turnId: mediaTurnId, imageUrl }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Generation failed' }))
                updateRuntimeUiState(chatId, (prev) => {
                  const next = cloneGenerationResultsMap(prev.generationResults)
                  const arr = [...(next.get(exchIdx) ?? activeModels.map(() => ({ type: 'image' as const, status: 'generating' as const })))]
                  arr[mIdx] = { type: 'image', status: 'failed', error: (err as { message?: string }).message }
                  next.set(exchIdx, arr)
                  return { ...prev, generationResults: next }
                })
                return { ok: false as const, modelId }
              }
              const data = await res.json() as { url?: string; modelUsed?: string; outputId?: string }
              updateRuntimeUiState(chatId, (prev) => {
                const next = cloneGenerationResultsMap(prev.generationResults)
                const arr = [...(next.get(exchIdx) ?? activeModels.map(() => ({ type: 'image' as const, status: 'generating' as const })))]
                arr[mIdx] = {
                  type: 'image',
                  status: 'completed',
                  url: data.url,
                  modelUsed: data.modelUsed,
                  outputId: data.outputId,
                }
                next.set(exchIdx, arr)
                return {
                  ...prev,
                  generationResults: next,
                  lastGeneratedImageUrl: data.url && mIdx === 0 ? data.url : prev.lastGeneratedImageUrl,
                }
              })
              return { ok: true as const, modelId: data.modelUsed ?? modelId }
            })
            .catch((err) => {
              updateRuntimeUiState(chatId, (prev) => {
                const next = cloneGenerationResultsMap(prev.generationResults)
                const arr = [...(next.get(exchIdx) ?? activeModels.map(() => ({ type: 'image' as const, status: 'generating' as const })))]
                arr[mIdx] = { type: 'image', status: 'failed', error: String(err) }
                next.set(exchIdx, arr)
                return { ...prev, generationResults: next }
              })
              return { ok: false as const, modelId }
            })
        )

        void Promise.all(generationTasks).then((results) => {
          const completed = results.filter((r) => r.ok)
          const summary = buildMediaSummary('image', text, activeModels, completed.length, results.length - completed.length)
          const assistantMessage = {
            id: `gen-summary-${Date.now()}`,
            role: 'assistant',
            parts: [{ type: 'text', text: summary }],
          }
          targetRuntime.askChats.slice(0, selectedModelsSnapshot.length).forEach((chat) => {
            chat.messages = [
              ...chat.messages,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              assistantMessage as any,
            ]
          })
          void fetch('/api/app/conversations/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: chatId,
              turnId: mediaTurnId,
              mode: composerModeSnapshot,
              role: 'assistant',
              content: summary,
              contentType: 'text',
              parts: [{ type: 'text', text: summary }],
            }),
          })
          completeSession(chatId, activeChatIdRef.current === chatId)
          loadChats()
          loadSubscription()
        }).catch((err) => {
          console.error('[ChatInterface] Image generation batch failed', err)
          completeSession(chatId, activeChatIdRef.current === chatId)
        })
      } else {
        const generationTasks = activeModels.map((modelId, mIdx) =>
          fetch('/api/app/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptForModel, modelId, conversationId: chatId, turnId: mediaTurnId, videoSubMode, imageUrl: attachedImagesSnapshot[0]?.dataUrl ?? null }),
          })
            .then(async (res) => {
              if (!res.ok) {
                updateRuntimeUiState(chatId, (prev) => {
                  const next = cloneGenerationResultsMap(prev.generationResults)
                  const arr = [...(next.get(exchIdx) ?? activeModels.map(() => ({ type: 'video' as const, status: 'generating' as const })))]
                  arr[mIdx] = { type: 'video', status: 'failed', error: 'Request failed' }
                  next.set(exchIdx, arr)
                  return { ...prev, generationResults: next }
                })
                return { ok: false as const, modelId }
              }
              const reader = res.body?.getReader()
              if (!reader) return { ok: false as const, modelId }
              const decoder = new TextDecoder()
              let buf = ''
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buf += decoder.decode(value, { stream: true })
                const lines = buf.split('\n\n')
                buf = lines.pop() ?? ''
                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue
                  try {
                    const evt = JSON.parse(line.slice(6)) as { type: string; url?: string; modelUsed?: string; outputId?: string; error?: string }
                    if (evt.type === 'completed') {
                      updateRuntimeUiState(chatId, (prev) => {
                        const next = cloneGenerationResultsMap(prev.generationResults)
                        const arr = [...(next.get(exchIdx) ?? activeModels.map(() => ({ type: 'video' as const, status: 'generating' as const })))]
                        arr[mIdx] = {
                          type: 'video',
                          status: 'completed',
                          url: evt.url,
                          modelUsed: evt.modelUsed,
                          outputId: evt.outputId,
                        }
                        next.set(exchIdx, arr)
                        return { ...prev, generationResults: next }
                      })
                      return { ok: true as const, modelId: evt.modelUsed ?? modelId }
                    } else if (evt.type === 'failed') {
                      updateRuntimeUiState(chatId, (prev) => {
                        const next = cloneGenerationResultsMap(prev.generationResults)
                        const arr = [...(next.get(exchIdx) ?? activeModels.map(() => ({ type: 'video' as const, status: 'generating' as const })))]
                        arr[mIdx] = { type: 'video', status: 'failed', error: evt.error }
                        next.set(exchIdx, arr)
                        return { ...prev, generationResults: next }
                      })
                      return { ok: false as const, modelId }
                    }
                  } catch { /* ignore */ }
                }
              }
              return { ok: false as const, modelId }
            })
            .catch((err) => {
              updateRuntimeUiState(chatId, (prev) => {
                const next = cloneGenerationResultsMap(prev.generationResults)
                const arr = [...(next.get(exchIdx) ?? activeModels.map(() => ({ type: 'video' as const, status: 'generating' as const })))]
                arr[mIdx] = { type: 'video', status: 'failed', error: String(err) }
                next.set(exchIdx, arr)
                return { ...prev, generationResults: next }
              })
              return { ok: false as const, modelId }
            })
        )

        void Promise.all(generationTasks).then((results) => {
          const completed = results.filter((r) => r.ok)
          const summary = buildMediaSummary('video', text, activeModels, completed.length, results.length - completed.length)
          const assistantMessage = {
            id: `gen-summary-${Date.now()}`,
            role: 'assistant',
            parts: [{ type: 'text', text: summary }],
          }
          targetRuntime.askChats.slice(0, selectedModelsSnapshot.length).forEach((chat) => {
            chat.messages = [
              ...chat.messages,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              assistantMessage as any,
            ]
          })
          void fetch('/api/app/conversations/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: chatId,
              turnId: mediaTurnId,
              mode: composerModeSnapshot,
              role: 'assistant',
              content: summary,
              contentType: 'text',
              parts: [{ type: 'text', text: summary }],
            }),
          })
          completeSession(chatId, activeChatIdRef.current === chatId)
          loadChats()
          loadSubscription()
        }).catch((err) => {
          console.error('[ChatInterface] Video generation batch failed', err)
          completeSession(chatId, activeChatIdRef.current === chatId)
        })
      }
      return
    }

    // ── Normal text chat path ─────────────────────────────────────────────
    if (attachedImages.length === 0 && !text && !hasReadyDocs) return
    if (isSendBlocked) return

    const indexedFileNames = pendingChatDocuments
      .filter((d) => d.status === 'ready')
      .map((d) => d.name)

    // Capture before any await — isFirstMessage is true for the first message of a new/fresh chat
    const wasFirst = isFirstMessage
    const chatId = activeChatId || await createNewChat()
    if (!chatId) return
    const targetRuntime = ensureConversationRuntime(chatId)

    shouldScrollRef.current = true
    const textTurnId = crypto.randomUUID()

    type UiPart = { type: string; text?: string; url?: string; mediaType?: string }
    const partsForModel: UiPart[] = []
    if (text.trim()) partsForModel.push({ type: 'text', text: text.trim() })
    for (const img of attachedImages) {
      partsForModel.push({ type: 'file', url: img.dataUrl, mediaType: img.mimeType })
    }
    const partsForPersist: UiPart[] = [...partsForModel]
    if (indexedFileNames.length > 0) {
      partsForPersist.push({
        type: 'text',
        text: `[Indexed documents: ${indexedFileNames.join(', ')}]`,
      })
    }

    let persistedContent = ''
    if (text.trim() && indexedFileNames.length > 0) {
      persistedContent = `${text.trim()}\n\n[Indexed documents: ${indexedFileNames.join(', ')}]`
    } else if (text.trim()) {
      persistedContent = text.trim()
    } else if (partsForModel.some((p) => p.type === 'file')) {
      persistedContent = '[Image attachment]'
    } else if (indexedFileNames.length > 0) {
      persistedContent = `[Indexed documents: ${indexedFileNames.join(', ')}]`
    }

    const userMeta: ChatMessageMetadata = {}
    if (indexedFileNames.length > 0) userMeta.indexedDocuments = indexedFileNames
    if (replyCtxSnapshot?.replyToTurnId) {
      userMeta.replyToTurnId = replyCtxSnapshot.replyToTurnId
      userMeta.replySnippet = replyCtxSnapshot.snippet
    }
    const userMetadata = Object.keys(userMeta).length > 0 ? userMeta : undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userUIMessage: any = {
      id: textTurnId,
      role: 'user',
      parts: partsForModel,
      ...(userMetadata ? { metadata: userMetadata } : {}),
    }

    if (wasFirst && (text || indexedFileNames.length > 0)) {
      startFirstMessageRename(chatId, text || indexedFileNames[0] || 'Documents')
    }

    const msgCountBeforeSend = targetRuntime.askChats[0].messages.length
    activeChatIdRef.current = chatId

    if (composerModeSnapshot === 'act') {
      updateRuntimeUiState(chatId, (prev) => ({
        ...prev,
        exchangeModes: [...prev.exchangeModes, 'act'],
        exchangeModels: [...prev.exchangeModels, [selectedActModelSnapshot]],
        selectedTabPerExchange: [...prev.selectedTabPerExchange, 0],
        exchangeGenTypes: [...prev.exchangeGenTypes, 'text'],
        isFirstMessage: false,
      }))

      startSession(chatId, 'act', activeChatTitleSnapshot ?? '', msgCountBeforeSend)

      targetRuntime.askChats[0].messages = [
        ...targetRuntime.askChats[0].messages,
        userUIMessage as UIMessage,
      ]
      targetRuntime.actChat.messages = [
        ...targetRuntime.actChat.messages,
        userUIMessage as UIMessage,
      ]

      setInput('')
      setAttachedImages([])
      setPendingChatDocuments([])
      setAttachmentError(null)
      setReplyContext(null)
      setIsFirstMessage(false)

      /* eslint-disable @typescript-eslint/no-explicit-any -- UIMessage / sendMessage payload */
      void targetRuntime.actChat.sendMessage(
        {
          role: 'user',
          parts: partsForModel as any,
          messageId: textTurnId,
          ...(userMetadata ? { metadata: userMetadata } : {}),
        } as any,
        {
          body: {
            conversationId: chatId,
            turnId: textTurnId,
            modelId: selectedActModelSnapshot,
            ...(indexedFileNames.length > 0 ? { indexedFileNames } : {}),
            ...(replyCtxSnapshot?.bodyForModel ? { replyContextForModel: replyCtxSnapshot.bodyForModel } : {}),
          },
        },
      )
        .then(() => {
          completeSession(chatId, activeChatIdRef.current === chatId)
          loadChats()
          loadSubscription()
        })
        .catch((err) => {
          console.error('[ChatInterface] Act sendMessage failed', err)
          completeSession(chatId, activeChatIdRef.current === chatId)
          if (activeChatIdRef.current === chatId) {
            setComposerNotice(
              err instanceof Error ? err.message : 'Could not complete Act request. Try again.',
            )
            window.setTimeout(() => setComposerNotice(null), 8000)
          }
        })
      /* eslint-enable @typescript-eslint/no-explicit-any */
      return
    }

    updateRuntimeUiState(chatId, (prev) => ({
      ...prev,
      exchangeModes: [...prev.exchangeModes, 'ask'],
      exchangeModels: [...prev.exchangeModels, [...selectedModelsSnapshot]],
      selectedTabPerExchange: [...prev.selectedTabPerExchange, 0],
      exchangeGenTypes: [...prev.exchangeGenTypes, 'text'],
      isFirstMessage: false,
    }))

    startSession(chatId, 'ask', activeChatTitleSnapshot ?? '', msgCountBeforeSend)

    const multiAsk = selectedModelsSnapshot.length > 1
    selectedModelsSnapshot.forEach((_, idx) => {
      const variantUserId = multiAsk ? `${textTurnId}::v${idx}` : textTurnId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = { ...userUIMessage, id: variantUserId } as any
      targetRuntime.askChats[idx].messages = [...targetRuntime.askChats[idx].messages, u]
    })

    setInput('')
    setAttachedImages([])
    setPendingChatDocuments([])
    setAttachmentError(null)
    setReplyContext(null)
    setIsFirstMessage(false)

    let persistedUserMessage = false
    try {
      const persistRes = await fetch('/api/app/conversations/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: chatId,
          turnId: textTurnId,
          mode: 'ask',
          role: 'user',
          content: persistedContent,
          parts: partsForPersist,
          modelId: selectedModelsSnapshot[0],
          ...(replyCtxSnapshot?.replyToTurnId
            ? { replyToTurnId: replyCtxSnapshot.replyToTurnId, replySnippet: replyCtxSnapshot.snippet }
            : {}),
        }),
      })
      persistedUserMessage = persistRes.ok
      if (!persistRes.ok) {
        console.error('[ChatInterface] Failed to persist user message', await persistRes.text())
      }
    } catch (err) {
      console.error('[ChatInterface] Failed to persist user message', err)
    }

    /* eslint-disable @typescript-eslint/no-explicit-any -- UIMessage / sendMessage payload */
    void Promise.all(
      selectedModelsSnapshot.map((modelId, idx) =>
        targetRuntime.askChats[idx].sendMessage(
          {
            role: 'user',
            parts: partsForModel as any,
            messageId: multiAsk ? `${textTurnId}::v${idx}` : textTurnId,
            ...(userMetadata ? { metadata: userMetadata } : {}),
          } as any,
          {
            body: {
              modelId,
              conversationId: chatId,
              turnId: textTurnId,
              variantIndex: idx,
              skipUserMessage: persistedUserMessage || idx !== 0,
              ...(indexedFileNames.length > 0 ? { indexedFileNames } : {}),
              ...(replyCtxSnapshot?.bodyForModel ? { replyContextForModel: replyCtxSnapshot.bodyForModel } : {}),
            },
          },
        ),
      ),
    ).then(async () => {
      await hydrateCompletedAskTurnFromServer(chatId, textTurnId, selectedModelsSnapshot)
      completeSession(chatId, activeChatIdRef.current === chatId)
      loadChats()
      loadSubscription()
    })
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  const handleModeChange = useCallback((mode: GenerationMode) => {
    setGenerationMode(mode)
    setGenerationChip(null)
    localStorage.setItem(CHAT_GEN_MODE_KEY, mode)
  }, [])

  const isActiveLoadingRef = useRef(isActiveLoading)
  isActiveLoadingRef.current = isActiveLoading

  useEffect(() => {
    function onGlobalKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey

      if (meta && e.shiftKey && (e.key === '/' || e.key === '?')) {
        if (isActiveLoadingRef.current) return
        e.preventDefault()
        setShowModelPicker((v) => !v)
        return
      }

      if (meta && e.shiftKey && e.key === '.') {
        if (isActiveLoadingRef.current) return
        e.preventDefault()
        setGenerationMode((prev) => {
          const order: GenerationMode[] = ['text', 'image', 'video']
          const i = order.indexOf(prev)
          const next = order[(i + 1) % order.length]!
          localStorage.setItem(CHAT_GEN_MODE_KEY, next)
          return next
        })
        setGenerationChip(null)
        return
      }

      if (e.key === '/' && !meta && !e.altKey && !e.shiftKey) {
        const t = e.target as HTMLElement | null
        if (!t) return
        if (textareaRef.current && (t === textareaRef.current || textareaRef.current.contains(t))) return
        if (t.closest('input, textarea, select, [contenteditable="true"]')) return
        e.preventDefault()
        textareaRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onGlobalKeyDown, true)
    return () => window.removeEventListener('keydown', onGlobalKeyDown, true)
  }, [])

  function toggleModel(modelId: string) {
    if (isActiveLoading || composerMode === 'act') return
    if (askModelSelectionMode === 'single') {
      if (selectedModels[0] === modelId && selectedModels.length === 1) return
      const prev = [...selectedModels]
      const newModels = [modelId]
      remapChatSlotsForNewModelOrder(prev, newModels)
      setSelectedModels(newModels)
      localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(newModels))
      setShowModelPicker(false)
      return
    }
    const isSelected = selectedModels.includes(modelId)
    if (isSelected) {
      if (selectedModels.length === 1) return
      const prev = [...selectedModels]
      const newModels = prev.filter((id) => id !== modelId)
      remapChatSlotsForNewModelOrder(prev, newModels)
      setSelectedModels(newModels)
      localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(newModels))
    } else {
      if (selectedModels.length >= 4) return
      const prev = [...selectedModels]
      const newModels = [...prev, modelId]
      remapChatSlotsForNewModelOrder(prev, newModels)
      setSelectedModels(newModels)
      localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(newModels))
    }
  }

  function stopActiveChat() {
    if (!isActiveLoading) return
    const userTurns = chat0.messages.filter((m) => m.role === 'user').length
    const idx = userTurns > 0 ? userTurns - 1 : -1
    activeAskChats.slice(0, selectedModels.length).forEach((chat) => chat.stop())
    activeRuntime.actChat.stop()
    if (idx >= 0) setInterruptedExchangeIdx(idx)
  }

  // ── derived values for header ─────────────────────────────────────────────

  const activeChat = chats.find((c) => c._id === activeChatId)
  const modelPickerLabel = generationMode === 'image'
    ? (selectedImageModels.length === 1 ? (IMAGE_MODELS.find((m) => m.id === selectedImageModels[0])?.name ?? 'Select model') : `${selectedImageModels.length} models`)
    : generationMode === 'video'
    ? (selectedVideoModels.length === 1 ? (VIDEO_MODELS.find((m) => m.id === selectedVideoModels[0])?.name ?? 'Select model') : `${selectedVideoModels.length} models`)
    : composerMode === 'act'
    ? (getChatModelDisplayName(selectedActModel) || 'Select model')
    : selectedModels.length === 1
    ? (getChatModelDisplayName(selectedModels[0] ?? '') || 'Select model')
    : `${selectedModels.length} models`

  const primaryMessages = chat0.messages
  const hasMessages = primaryMessages.some((m) => m.role === 'user')
  const hasHistory = hasMessages || generationResults.size > 0
  /** Empty chat (any modality): center composer + suggestions; after first message, dock composer to bottom. */
  const showCenteredEmptyChat = !hasHistory
  const userTurnCount = primaryMessages.filter((m) => m.role === 'user').length
  const latestExchIdx = userTurnCount > 0 ? userTurnCount - 1 : -1

  const greetingLine = chatGreetingLine(firstName)

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-w-0 overflow-x-hidden">
      {/* Sidebar — hidden when embedded in a project */}
      {showOwnSidebar && (
        <>
          <div className="hidden h-full w-52 flex-col border-r border-[var(--border)] bg-[var(--surface-muted)] md:flex">
            <div className="flex h-16 items-center border-b border-[var(--border)] px-3">
              <button
                onClick={createNewChat}
                className="flex w-full items-center gap-1.5 rounded-md bg-[var(--foreground)] px-3 py-1.5 text-sm text-[var(--background)] transition-colors hover:opacity-80"
              >
                <Plus size={13} />
                New chat
              </button>
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
              {chats.map((chat) => {
                const isStreaming = sessions[chat._id]?.status === 'streaming'
                const unread = getUnread(chat._id)
                const isEditing = editingChatId === chat._id
                return (
                  <div
                    key={chat._id}
                    onClick={() => {
                      if (isEditing) return
                      void loadChat(chat._id)
                    }}
                    className={`group flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                      activeChatId === chat._id
                        ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                        : 'text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingChatTitle}
                        onChange={(event) => setEditingChatTitle(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void commitChatRename(chat._id)
                          } else if (event.key === 'Escape') {
                            event.preventDefault()
                            cancelChatRename()
                          }
                        }}
                        onBlur={() => void commitChatRename(chat._id)}
                        className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[11px] text-[var(--foreground)] outline-none"
                      />
                    ) : (
                      <span className="flex-1 truncate">{chat.title}</span>
                    )}
                    {isStreaming && !unread && (
                      <span className="ml-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--muted)]" />
                    )}
                    {unread > 0 && (
                      <span className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[9px] font-medium text-[var(--background)]">
                        {unread}
                      </span>
                    )}
                    {!isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={(event) => beginChatRename(chat._id, chat.title, event)}
                          className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
                          aria-label="Rename chat"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={(e) => deleteChat(chat._id, e)}
                          className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
                          aria-label="Delete chat"
                        >
                          <Trash2 size={11} />
                        </button>
                      </>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          {mobileChatListOpen && (
            <div className="fixed inset-0 z-50 md:hidden">
              <button
                type="button"
                aria-label="Close chat list"
                className="absolute inset-0 bg-black/40"
                onClick={() => setMobileChatListOpen(false)}
              />
              <div
                className="absolute bottom-0 left-0 right-0 flex max-h-[min(78vh,560px)] flex-col rounded-t-2xl border border-[var(--border)] border-b-0 bg-[var(--surface-muted)] shadow-[0_-8px_40px_rgba(0,0,0,0.12)]"
                role="dialog"
                aria-modal="true"
                aria-label="Chat history"
              >
                <div className="flex shrink-0 items-center justify-center pb-1 pt-2">
                  <span className="h-1 w-12 rounded-full bg-[var(--border)]" aria-hidden />
                </div>
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
                  <span className="text-sm font-medium text-[var(--foreground)]">Chats</span>
                  <button
                    type="button"
                    onClick={() => setMobileChatListOpen(false)}
                    aria-label="Close"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)]"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="border-b border-[var(--border)] px-3 py-2">
                  <button
                    onClick={() => {
                      void createNewChat().then(() => setMobileChatListOpen(false))
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--foreground)] px-3 py-2 text-sm text-[var(--background)] transition-colors hover:opacity-80"
                  >
                    <Plus size={13} />
                    New chat
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <div className="space-y-0.5">
                    {chats.map((chat) => {
                      const isStreaming = sessions[chat._id]?.status === 'streaming'
                      const unread = getUnread(chat._id)
                      const isEditing = editingChatId === chat._id
                      return (
                        <div
                          key={chat._id}
                          onClick={() => {
                            if (isEditing) return
                            void loadChat(chat._id)
                            setMobileChatListOpen(false)
                          }}
                          className={`group flex items-center justify-between rounded-md px-2.5 py-2 text-xs transition-colors ${
                              activeChatId === chat._id
                                ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                                : 'text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]'
                          }`}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editingChatTitle}
                              onChange={(event) => setEditingChatTitle(event.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  void commitChatRename(chat._id)
                                } else if (event.key === 'Escape') {
                                  event.preventDefault()
                                  cancelChatRename()
                                }
                              }}
                              onBlur={() => void commitChatRename(chat._id)}
                              className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[11px] text-[var(--foreground)] outline-none"
                            />
                          ) : (
                            <span className="flex-1 truncate">{chat.title}</span>
                          )}
                          {isStreaming && !unread && (
                            <span className="ml-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--muted)]" />
                          )}
                          {unread > 0 && (
                            <span className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[9px] font-medium text-[var(--background)]">
                              {unread}
                            </span>
                          )}
                          {!isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={(event) => beginChatRename(chat._id, chat.title, event)}
                                className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
                                aria-label="Rename chat"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => deleteChat(chat._id, e)}
                                className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
                                aria-label="Delete chat"
                              >
                                <Trash2 size={11} />
                              </button>
                            </>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Main area */}
      <div
        className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden"
        onDragEnter={(e) => {
          e.preventDefault()
          dragCounterRef.current++
          if (e.dataTransfer.types.includes('Files')) setIsDragging(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          dragCounterRef.current--
          if (dragCounterRef.current === 0) setIsDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          dragCounterRef.current = 0
          setIsDragging(false)
          const all = Array.from(e.dataTransfer.files)
          const images = all.filter((f) => f.type.startsWith('image/'))
          if (images.length > 0) addImages(images)
          const docExts =
            /^(pdf|docx|txt|md|markdown|csv|json|html|htm|xml|log|ts|tsx|js|jsx|css|yaml|yml|toml|py|go|rs)$/i
          const docs = all.filter((f) => {
            const ext = f.name.split('.').pop() ?? ''
            return (
              docExts.test(ext) ||
              f.type === 'application/pdf' ||
              f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
              (f.type.startsWith('text/') && ext !== '')
            )
          })
          if (docs.length > 0) docs.forEach((f) => queueDocumentUpload(f))
        }}
      >
        {isDragging && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--background)]/90 border-2 border-dashed border-[#0a0a0a] rounded-lg m-2 pointer-events-none">
            <div className="text-center">
              <ImageIcon size={28} className="mx-auto mb-2 text-[var(--muted)]" />
              <p className="text-sm font-medium text-[var(--foreground)]">Drop images or documents here</p>
            </div>
          </div>
        )}
        {/* Sticky header — md: h-16 aligns with AppSidebar brand row border; stack on narrow screens */}
        <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--border)] px-3 py-2 md:h-16 md:min-h-16 md:max-h-16 md:flex-row md:items-center md:justify-between md:gap-3 md:overflow-visible md:py-0 md:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="min-w-0 flex-1 text-sm font-medium leading-snug text-[var(--foreground)] md:max-w-[min(100%,20rem)] md:truncate lg:max-w-[24rem]">
                <span className="line-clamp-2 md:line-clamp-1 md:truncate">
                  {activeChatTitle ?? activeChat?.title ?? 'New conversation'}
                </span>
              </h2>
              {isSwitchingChat && (
                <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#e0e0e0] border-t-[#525252] animate-spin" />
              )}
              {projectName && (
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                  <FolderOpen size={9} />
                  <span className="max-w-[6rem] truncate sm:max-w-none">{projectName}</span>
                </span>
              )}
            </div>

            {/* Model picker + Generation mode */}
            <div className="flex w-full min-w-0 flex-col gap-2 md:w-auto md:flex-none md:flex-row md:items-center md:gap-2">
              {generationMode === 'video' && (
                <div ref={videoSubModePickerRef} className="relative w-full min-w-0 md:w-auto">
                  <button
                    type="button"
                    onClick={() => !isActiveLoading && setShowVideoSubModePicker((v) => !v)}
                    disabled={isActiveLoading}
                    className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-md bg-[var(--surface-subtle)] px-2.5 py-1.5 text-left text-xs md:w-auto md:max-w-[13rem] md:py-1 ${
                      isActiveLoading ? 'cursor-not-allowed text-[var(--muted-light)]' : 'text-[var(--muted)] hover:bg-[var(--border)]'
                    }`}
                  >
                    <span className="min-w-0 truncate">{VIDEO_SUB_MODE_LABELS[videoSubMode]}</span>
                    <ChevronDown size={11} className="shrink-0" />
                  </button>
                  {showVideoSubModePicker && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg md:left-auto md:right-0 md:w-52">
                      {VIDEO_SUB_MODES.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => { handleVideoSubModeChange(value); setShowVideoSubModePicker(false) }}
                          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-muted)] ${videoSubMode === value ? 'font-medium text-[var(--foreground)]' : 'text-[var(--muted)]'}`}
                        >
                          {videoSubMode === value ? <Check size={10} /> : <span className="inline-block w-[10px]" />}
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div ref={modelPickerRef} className="relative w-full min-w-0 md:w-auto">
                <DelayedTooltip label="Choose model (⇧⌘/)" side="bottom">
                  <button
                    type="button"
                    onClick={() => !isActiveLoading && setShowModelPicker((v) => !v)}
                    disabled={isActiveLoading}
                    className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-md bg-[var(--surface-subtle)] px-2.5 py-1.5 text-left text-xs md:w-auto md:max-w-[13rem] md:py-1 ${
                      isActiveLoading ? 'cursor-not-allowed text-[var(--muted-light)]' : 'text-[var(--muted)] hover:bg-[var(--border)]'
                    }`}
                  >
                    <span className="min-w-0 truncate">{modelPickerLabel}</span>
                    <ChevronDown size={11} className="shrink-0" />
                  </button>
                </DelayedTooltip>
                {showModelPicker && (
                  <div
                    className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg md:left-auto md:right-0 md:w-64"
                    onMouseLeave={() => setHoveredModelId(null)}
                  >
                  <div className="max-h-72 overflow-y-auto">
                  {generationMode === 'image' ? (
                    IMAGE_MODELS.map((m) => {
                        const isSel = selectedImageModels.includes(m.id)
                        const isDisabled =
                          imageModelSelectionMode === 'multiple' && !isSel && selectedImageModels.length >= 4
                        return (
                          <button key={m.id}
                            disabled={isDisabled}
                            onClick={() => toggleImageModelInPicker(m.id)}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                              isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--surface-muted)]'
                            } ${isSel ? 'text-[var(--foreground)] font-medium' : 'text-[var(--muted)]'}`}>
                            <span className="flex items-center gap-2">
                              {isSel ? <Check size={10} /> : <span className="w-[10px] inline-block" />}
                              {m.name}
                            </span>
                          </button>
                        )
                      })
                  ) : generationMode === 'video' ? (
                    getVideoModelsBySubMode(videoSubMode).map((m) => {
                        const isSel = selectedVideoModels.includes(m.id)
                        const isDisabled =
                          videoModelSelectionMode === 'multiple' && !isSel && selectedVideoModels.length >= 4
                        return (
                          <button key={m.id}
                            disabled={isDisabled}
                            onClick={() => toggleVideoModelInPicker(m.id)}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                              isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--surface-muted)]'
                            } ${isSel ? 'text-[var(--foreground)] font-medium' : 'text-[var(--muted)]'}`}>
                            <span className="flex items-center gap-2">
                              {isSel ? <Check size={10} /> : <span className="w-[10px] inline-block" />}
                              {m.name}
                            </span>
                          </button>
                        )
                      })
                  ) : composerMode === 'act' ? (
                    getModelsByIntelligence(isFreeTier).map((m) => {
                      const isSel = m.id === selectedActModel
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedActModel(m.id)
                            localStorage.setItem(ACT_MODEL_KEY, m.id)
                            setShowModelPicker(false)
                          }}
                          onMouseEnter={() => setHoveredModelId(m.id)}
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[var(--surface-muted)] ${
                            isSel ? 'text-[var(--foreground)] font-medium' : 'text-[var(--muted)]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {isSel ? <Check size={10} /> : <span className="w-[10px] inline-block" />}
                            {m.name}
                          </span>
                          <ModelBadges m={m} isHovered={hoveredModelId === m.id} isFreeTier={isFreeTier} />
                        </button>
                      )
                    })
                  ) : (
                    getModelsByIntelligence(isFreeTier).map((m) => {
                      const isSelected = selectedModels.includes(m.id)
                      const isDisabled = askModelSelectionMode === 'multiple' && !isSelected && selectedModels.length >= 4
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleModel(m.id)}
                          disabled={isDisabled}
                          onMouseEnter={() => !isDisabled && setHoveredModelId(m.id)}
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                            isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--surface-muted)]'
                          } ${isSelected ? 'text-[var(--foreground)] font-medium' : 'text-[var(--muted)]'}`}
                        >
                          <span className="flex items-center gap-2">
                            {isSelected ? <Check size={10} /> : <span className="w-[10px] inline-block" />}
                            {m.name}
                          </span>
                          <ModelBadges m={m} isHovered={hoveredModelId === m.id} isFreeTier={isFreeTier} />
                        </button>
                      )
                    })
                  )}
                  </div>
                  {generationMode === 'text' && composerMode === 'ask' && (
                    <div className="border-t border-[var(--border)] px-2 py-2">
                      <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--surface-subtle)] p-0.5">
                        {(['single', 'multiple'] as const).map((mode) => {
                          const isActive = askModelSelectionMode === mode
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => handleAskModelSelectionModeChange(mode)}
                              disabled={isActiveLoading || (isFreeTier && mode === 'multiple')}
                              className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${
                                isActive
                                  ? 'bg-[var(--surface-elevated)] font-medium text-[var(--foreground)] shadow-sm'
                                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                              } ${
                                isActiveLoading || (isFreeTier && mode === 'multiple') ? 'cursor-not-allowed opacity-40' : ''
                              }`}
                            >
                              {mode}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {generationMode === 'image' && (
                    <div className="border-t border-[var(--border)] px-2 py-2">
                      <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--surface-subtle)] p-0.5">
                        {(['single', 'multiple'] as const).map((mode) => {
                          const isActive = imageModelSelectionMode === mode
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => handleImageModelSelectionModeChange(mode)}
                              disabled={isActiveLoading || (isFreeTier && mode === 'multiple')}
                              className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${
                                isActive
                                  ? 'bg-[var(--surface-elevated)] font-medium text-[var(--foreground)] shadow-sm'
                                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                              } ${
                                isActiveLoading || (isFreeTier && mode === 'multiple') ? 'cursor-not-allowed opacity-40' : ''
                              }`}
                            >
                              {mode}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {generationMode === 'video' && (
                    <div className="border-t border-[var(--border)] px-2 py-2">
                      <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--surface-subtle)] p-0.5">
                        {(['single', 'multiple'] as const).map((mode) => {
                          const isActive = videoModelSelectionMode === mode
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => handleVideoModelSelectionModeChange(mode)}
                              disabled={isActiveLoading || (isFreeTier && mode === 'multiple')}
                              className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${
                                isActive
                                  ? 'bg-[var(--surface-elevated)] font-medium text-[var(--foreground)] shadow-sm'
                                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                              } ${
                                isActiveLoading || (isFreeTier && mode === 'multiple') ? 'cursor-not-allowed opacity-40' : ''
                              }`}
                            >
                              {mode}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DelayedTooltip label="Cycle text / image / video (⇧⌘.)" side="bottom">
              <span className="block w-full md:inline-flex md:w-auto">
                <span className="block w-full md:hidden">
                  <GenerationModeToggle
                    mode={generationMode}
                    onChange={handleModeChange}
                    disabled={isActiveLoading}
                    layout="stretch"
                  />
                </span>
                <span className="hidden md:inline-flex">
                  <GenerationModeToggle mode={generationMode} onChange={handleModeChange} disabled={isActiveLoading} />
                </span>
              </span>
            </DelayedTooltip>
          </div>
        </div>

        {/* Messages — only after first exchange; empty chat keeps composer centered below */}
        {hasHistory && (
        <div
          ref={messagesScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4"
        >
          <div className="mx-auto flex min-h-full w-full min-w-0 max-w-4xl flex-col gap-5 sm:gap-6">
            {(() => {
              const blocks: React.ReactNode[] = []
              let exchIdx = 0

              for (const msg of primaryMessages) {
                if (msg.role !== 'user') continue
                const curExchIdx = exchIdx++
                const genResults = generationResults.get(curExchIdx)
                const genType = exchangeGenTypes[curExchIdx]

                if (genType === 'image' || genType === 'video') {
                  let exchModelList = exchangeModels[curExchIdx] ?? []
                  if (exchModelList.length === 0) {
                    exchModelList =
                      genType === 'image'
                        ? [selectedImageModels[0] ?? DEFAULT_IMAGE_MODEL_ID]
                        : [selectedVideoModels[0] ?? DEFAULT_VIDEO_MODEL_ID]
                  }
                  let allResults: GenerationResult[] =
                    genResults && genResults.length > 0
                      ? [...genResults]
                      : exchModelList.map(() => ({ type: genType, status: 'generating' as const }))
                  while (allResults.length < exchModelList.length) {
                    allResults.push({ type: genType, status: 'generating' })
                  }
                  if (allResults.length > exchModelList.length) {
                    allResults = allResults.slice(0, exchModelList.length)
                  }
                  const isMulti = exchModelList.length > 1
                  const promptText = getMessageText(msg)
                  const mediaTurnIdLocal = getUserTurnId(msg)
                  const mediaModelLabel =
                    exchModelList.length > 1
                      ? `${genType === 'image' ? 'Image' : 'Video'} · ${exchModelList.length} models`
                      : (IMAGE_MODELS.find((m) => m.id === exchModelList[0])?.name ||
                        VIDEO_MODELS.find((m) => m.id === exchModelList[0])?.name ||
                        exchModelList[0] ||
                        genType)
                  const mediaStillGenerating = allResults.some((r) => !r || r.status === 'generating')
                  const mediaReplyMeta = getUserReplyThreadMeta(msg)
                  const mediaIsExiting =
                    !!mediaTurnIdLocal && exitingTurnIds.includes(mediaTurnIdLocal)

                  blocks.push(
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-3 message-appear transition-all duration-300 ease-out ${
                        mediaIsExiting ? 'pointer-events-none opacity-0 -translate-y-1' : 'translate-y-0 opacity-100'
                      }`}
                      data-exchange-idx={curExchIdx}
                      data-exchange-turn={mediaTurnIdLocal ?? undefined}
                    >
                      {mediaReplyMeta && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => jumpToReplyTarget(mediaReplyMeta.replyToTurnId)}
                            className="max-w-[75%] rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-left text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--foreground)]"
                          >
                            <span className="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
                              <Reply size={12} strokeWidth={1.75} className="shrink-0 text-[var(--muted)]" />
                              Replying to
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-[var(--muted)]">{mediaReplyMeta.replySnippet}</span>
                          </button>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <div className="chat-user-bubble min-w-0 max-w-[min(92%,36rem)] break-words select-text rounded-2xl rounded-br-sm border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-sm leading-relaxed text-[var(--foreground)] sm:max-w-[75%] sm:px-4">
                          {getMessageImages(msg).length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {getMessageImages(msg).map((imgUrl, imgIdx) => (
                                <img
                                  key={imgIdx}
                                  src={imgUrl}
                                  alt="Reference image"
                                  className="max-h-36 rounded-lg object-cover"
                                />
                              ))}
                            </div>
                          )}
                          <span className="whitespace-pre-wrap">{promptText}</span>
                        </div>
                      </div>
                      <div
                        className={`min-w-0 w-full ${isMulti ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : 'flex flex-col gap-1.5 items-start'} ${
                          mediaStillGenerating && !isMulti
                            ? genType === 'video'
                              ? 'min-h-40'
                              : 'min-h-52'
                            : ''
                        }`}
                      >
                        {exchModelList.map((modelId, mIdx) => {
                          const result = allResults[mIdx]
                          const modelName =
                            IMAGE_MODELS.find((m) => m.id === modelId)?.name ||
                            VIDEO_MODELS.find((m) => m.id === modelId)?.name ||
                            modelId
                          return (
                            <div key={`${modelId}-${mIdx}`} className={`min-w-0 ${isMulti ? 'w-full' : 'flex flex-col gap-1.5 self-start'}`}>
                              <MediaSlotOutput
                                genType={genType}
                                isMulti={isMulti}
                                modelName={modelName}
                                result={result}
                              />
                            </div>
                          )
                        })}
                      </div>
                      {!mediaStillGenerating && (
                        <div className="message-appear flex items-center gap-1 px-1 pt-0.5">
                          <FlashCopyIconButton
                            copyText={promptText}
                            disabled={!promptText || mediaIsExiting}
                            ariaLabel="Copy prompt"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (mediaTurnIdLocal) void handleDeleteTurnById(mediaTurnIdLocal)
                            }}
                            disabled={!mediaTurnIdLocal || mediaIsExiting}
                            className="rounded-md p-1.5 text-[var(--muted)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-90 active:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Delete this turn from history"
                          >
                            <Trash2 size={14} strokeWidth={1.75} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              beginReplyToMediaPrompt(promptText, genType, mediaTurnIdLocal)
                            }
                            disabled={mediaIsExiting}
                            className="rounded-md p-1.5 text-[var(--muted)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-90 active:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Reply"
                          >
                            <Reply size={14} strokeWidth={1.75} />
                          </button>
                          <span className="ml-2 shrink-0 text-left text-[11px] text-[var(--muted-light)]">{mediaModelLabel}</span>
                        </div>
                      )}
                    </div>
                  )
                  continue
                }

                const exchModelList = exchangeModels[curExchIdx] ?? []
                const selectedTab = selectedTabPerExchange[curExchIdx] ?? 0
                const selectedModelId = exchModelList[selectedTab] ?? selectedModels[0] ?? ''
                const isLatest = curExchIdx === latestExchIdx
                const isActExch = (exchangeModes[curExchIdx] ?? 'ask') === 'act'
                const streamSlotIdx =
                  !isActExch && selectedModelId ? selectedModels.indexOf(selectedModelId) : -1
                const slotInst =
                  streamSlotIdx >= 0 ? chatInstances[streamSlotIdx] : null

                let responseMsg = getResponseForExchangeForModel(selectedModelId, curExchIdx)
                let responseText = responseMsg ? getMessageText(responseMsg) : ''

                // Act: assistant streams only into actChat; align with chat0 user index (see resolveActAssistant).
                if (isActExch) {
                  const paired = resolveActAssistant(chat0.messages, actChat.messages, msg.id)
                  if (paired) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    responseMsg = paired as any
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    responseText = getMessageText(paired as any)
                  } else {
                    responseMsg = null
                    responseText = ''
                  }
                }

                const instLoading = isLatest && (
                  (isActExch
                    ? (actChat.status === 'streaming' || actChat.status === 'submitted')
                    : !!slotInst && (slotInst.status === 'streaming' || slotInst.status === 'submitted'))
                  || isOptimisticLoading
                )
                const instError = isLatest ? (isActExch ? actChat.error : slotInst?.error ?? null) : null

                const responseParts =
                  responseMsg && 'parts' in responseMsg && Array.isArray((responseMsg as { parts?: unknown[] }).parts)
                    ? (responseMsg as { parts: unknown[] }).parts
                    : undefined
                let assistantVisualBlocks = buildAssistantVisualSequence(responseParts)
                if (assistantVisualBlocks.length === 0 && responseText.trim()) {
                  assistantVisualBlocks = [{ kind: 'text', text: normalizeAgentAssistantText(responseText) }]
                }
                const hasAssistantText = assistantVisualBlocks.some((b) => b.kind === 'text' && b.text.trim().length > 0)
                const isStreaming = instLoading && hasAssistantText

                const rawUserText = getMessageText(msg)
                const metaDocs = getUserMessageDocNames(msg)
                const { bodyText, docNames: parsedDocNames } = splitUserDisplayText(rawUserText)
                const userDocumentNames = metaDocs.length > 0 ? metaDocs : parsedDocNames
                const userBodyText = metaDocs.length > 0 ? rawUserText.trim() : bodyText

                const sourceCitations = (
                  responseMsg as { metadata?: { sourceCitations?: SourceCitationMap } } | undefined
                )?.metadata?.sourceCitations
                const automationSuggestion = responseMsg ? getAutomationSuggestion(responseMsg) : null

                const routedModelId = responseMsg ? getRoutedModelId(responseMsg) : null
                const routedModelName =
                  selectedModelId === FREE_TIER_AUTO_MODEL_ID && routedModelId
                    ? getChatModelDisplayName(routedModelId)
                    : null
                const modelLabelSingle =
                  selectedModelId === FREE_TIER_AUTO_MODEL_ID && routedModelName
                    ? `Free · ${routedModelName}`
                    : getChatModelDisplayName(selectedModelId)
                const modelLabel =
                  exchModelList.length > 1
                    ? `${modelLabelSingle} · ${exchModelList.length} models`
                    : modelLabelSingle

                const textTurnIdForActions = getUserTurnId(msg)
                const textIsExiting = !!textTurnIdForActions && exitingTurnIds.includes(textTurnIdForActions)

                const assistantPlainForReply = assistantBlocksToPlainText(assistantVisualBlocks)
                const errLabelForTurn = errorLabel(instError)
                const interruptedHere =
                  interruptedExchangeIdx === curExchIdx && !errLabelForTurn
                const replyPlainForInterrupt =
                  interruptedHere && assistantPlainForReply.trim()
                    ? `${assistantPlainForReply}\n\nResponse was interrupted.`
                    : interruptedHere
                      ? 'Response was interrupted.'
                      : assistantPlainForReply

                blocks.push(
                  <ExchangeBlock
                    key={msg.id}
                    userMsgId={msg.id}
                    userBodyText={userBodyText}
                    userDocumentNames={userDocumentNames}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    userImages={getMessageImages(msg as any)}
                    exchIdx={curExchIdx}
                    responseModelId={selectedModelId}
                    assistantVisualBlocks={assistantVisualBlocks}
                    isStreaming={isStreaming}
                    errorMessage={errLabelForTurn}
                    exchModelList={exchModelList}
                    selectedTab={selectedTab}
                    onTabSelect={(tabIdx) => handleTabSelect(curExchIdx, tabIdx)}
                    isLoadingTabs={isActiveLoading}
                    responseInProgress={instLoading}
                    sourceCitations={sourceCitations}
                    automationSuggestion={automationSuggestion}
                    turnIdForActions={textTurnIdForActions}
                    modelLabel={modelLabel}
                    onDeleteTurn={() => {
                      const tid = getUserTurnId(msg)
                      if (tid) void handleDeleteTurnById(tid)
                    }}
                    onReply={() =>
                      beginReplyToAssistantText(replyPlainForInterrupt, getUserTurnId(msg))
                    }
                    interrupted={interruptedHere}
                    actionsLocked={isLatest && isActiveLoading}
                    isExiting={textIsExiting}
                    replyThreadMeta={getUserReplyThreadMeta(msg)}
                    onJumpToReply={jumpToReplyTarget}
                    onOpenDraft={setDraftModalState}
                  />
                )
              }

              return blocks
            })()}

            <div ref={messagesEndRef} />
          </div>
        </div>
        )}

        {/* Input — centered on empty text chat; docks to bottom once there is history */}
        <div
          className={`flex flex-col ${showCenteredEmptyChat ? 'flex-1 min-h-0 justify-center' : 'shrink-0'} ${
            !showCenteredEmptyChat ? 'px-3 pb-3 sm:px-4 sm:pb-4' : 'px-4 pb-4'
          }`}
        >
          <AnimatePresence initial={false}>
            {showCenteredEmptyChat && (
              <motion.div
                key="chat-empty-hero"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="mb-8 text-center"
              >
                <p className="text-3xl text-[var(--foreground)]" style={{ fontFamily: 'var(--font-serif)' }}>
                  {greetingLine}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Use CSS max-width (not motion maxWidth) so the composer column is always capped; framer omitted maxWidth on first paint and chips could span full viewport. */}
          <div
            className={`mx-auto w-full min-w-0 transition-[max-width] duration-[780ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              showCenteredEmptyChat ? 'max-w-[36rem]' : 'max-w-[56rem]'
            }`}
          >
            {(attachedImages.length > 0 || pendingChatDocuments.length > 0) && (
              <div className="mb-2 flex min-w-0 flex-wrap gap-2">
                {attachedImages.map((img, i) => (
                  <div key={`img-${i}`} className="relative group">
                    <img src={img.dataUrl} alt={img.name}
                      className="w-16 h-16 object-cover rounded-lg border border-[var(--border)]" />
                    <button
                      onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[var(--foreground)] text-[var(--background)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={9} />
                    </button>
                  </div>
                ))}
                {pendingChatDocuments.map((doc) => (
                  <div
                    key={doc.clientId}
                    className="relative group flex min-w-0 max-w-full items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-xs text-[var(--muted)] sm:max-w-[min(100%,220px)]"
                  >
                    <FileText size={14} className="shrink-0 text-[var(--muted)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--foreground)]">{doc.name}</p>
                      {doc.status === 'uploading' && (
                        <p className="text-[10px] text-[var(--muted-light)] mt-0.5 animate-pulse">Indexing…</p>
                      )}
                      {doc.status === 'ready' && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">Indexed</p>
                      )}
                      {doc.status === 'error' && (
                        <p className="text-[10px] text-red-500 mt-0.5 truncate" title={doc.error}>
                          {doc.error ?? 'Failed'}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingDocument(doc.clientId)}
                      className="shrink-0 p-0.5 rounded hover:bg-[var(--surface-subtle)] text-[var(--muted-light)]"
                      aria-label="Remove"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {attachmentError && (
              <div
                className="mb-2 flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs"
                style={{
                  background: 'var(--chat-alert-error-bg)',
                  borderColor: 'var(--chat-alert-error-border)',
                  color: 'var(--chat-alert-error-text)',
                }}
              >
                <AlertCircle size={13} className="shrink-0" />
                {attachmentError}
              </div>
            )}
            {composerNotice && (
              <div
                className="mb-2 flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs"
                style={{
                  background: 'var(--chat-alert-warn-bg)',
                  borderColor: 'var(--chat-alert-warn-border)',
                  color: 'var(--chat-alert-warn-text)',
                }}
              >
                <AlertCircle size={13} className="shrink-0 opacity-80" />
                {composerNotice}
              </div>
            )}
            {isSendBlocked && !isActiveLoading ? (
              premiumModelBlocked ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--muted)]">
                  <AlertCircle size={13} className="text-amber-500 shrink-0" />
                  This model requires a paid plan. Switch to Auto or upgrade.
                </div>
              ) : (
                <TopUpPreferenceControl
                  variant="app"
                  title="No budget remaining"
                  description="Choose one top-up amount for now and future recharges. Add it once, or save the same amount for automatic top-ups later."
                  amountCents={topUpAmountDraftCents}
                  minAmountCents={entitlements?.topUpMinAmountCents ?? 800}
                  maxAmountCents={entitlements?.topUpMaxAmountCents ?? 20_000}
                  stepAmountCents={entitlements?.topUpStepAmountCents ?? 100}
                  onAmountChange={setTopUpAmountDraftCents}
                  autoTopUpEnabled={autoTopUpEnabledDraft}
                  onAutoTopUpEnabledChange={setAutoTopUpEnabledDraft}
                  checkboxDescription="If enabled, the same amount will recharge automatically whenever your cumulative budget reaches zero."
                  note={
                    <>
                      You can also manage this from{' '}
                      <Link href="/account" className="font-medium underline underline-offset-4">
                        Account
                      </Link>
                      .
                    </>
                  }
                  footer={
                    <>
                      <button
                        type="button"
                        onClick={() => void handleStartTopUp()}
                        disabled={billingActionLoading === 'checkout'}
                        className="inline-flex items-center justify-center rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {billingActionLoading === 'checkout'
                          ? 'Opening checkout...'
                          : `Add $${(topUpAmountDraftCents / 100).toFixed(0)} top-up`}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveTopUpPreference()}
                        disabled={billingActionLoading === 'save'}
                        className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {billingActionLoading === 'save' ? 'Saving...' : 'Save top-up preference'}
                      </button>
                    </>
                  }
                />
              )
            ) : (
              <div className="overflow-visible rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                {replyContext && (
                  <div className="flex items-start gap-2 rounded-t-2xl border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-xs text-[var(--muted)]">
                    <Reply size={14} className="mt-0.5 shrink-0 text-[var(--muted)]" strokeWidth={1.75} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--foreground)]">Replying to prior response</p>
                      <p className="mt-0.5 line-clamp-2 text-[var(--muted)]">{replyContext.snippet}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyContext(null)}
                      className="shrink-0 rounded-md p-1 text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--foreground)]"
                      aria-label="Cancel reply"
                    >
                      <X size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                )}
                <div className="p-2.5 sm:p-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && addImages(e.target.files)}
                />
                <input
                  ref={docInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm,.xml,.log,.ts,.tsx,.js,.jsx,.css,.yaml,.yml,.toml,.py,.go,.rs,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addDocumentsFromPicker(e.target.files)
                    e.target.value = ''
                  }}
                />
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Ask anything..."
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && e.shiftKey) {
                      e.preventDefault()
                      handleComposerModeChange(composerMode === 'ask' ? 'act' : 'ask')
                      return
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  className="w-full min-h-11 resize-none border-0 bg-transparent px-0.5 py-1 text-sm leading-6 text-[var(--foreground)] shadow-none outline-none ring-0 placeholder:text-[var(--muted-light)] focus:ring-0"
                />
                <div className="mt-2 flex min-h-9 items-center gap-2">
                  <div ref={attachMenuRef} className="relative shrink-0">
                    <DelayedTooltip label="Attach files or switch to image/video" side="top">
                      <button
                        type="button"
                        onClick={() => setShowAttachMenu((v) => !v)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                      >
                        <Plus size={18} strokeWidth={1.75} />
                      </button>
                    </DelayedTooltip>
                  {showAttachMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl shadow-lg py-1 w-52 z-20">
                      <button
                        type="button"
                        onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false) }}
                        disabled={!supportsVision}
                        title={!supportsVision ? 'You need a vision model to attach images.' : undefined}
                        className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors ${
                          supportsVision
                            ? 'text-[var(--muted)] hover:bg-[var(--surface-muted)]'
                            : 'text-[#bbb] cursor-not-allowed'
                        }`}
                      >
                        <ImageIcon size={13} className="text-[var(--foreground)]" />
                        <span>Attach Images</span>
                      </button>
                      <div className="border-t border-[var(--border)] my-1" />
                      <button
                        type="button"
                        onClick={() => { handleModeChange('image'); setShowAttachMenu(false) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-muted)] transition-colors"
                      >
                        <ImageIcon size={13} className="text-[var(--foreground)]" />
                        <span>Generate Image</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleModeChange('video'); setShowAttachMenu(false) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-muted)] transition-colors"
                      >
                        <Video size={13} className="text-[var(--foreground)]" />
                        <span>Generate Video</span>
                      </button>
                      <div className="border-t border-[var(--border)] my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          docInputRef.current?.click()
                          setShowAttachMenu(false)
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-muted)] transition-colors"
                      >
                        <FileText size={13} />
                        <span>Documents</span>
                        <span className="ml-auto text-[10px] text-[var(--muted-light)]">PDF, Word, text</span>
                      </button>
                    </div>
                  )}
                  </div>
                  <DelayedTooltip label="Ask / Act (⇧Tab in composer)" side="top">
                    <span className="inline-flex">
                      <AskActModeToggle
                        mode={composerMode}
                        onChange={handleComposerModeChange}
                        disabled={isActiveLoading}
                      />
                    </span>
                  </DelayedTooltip>
                  {generationChip && (
                    <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--foreground)] px-2 py-1 text-xs font-medium text-[var(--background)]">
                      {generationChip === 'image' ? <ImageIcon size={10} /> : <Video size={10} />}
                      {generationChip === 'image' ? 'Image' : 'Video'}
                      <button type="button" onClick={() => setGenerationChip(null)} className="ml-0.5 hover:opacity-70">
                        <X size={9} />
                      </button>
                    </div>
                  )}
                  <div className="min-w-0 flex-1" />
                  <div className="flex shrink-0 items-center gap-2">
                    {isActiveLoading ? (
                      <DelayedTooltip label="Stop generating" side="top">
                        <button
                          type="button"
                          onClick={stopActiveChat}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-[var(--background)] transition-colors hover:opacity-80"
                        >
                          <div className="h-3.5 w-3.5 rounded-sm bg-[var(--background)]" />
                        </button>
                      </DelayedTooltip>
                    ) : (
                      <DelayedTooltip label="Send (↵) · new line (⇧↵)" side="top">
                        <button
                          type="button"
                          onClick={handleSend}
                          disabled={
                            !input.trim() &&
                            attachedImages.length === 0 &&
                            !pendingChatDocuments.some((d) => d.status === 'ready')
                          }
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-[var(--background)] transition-colors hover:opacity-80 disabled:opacity-40"
                        >
                          <Send size={17} strokeWidth={1.75} />
                        </button>
                      </DelayedTooltip>
                    )}
                  </div>
                </div>
                </div>
              </div>
            )}
          </div>
          <AnimatePresence initial={false}>
            {showCenteredEmptyChat && (
              <motion.div
                key="chat-suggestions"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="mx-auto mt-6 w-full max-w-[36rem] min-w-0 px-0"
              >
                <div className="grid grid-cols-1 gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
                  {emptyChatStarters.map((prompt, idx) => (
                    <button
                      key={`empty-starter-${idx}`}
                      type="button"
                      className="rounded-lg border border-[var(--border)] p-2.5 text-left leading-snug transition-colors hover:bg-[var(--surface-muted)]"
                      onClick={() => setInput(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DraftReviewModal
          state={draftModalState}
          saving={isDraftSaving}
          onClose={() => {
            if (!isDraftSaving) setDraftModalState(null)
          }}
          onSaveAutomation={saveAutomationDraft}
          onSaveSkill={saveSkillDraft}
        />

        {showOwnSidebar && (
          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur md:hidden">
            <button
              type="button"
              onClick={() => setMobileChatListOpen(true)}
              className="flex w-full items-center justify-center gap-2 py-2.5 text-xs font-medium text-[var(--muted)] active:bg-[var(--surface-subtle)]"
              style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
            >
              <MessageSquare size={15} strokeWidth={1.75} />
              Chats
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
