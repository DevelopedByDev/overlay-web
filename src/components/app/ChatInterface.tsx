'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
  BrainCircuit,
  ArrowUp,
  Globe,
  Play,
  MessageSquare,
} from 'lucide-react'
import { Chat, useChat } from '@ai-sdk/react'
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from 'ai'
import { useSearchParams, useRouter } from 'next/navigation'
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
  pickBestModelForAct,
  type ChatModel,
  type GenerationMode,
} from '@/lib/models'
import type { SourceCitationMap } from '@/lib/ask-knowledge-context'
import { AskActModeToggle, GenerationModeToggle } from './GenerationModeToggle'
import { dispatchChatTitleUpdated, sanitizeChatTitle } from '@/lib/chat-title'
import { useAsyncSessions } from '@/lib/async-sessions-store'
import { useNavigationProgress } from '@/lib/navigation-progress'
import { MarkdownMessage } from './MarkdownMessage'
import { DelayedTooltip } from './DelayedTooltip'
import { normalizeAgentAssistantText } from '@/lib/agent-assistant-text'

function ModelBadges({ m, isHovered, isFreeTier }: { m: ChatModel; isHovered: boolean; isFreeTier: boolean }) {
  const router = useRouter()
  const showUpgrade = isFreeTier && m.cost > 0

  if (isHovered) {
    return (
      <span className="flex items-center gap-1 shrink-0 h-5">
        {showUpgrade && (
          <span
            onClick={(e) => { e.stopPropagation(); router.push('/account') }}
            className="inline-flex items-center h-5 px-1.5 rounded-full bg-[#fef9ec] text-[#b45309] text-[9px] font-semibold leading-none cursor-pointer hover:bg-[#fde68a] transition-colors"
          >
            Upgrade
          </span>
        )}
        <span className={`inline-flex items-center h-5 px-1.5 rounded-full text-[9px] font-semibold leading-none tracking-tight ${
          m.cost === 0 ? 'bg-[#ecfdf5] text-[#065f46]' : 'bg-[#f0f0f0] text-[#525252]'
        }`}>
          {m.cost === 0 ? 'Free' : '$'.repeat(m.cost)}
        </span>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 shrink-0 h-5">
      {showUpgrade && (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#fef9ec] text-[#b45309]">
          <ArrowUp size={10} strokeWidth={2} />
        </span>
      )}
      {m.supportsVision && (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#f0f0f0] text-[#888]">
          <ImageIcon size={10} strokeWidth={1.75} />
        </span>
      )}
      {m.supportsReasoning && (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#f0f0f0] text-[#888]">
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
  type: 'image' | 'video'
  status: 'pending' | 'completed' | 'failed'
  prompt: string
  modelId: string
  url?: string
  createdAt: number
}

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
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
    }
  | { kind: 'text'; text: string }
  | { kind: 'file'; url: string; mediaType?: string }

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
  return out
}

function assistantBlocksToPlainText(blocks: AssistantVisualBlock[]): string {
  return blocks
    .filter((b): b is { kind: 'text'; text: string } => b.kind === 'text')
    .map((b) => b.text)
    .join('\n\n')
}

const TOOL_UI_DONE_STATES = new Set(['output-available', 'output-error', 'output-denied'])

function formatToolLabel(toolId: string): string {
  const map: Record<string, string> = {
    browser_run_task: 'Browse the web',
    perplexity_search: 'Web search',
    search_knowledge: 'Knowledge search',
    list_notes: 'List notes',
    get_note: 'Open note',
    create_note: 'Create note',
    update_note: 'Update note',
    delete_note: 'Delete note',
    list_computer_instances: 'List computers',
    get_computer_by_name: 'Find computer',
    list_computer_sessions: 'Computer sessions',
    get_computer_session_messages: 'Computer chat',
    list_computer_workspace_files: 'Computer files',
    read_computer_workspace_file: 'Read computer file',
    create_computer_session: 'New computer session',
    update_computer_session: 'Update computer session',
    delete_computer_session: 'Delete computer session',
    write_computer_workspace_file: 'Write computer file',
    run_computer_gateway_command: 'Computer agent',
    save_memory: 'Save memory',
    update_memory: 'Update memory',
    delete_memory: 'Delete memory',
    generate_image: 'Generate image',
    generate_video: 'Generate video',
  }
  if (map[toolId]) return map[toolId]!
  const id = toolId.trim()
  if (/composio/i.test(id)) {
    const rest = id.replace(/^composio_?/i, '')
    const title = rest
      .split(/_+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
    return title ? `Integration · ${title}` : 'Integration'
  }
  return id.replace(/_/g, ' ')
}

function toolStateUiLabel(state: string): string {
  if (state === 'output-available') return 'Done'
  if (state === 'output-error') return 'Error'
  if (state === 'output-denied') return 'Denied'
  if (state === 'input-streaming' || state === 'input-available') return 'Running…'
  if (state === 'approval-requested' || state === 'approval-responded') return 'Approval'
  return state
}

function BrowserToolBlock({
  block,
}: {
  block: Extract<AssistantVisualBlock, { kind: 'tool' }>
}) {
  const isDone = block.state === 'output-available'
  const isError = block.state === 'output-error' || block.state === 'output-denied'
  const task = typeof block.toolInput?.task === 'string' ? block.toolInput.task.trim() : ''
  const toolOutput =
    block.toolOutput && typeof block.toolOutput === 'object'
      ? (block.toolOutput as Record<string, unknown>)
      : undefined
  const liveUrl = typeof toolOutput?.liveUrl === 'string' ? toolOutput.liveUrl : null
  const [isCollapsed, setIsCollapsed] = useState(false)
  const isOpen = Boolean(liveUrl && isDone && !isCollapsed)
  const stateLabel = toolStateUiLabel(block.state)

  if (isError) {
    return (
      <div className="w-full px-1">
        <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-[12px] leading-none text-red-700">
          <span className="mt-px inline-flex size-2 shrink-0 rounded-full bg-red-500" aria-hidden />
          <span className="min-w-0 truncate font-medium">Browse the web</span>
          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
            {stateLabel}
          </span>
        </div>
      </div>
    )
  }

  if (!isDone) {
    return (
      <div className="w-full px-1">
        <div className="w-full max-w-[560px] overflow-hidden rounded-xl border border-[#e4e4e7] bg-[#fafafa]">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-[12px] text-[#3f3f46]">
            <div className="flex min-w-0 items-center gap-2">
              <span className="relative inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[#52525b]">
                <Globe size={12} strokeWidth={1.75} />
                <span className="absolute -right-0.5 -top-0.5 inline-flex size-2 rounded-full bg-[#71717a] animate-pulse" />
              </span>
              <span className="truncate font-medium text-[#27272a]">Browse the web</span>
            </div>
            <span className="shrink-0 rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-medium text-[#71717a]">
              {stateLabel}
            </span>
          </div>
          {task && (
            <>
              <div className="mx-3 border-t border-[#ececf0]" />
              <div className="px-3 py-2.5 text-[12px] leading-relaxed text-[#52525b]">{task}</div>
            </>
          )}
          <div className="h-1.5 overflow-hidden bg-[#f0f0f0]">
            <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-transparent via-[#d4d4d8] to-transparent" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-1">
      <div className="w-full max-w-[560px] rounded-xl border border-[#e4e4e7] bg-white">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-[12px] text-[#3f3f46]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
            <span className="truncate font-medium text-[#27272a]">Browse the web</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              {stateLabel}
            </span>
            {liveUrl ? (
              <button
                type="button"
                onClick={() => setIsCollapsed((collapsed) => !collapsed)}
                className="inline-flex items-center gap-1 rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-medium text-[#52525b] transition-colors hover:bg-[#ececf0]"
              >
                View browser →
                <span className={`inline-flex transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                  <ChevronDown size={12} strokeWidth={1.75} />
                </span>
              </button>
            ) : null}
          </div>
        </div>
        {liveUrl && (
          <div
            className={`overflow-hidden border-t border-[#ececf0] px-3 transition-all duration-300 ${isOpen ? 'max-h-[340px] py-3' : 'max-h-0 py-0'}`}
          >
            <div className={`transition-opacity duration-[400ms] ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
              <iframe
                src={liveUrl}
                title="Browser Use live browser"
                sandbox="allow-scripts allow-same-origin"
                className="h-[280px] w-full rounded-xl border border-[#e4e4e7] bg-[#fafafa]"
              />
            </div>
          </div>
        )}
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

type UserBubbleMetadata = { indexedDocuments?: string[]; replyToTurnId?: string; replySnippet?: string }

function getUserMessageDocNames(msg: unknown): string[] {
  const m = msg as { metadata?: UserBubbleMetadata }
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
    metadata?: UserBubbleMetadata
    replyToTurnId?: string
    replySnippet?: string
  }
  const tid = m.metadata?.replyToTurnId?.trim() || m.replyToTurnId?.trim()
  if (!tid) return null
  const snippet = (m.metadata?.replySnippet || m.replySnippet || 'Earlier message').trim()
  return { replyToTurnId: tid, replySnippet: snippet }
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
  turnIdForActions: string | null
  modelLabel: string
  onDeleteTurn: () => void
  onReply: () => void
  actionsLocked: boolean
  isExiting?: boolean
  replyThreadMeta: { replyToTurnId: string; replySnippet: string } | null
  onJumpToReply: (turnId: string) => void
}

function ExchangeBlock({
  userMsgId, userBodyText, userDocumentNames, userImages, exchIdx, responseModelId, assistantVisualBlocks, isStreaming, errorMessage,
  exchModelList, selectedTab, onTabSelect, isLoadingTabs, responseInProgress, sourceCitations,
  turnIdForActions, modelLabel, onDeleteTurn, onReply, actionsLocked, isExiting = false, replyThreadMeta, onJumpToReply,
}: ExchangeBlockProps) {
    const showTextBubble = userBodyText.length > 0
    const assistantPlainText = assistantBlocksToPlainText(assistantVisualBlocks)
    const lastTextBlockIndex = (() => {
      let idx = -1
      for (let i = 0; i < assistantVisualBlocks.length; i++) {
        if (assistantVisualBlocks[i]!.kind === 'text') idx = i
      }
      return idx
    })()
    const responseSettled = !responseInProgress
    const showFooter =
      responseSettled && (assistantPlainText.length > 0 || !!errorMessage)
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
          <div className="min-w-0 max-w-[min(92%,36rem)] space-y-2 sm:max-w-[75%]">
            {replyThreadMeta && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onJumpToReply(replyThreadMeta.replyToTurnId)}
                  className="mb-1 max-w-full rounded-lg border border-[#e5e5e5] bg-[#f0f0f0] px-2.5 py-1.5 text-left text-[11px] text-[#525252] transition-colors hover:bg-[#e8e8e8] hover:text-[#0a0a0a]"
                >
                  <span className="flex items-center gap-1.5 font-medium text-[#0a0a0a]">
                    <Reply size={12} strokeWidth={1.75} className="shrink-0 text-[#71717a]" />
                    Replying to
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[#71717a]">{replyThreadMeta.replySnippet}</span>
                </button>
              </div>
            )}
            {userImages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-end">
                {userImages.map((src, i) => (
                  <img key={i} src={src} alt="attached"
                    className="max-w-[200px] max-h-[200px] rounded-xl object-cover" />
                ))}
              </div>
            )}
            {userDocumentNames.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {userDocumentNames.map((name) => (
                  <div
                    key={name}
                    className="flex max-w-[220px] items-center gap-1.5 rounded-xl border border-[#e5e5e5] bg-white px-2.5 py-1.5 text-xs text-[#525252] shadow-sm"
                  >
                    <FileText size={13} className="shrink-0 text-[#71717a]" />
                    <span className="truncate font-medium text-[#0a0a0a]">{name}</span>
                  </div>
                ))}
              </div>
            )}
            {showTextBubble && (
              <div className="chat-user-bubble min-w-0 max-w-[min(92%,36rem)] break-words select-text rounded-2xl rounded-br-sm bg-[#0a0a0a] px-3 py-2.5 text-sm leading-relaxed text-[#fafafa] sm:max-w-[75%] sm:px-4">
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
                    isActive ? 'bg-[#0a0a0a] text-[#fafafa]' : 'bg-[#f0f0f0] text-[#525252] hover:bg-[#e8e8e8]'
                  }`}
                >
                  {mName}
                </button>
              )
            })}
          </div>
        )}

        {assistantVisualBlocks.map((block, bi) => {
          if (block.kind === 'tool') {
            if (block.name === 'browser_run_task') {
              return <BrowserToolBlock key={`${exchIdx}-seq-${bi}-${block.key}`} block={block} />
            }
            const running = !TOOL_UI_DONE_STATES.has(block.state)
            const err = block.state === 'output-error'
            const stateLabel = toolStateUiLabel(block.state)
            return (
              <div key={`${exchIdx}-seq-${bi}-${block.key}`} className="w-full px-1">
                <div
                  className={`inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-[12px] leading-none ${
                    err
                      ? 'border-red-200 bg-red-50/80 text-red-700'
                      : running
                        ? 'border-[#e4e4e7] bg-[#fafafa] text-[#3f3f46]'
                        : 'border-[#e4e4e7] bg-white text-[#3f3f46]'
                  }`}
                >
                  <span
                    className={`mt-px inline-flex size-2 shrink-0 rounded-full ${
                      err ? 'bg-red-500' : running ? 'bg-[#71717a] animate-pulse' : 'bg-emerald-500'
                    }`}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate font-medium text-[#27272a]">{formatToolLabel(block.name)}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      err
                        ? 'bg-red-100 text-red-700'
                        : running
                          ? 'bg-[#f4f4f5] text-[#71717a]'
                          : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {stateLabel}
                  </span>
                </div>
              </div>
            )
          }
          if (block.kind === 'file') {
            const isImg = (block.mediaType?.startsWith('image/') ?? true)
            if (!isImg) return null
            return (
              <div key={`${exchIdx}-seq-${bi}-file`} className="w-full px-1 py-1">
                <img
                  src={block.url}
                  alt="Generated"
                  className="max-w-full max-h-[320px] rounded-xl border border-[#e8e8e8] object-contain"
                />
              </div>
            )
          }
          const isLastText = bi === lastTextBlockIndex
          return (
            <div key={`${exchIdx}-seq-${bi}-text`} className="w-full px-1 py-1 text-sm leading-relaxed text-[#0a0a0a]">
              <MarkdownMessage
                key={`md-${userMsgId}-${responseModelId}-${bi}`}
                text={block.text}
                isStreaming={isStreaming && isLastText}
                sourceCitations={isLastText ? sourceCitations : undefined}
                suppressTypingIndicator
              />
            </div>
          )
        })}

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
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">
              <AlertCircle size={12} />
              {errorMessage}
            </div>
          </div>
        )}

        {showFooter && (
          <div className="message-appear flex items-center gap-1 px-1 pt-0.5">
            <FlashCopyIconButton
              copyText={assistantPlainText}
              disabled={assistantPlainText.length === 0 || isExiting}
              ariaLabel="Copy response"
            />
            <button
              type="button"
              onClick={onDeleteTurn}
              disabled={!turnIdForActions || actionsLocked || isExiting}
              className="rounded-md p-1.5 text-[#71717a] transition-all hover:bg-[#f0f0f0] hover:text-[#0a0a0a] active:scale-90 active:bg-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Delete this turn from history"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onReply}
              disabled={isExiting}
              className="rounded-md p-1.5 text-[#71717a] transition-all hover:bg-[#f0f0f0] hover:text-[#0a0a0a] active:scale-90 active:bg-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Reply"
            >
              <Reply size={14} strokeWidth={1.75} />
            </button>
            <span className="ml-2 min-w-0 text-left text-[11px] text-[#aaa]">{modelLabel}</span>
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
  if (err.message?.includes('weekly_limit')) return 'Weekly limit reached — upgrade to Pro for unlimited messages.'
  if (err.message?.includes('premium_model')) return 'This model requires a Pro subscription.'
  if (err.message?.includes('generation_not_allowed')) return 'This action requires a Pro subscription.'
  if (err.message?.includes('insufficient_credits')) return 'No credits remaining.'
  if (err.message?.includes('storage_limit_exceeded')) return 'Overlay storage limit reached. Delete files or outputs, or upgrade your plan.'
  if (err.message?.includes('bandwidth_limit_exceeded')) return 'File bandwidth limit reached for this billing period.'
  if (err.message?.includes('supported image formats') || err.message?.includes('does not represent a valid image')) {
    return 'Unsupported image format. Use JPEG, PNG, GIF, or WebP.'
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
      className={`rounded-md p-1.5 text-[#71717a] transition-all duration-200 hover:bg-[#f0f0f0] hover:text-[#0a0a0a] active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 ${
        showCheck ? 'text-emerald-600 hover:text-emerald-600 hover:bg-[#ecfdf5]' : ''
      }`}
      aria-label={ariaLabel}
    >
      {showCheck ? <Check size={14} strokeWidth={1.75} /> : <Copy size={14} strokeWidth={1.75} />}
    </button>
  )
}

// ─── constants ───────────────────────────────────────────────────────────────

const CHAT_SUGGESTIONS = [
  'Explain how transformers work in machine learning',
  'Write a Python script to rename files in a folder',
  'What are the key differences between REST and GraphQL?',
  'Help me draft a professional email declining a meeting',
]

const DEFAULT_CHAT_TITLE = 'New Chat'
const CHAT_MODEL_KEY = 'overlay_chat_model'
const ACT_MODEL_KEY = 'overlay_act_model'
const CHAT_GEN_MODE_KEY = 'overlay_chat_generation_mode'
const SUPPORTED_INPUT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

interface GenerationResult {
  type: 'image' | 'video'
  status: 'generating' | 'completed' | 'failed'
  url?: string
  modelUsed?: string
  outputId?: string
  error?: string
}

interface ConversationUiState {
  composerMode: 'ask' | 'act'
  selectedActModel: string
  selectedModels: string[]
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
    composerMode: overrides.composerMode ?? 'ask',
    selectedActModel: overrides.selectedActModel ?? DEFAULT_MODEL_ID,
    selectedModels: [...(overrides.selectedModels ?? [DEFAULT_MODEL_ID])],
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
        <div className="h-5 text-xs font-medium text-[#71717a]">
          {multiStatusLabel}
        </div>
      ) : (!result || result.status === 'generating') ? (
        <p className="text-xs font-medium text-[#71717a]">
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
          className={`rounded-xl border border-red-100 bg-[linear-gradient(180deg,#fffafa_0%,#fff5f5_100%)] ${
            isMulti ? errorFrameClass : 'flex items-center gap-2 px-3 py-2 text-xs text-red-600'
          }`}
          style={!isMulti ? singleBoxStyle : undefined}
        >
          {isMulti ? (
            <div className="mx-auto flex max-w-[240px] flex-col items-center gap-2 px-5 text-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-red-500 shadow-sm">
                <AlertCircle size={18} />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-600">Generation failed</p>
                <p className="text-xs leading-relaxed text-red-500/90">{result.error ?? 'Please try again.'}</p>
              </div>
            </div>
          ) : (
            <>
              <AlertCircle size={12} />
              {result.error ?? 'Failed'}
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
      className={`relative group max-w-full shrink-0 overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f6f6f6] ${isMulti ? 'w-full' : ''} ${frameClass}`}
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
            isMulti ? 'object-contain object-center' : 'border border-[#e5e5e5] object-contain'
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
          className={`absolute inset-0 z-20 block h-full w-full rounded-xl ${isMulti ? 'object-contain object-center' : 'border border-[#e5e5e5]'} transition-opacity duration-300 ease-out ${
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
          className="pointer-events-auto shrink-0 rounded-full bg-white/92 p-1.5 shadow-sm transition-colors hover:bg-white"
          title="Download"
        >
          <Download size={13} className="text-[#0a0a0a]" />
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
}

function groupOutputsIntoExchanges(outputs: ChatOutput[]): RestoredOutputGroup[] {
  const sorted = outputs.slice().sort((a, b) => a.createdAt - b.createdAt)
  const groups: RestoredOutputGroup[] = []

  for (const output of sorted) {
    const prev = groups[groups.length - 1]
    const shouldMerge =
      prev &&
      prev.prompt === output.prompt &&
      prev.type === output.type &&
      Math.abs(output.createdAt - prev.createdAt) < 60_000

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

export default function ChatInterface({ userId: _userId, hideSidebar, projectName }: { userId: string; hideSidebar?: boolean; projectName?: string }) {
  void _userId
  const searchParams = useSearchParams()
  const { startSession, completeSession, markRead, setActiveViewer, getUnread, sessions } = useAsyncSessions()
  const { begin, done } = useNavigationProgress()
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
  const [composerMode, setComposerMode] = useState<'ask' | 'act'>('ask')
  const [selectedActModel, setSelectedActModel] = useState<string>(DEFAULT_MODEL_ID)
  const [selectedModels, setSelectedModels] = useState<string[]>([DEFAULT_MODEL_ID])
  const [isSwitchingChat, setIsSwitchingChat] = useState(false)
  const [exchangeModes, setExchangeModes] = useState<('ask' | 'act')[]>([])

  useEffect(() => {
    const saved = localStorage.getItem(CHAT_MODEL_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) setSelectedModels(parsed.slice(0, 4))
      } catch {
        setSelectedModels([saved])
      }
    }
    const savedAct = localStorage.getItem(ACT_MODEL_KEY)
    if (savedAct) setSelectedActModel(savedAct)
    const savedMode = localStorage.getItem(CHAT_GEN_MODE_KEY) as GenerationMode | null
    if (savedMode && ['text', 'image', 'video'].includes(savedMode)) setGenerationMode(savedMode)
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
  const lastGeneratedImageUrlRef = useRef<string | null>(null)

  const [showModelPicker, setShowModelPicker] = useState(false)
  const [hoveredModelId, setHoveredModelId] = useState<string | null>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)
  const [input, setInput] = useState('')
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const [pendingChatDocuments, setPendingChatDocuments] = useState<PendingChatDocument[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [composerNotice, setComposerNotice] = useState<string | null>(null)
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

  useEffect(() => {
    prevActBusyRef.current = false
  }, [activeChatId])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const shouldScrollRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modelPickerRef = useRef<HTMLDivElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const wasStreamingRef = useRef(false)
  /** After an Act stream ends, mirror `actChat.messages` into `chat0` so the primary transcript stays aligned for the next send. */
  const prevActBusyRef = useRef(false)
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

  const activeRuntime = activeChatId ? ensureConversationRuntime(activeChatId) : emptyRuntimeRef.current
  const chat0 = useChat({ chat: activeRuntime.askChats[0] })
  const chat1 = useChat({ chat: activeRuntime.askChats[1] })
  const chat2 = useChat({ chat: activeRuntime.askChats[2] })
  const chat3 = useChat({ chat: activeRuntime.askChats[3] })
  const actChat = useChat({ chat: activeRuntime.actChat })

  useEffect(() => {
    if (composerMode !== 'act') {
      prevActBusyRef.current = false
      return
    }
    const busy = actChat.status === 'streaming' || actChat.status === 'submitted'
    const wasBusy = prevActBusyRef.current
    prevActBusyRef.current = busy
    if (wasBusy && !busy && actChat.messages.length > 0) {
      chat0.setMessages([...actChat.messages])
    }
  }, [composerMode, actChat.status, actChat.messages, chat0])

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

  const isFreeTier = entitlements?.tier === 'free'
  const premiumModelBlocked =
    isFreeTier &&
    (composerMode === 'act'
      ? selectedActModel !== FREE_TIER_AUTO_MODEL_ID
      : selectedModels.some((id) => id !== FREE_TIER_AUTO_MODEL_ID))
  const creditsExhausted =
    !isFreeTier &&
    entitlements != null &&
    entitlements.creditsTotal > 0 &&
    entitlements.creditsUsed >= entitlements.creditsTotal * 100
  const isSendBlocked = premiumModelBlocked || creditsExhausted

  useEffect(() => {
    persistActiveRuntimeUiState()
  }, [persistActiveRuntimeUiState])

  useEffect(() => {
    if (!isFreeTier || activeChatId) return
    const askAlreadyAuto =
      selectedModels.length === 1 && selectedModels[0] === FREE_TIER_AUTO_MODEL_ID
    const actAlreadyAuto = selectedActModel === FREE_TIER_AUTO_MODEL_ID
    if (askAlreadyAuto && actAlreadyAuto) return

    setSelectedModels([FREE_TIER_AUTO_MODEL_ID])
    setSelectedActModel(FREE_TIER_AUTO_MODEL_ID)
    localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify([FREE_TIER_AUTO_MODEL_ID]))
    localStorage.setItem(ACT_MODEL_KEY, FREE_TIER_AUTO_MODEL_ID)
  }, [activeChatId, isFreeTier, selectedActModel, selectedModels])

  // ── data loading ──────────────────────────────────────────────────────────

  const loadSubscription = useCallback(async () => {
    try {
      const res = await fetch('/api/app/subscription')
      if (res.ok) setEntitlements(await res.json())
    } catch { /* ignore */ }
  }, [])

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
  const idParam = hideSidebar ? searchParams?.get('id') ?? null : null
  /** When chat is opened inside a project, files/docs attach to this project for search scoping. */
  const embedProjectId = hideSidebar ? searchParams?.get('projectId') ?? null : null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (idParam) void loadChat(idParam) }, [idParam])

  useEffect(() => {
    if (wasStreamingRef.current && !isActiveLoading && chat0.messages.length > 0) {
      loadSubscription()
    }
    wasStreamingRef.current = isActiveLoading
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

  const handleComposerModeChange = useCallback((next: 'ask' | 'act') => {
    if (next === 'act') {
      const best = pickBestModelForAct(selectedModels)
      setSelectedActModel(best)
      localStorage.setItem(ACT_MODEL_KEY, best)
    }
    setComposerMode(next)
  }, [selectedModels])

  // ── chat management ────────────────────────────────────────────────────────

  function clearTransientComposerState() {
    setPendingChatDocuments([])
    setSelectedImageModels([DEFAULT_IMAGE_MODEL_ID])
    setSelectedVideoModels([DEFAULT_VIDEO_MODEL_ID])
    setReplyContext(null)
    setAttachmentError(null)
    setComposerNotice(null)
  }

  function resetRuntimeState(runtime: ConversationRuntime, uiOverrides: Partial<ConversationUiState> = {}) {
    runtime.askChats.forEach((chat) => { chat.messages = [] })
    runtime.actChat.messages = []
    runtime.ui = createConversationUiState(uiOverrides)
    runtime.hydrated = true
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
      const newChat: Conversation = {
        _id: data.id,
        title: DEFAULT_CHAT_TITLE,
        lastModified: Date.now(),
        lastMode: composerMode,
        askModelIds: selectedModels,
        actModelId: selectedActModel,
      }
      setChats((prev) => [newChat, ...prev])
      const runtime = ensureConversationRuntime(data.id, {
        composerMode,
        selectedActModel,
        selectedModels,
        activeChatTitle: DEFAULT_CHAT_TITLE,
        isFirstMessage: true,
      })
      resetRuntimeState(runtime, {
        composerMode,
        selectedActModel,
        selectedModels,
        activeChatTitle: DEFAULT_CHAT_TITLE,
        isFirstMessage: true,
      })
      activeChatIdRef.current = data.id
      setActiveViewer(data.id)
      setActiveChatId(data.id)
      applyUiStateToView(runtime.ui)
      clearTransientComposerState()
      return data.id
    }
    return null
  }

  async function loadChat(chatId: string) {
    const requestId = ++loadChatRequestRef.current
    const progressToken = begin('secondary')
    persistActiveRuntimeUiState()
    clearTransientComposerState()
    markRead(chatId)
    activeChatIdRef.current = chatId
    setActiveViewer(chatId)
    setActiveChatId(chatId)
    const runtime = ensureConversationRuntime(chatId)
    const existingChat = chats.find((chat) => chat._id === chatId)
    pendingTitleRef.current = null
    setIsSwitchingChat(true)
    try {
      if (runtime.hydrated) {
        applyUiStateToView(runtime.ui)
        if (requestId === loadChatRequestRef.current) setIsSwitchingChat(false)
        return
      }

      const [messagesRes, outputsRes, metaRes] = await Promise.all([
        fetch(`/api/app/conversations?conversationId=${chatId}&messages=true`),
        fetch(`/api/app/outputs?conversationId=${chatId}`),
        fetch(`/api/app/conversations?conversationId=${chatId}`),
      ])
      if (requestId !== loadChatRequestRef.current) return
      if (!messagesRes.ok) return
      const data = await messagesRes.json()
      type RawMsg = {
        id: string
        turnId?: string
        mode?: 'ask' | 'act'
        role: 'user' | 'assistant'
        parts: Array<{ type: string; text?: string; url?: string; mediaType?: string }>
        model?: string
        metadata?: UserBubbleMetadata
        replyToTurnId?: string
        replySnippet?: string
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

      resetRuntimeState(runtime)

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
        const userPrompt = getMessageText(exchanges[idx].userMsg).trim()
        const matchIdx = outputGroups.findIndex((group, groupIdx) => (
          groupIdx >= nextOutputGroupIdx && group.prompt.trim() === userPrompt
        ))
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
        exchangeModes: exchangeModesFromServer,
        exchangeModels: restoredExchangeModels,
        selectedTabPerExchange: exchanges.map(() => 0),
        activeChatTitle: resolvedTitle,
        generationResults: restoredResults,
        exchangeGenTypes: restoredGenTypes,
        isFirstMessage: !hasUserMessages,
      })
      runtime.hydrated = true
      if (requestId !== loadChatRequestRef.current) return
      applyUiStateToView(runtime.ui)
    } catch { /* already cleared */ }
    finally {
      if (requestId === loadChatRequestRef.current) setIsSwitchingChat(false)
      done(progressToken)
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
      }))
      clearTransientComposerState()
      setActiveViewer(null)
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
    void fetch('/api/app/files/ingest-document', { method: 'POST', body: form })
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
    if (isActiveLoading) return

    if (pendingChatDocuments.some((d) => d.status === 'uploading')) {
      setAttachmentError('Wait for documents to finish indexing.')
      return
    }
    if (pendingChatDocuments.some((d) => d.status === 'error')) {
      setAttachmentError('Remove failed documents before sending.')
      return
    }

    // ── Image / Video generation path ──────────────────────────────────────
    if (effectiveGenType === 'image' || effectiveGenType === 'video') {
      if (!text && attachedImages.length === 0) return
      if (isSendBlocked) return
      const chatId = activeChatId || await createNewChat()
      if (!chatId) return
      const targetRuntime = ensureConversationRuntime(chatId)

      setInput('')
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

      const mediaUserMessage = {
        id: mediaTurnId,
        role: 'user',
        parts: [{ type: 'text', text }],
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

      if (effectiveGenType === 'image') {
        const imageUrl = targetRuntime.ui.lastGeneratedImageUrl
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
            body: JSON.stringify({ prompt: promptForModel, modelId, conversationId: chatId, turnId: mediaTurnId }),
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

    const userMeta: UserBubbleMetadata = {}
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

      // Assistant replies stream only into actChat; chat0 would still be user-only without this.
      // Base the next transcript on actChat so prior act assistant messages are not dropped.
      const actThreadBase: UIMessage[] =
        targetRuntime.actChat.messages.length > 0
          ? targetRuntime.actChat.messages
          : targetRuntime.askChats[0].messages
      const nextTranscript = [...actThreadBase, userUIMessage as UIMessage]
      targetRuntime.askChats[0].messages = nextTranscript
      targetRuntime.actChat.messages = nextTranscript

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
    ).then(() => {
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
    activeAskChats.slice(0, selectedModels.length).forEach((chat) => chat.stop())
    activeRuntime.actChat.stop()
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
  const userTurnCount = primaryMessages.filter((m) => m.role === 'user').length
  const latestExchIdx = userTurnCount > 0 ? userTurnCount - 1 : -1

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-w-0 overflow-x-hidden">
      {/* Sidebar — hidden when embedded in a project */}
      {!hideSidebar && (
        <>
          <div className="hidden h-full w-52 flex-col border-r border-[#e5e5e5] bg-[#f5f5f5] md:flex">
            <div className="flex h-16 items-center border-b border-[#e5e5e5] px-3">
              <button
                onClick={createNewChat}
                className="flex w-full items-center gap-1.5 rounded-md bg-[#0a0a0a] px-3 py-1.5 text-sm text-[#fafafa] transition-colors hover:bg-[#222]"
              >
                <Plus size={13} />
                New chat
              </button>
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
              {chats.map((chat) => {
                const isStreaming = sessions[chat._id]?.status === 'streaming'
                const unread = getUnread(chat._id)
                return (
                  <div
                    key={chat._id}
                    onClick={() => loadChat(chat._id)}
                    className={`group flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                      activeChatId === chat._id
                        ? 'bg-[#e8e8e8] text-[#0a0a0a]'
                        : 'text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
                    }`}
                  >
                    <span className="flex-1 truncate">{chat.title}</span>
                    {isStreaming && !unread && (
                      <span className="ml-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#525252]" />
                    )}
                    {unread > 0 && (
                      <span className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-[9px] font-medium text-[#fafafa]">
                        {unread}
                      </span>
                    )}
                    <button
                      onClick={(e) => deleteChat(chat._id, e)}
                      className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[#d8d8d8] group-hover:opacity-100"
                    >
                      <Trash2 size={11} />
                    </button>
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
                className="absolute bottom-0 left-0 right-0 flex max-h-[min(78vh,560px)] flex-col rounded-t-2xl border border-[#e5e5e5] border-b-0 bg-[#f5f5f5] shadow-[0_-8px_40px_rgba(0,0,0,0.12)]"
                role="dialog"
                aria-modal="true"
                aria-label="Chat history"
              >
                <div className="flex shrink-0 items-center justify-center pb-1 pt-2">
                  <span className="h-1 w-12 rounded-full bg-[#d4d4d4]" aria-hidden />
                </div>
                <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-2.5">
                  <span className="text-sm font-medium text-[#0a0a0a]">Chats</span>
                  <button
                    type="button"
                    onClick={() => setMobileChatListOpen(false)}
                    aria-label="Close"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[#525252]"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="border-b border-[#e5e5e5] px-3 py-2">
                  <button
                    onClick={() => {
                      void createNewChat().then(() => setMobileChatListOpen(false))
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[#0a0a0a] px-3 py-2 text-sm text-[#fafafa] transition-colors hover:bg-[#222]"
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
                      return (
                        <div
                          key={chat._id}
                          onClick={() => {
                            void loadChat(chat._id)
                            setMobileChatListOpen(false)
                          }}
                          className={`group flex items-center justify-between rounded-md px-2.5 py-2 text-xs transition-colors ${
                            activeChatId === chat._id
                              ? 'bg-[#e8e8e8] text-[#0a0a0a]'
                              : 'text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
                          }`}
                        >
                          <span className="flex-1 truncate">{chat.title}</span>
                          {isStreaming && !unread && (
                            <span className="ml-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#525252]" />
                          )}
                          {unread > 0 && (
                            <span className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-[9px] font-medium text-[#fafafa]">
                              {unread}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => deleteChat(chat._id, e)}
                            className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[#d8d8d8] group-hover:opacity-100"
                          >
                            <Trash2 size={11} />
                          </button>
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
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#fafafa]/90 border-2 border-dashed border-[#0a0a0a] rounded-lg m-2 pointer-events-none">
            <div className="text-center">
              <ImageIcon size={28} className="mx-auto mb-2 text-[#525252]" />
              <p className="text-sm font-medium text-[#0a0a0a]">Drop images or documents here</p>
            </div>
          </div>
        )}
        {/* Sticky header — stacked on small screens to avoid horizontal scroll */}
        <div className="shrink-0 border-b border-[#e5e5e5] px-3 md:px-4">
          <div className="flex h-auto min-h-0 flex-col gap-2 py-2 md:h-16 md:flex-row md:items-center md:justify-between md:gap-3 md:py-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="min-w-0 flex-1 text-sm font-medium leading-snug text-[#0a0a0a] md:max-w-[min(100%,20rem)] md:truncate lg:max-w-[24rem]">
                <span className="line-clamp-2 md:line-clamp-1 md:truncate">
                  {activeChatTitle ?? activeChat?.title ?? 'New conversation'}
                </span>
              </h2>
              {isSwitchingChat && (
                <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#e0e0e0] border-t-[#525252] animate-spin" />
              )}
              {projectName && (
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#e8e8e8] bg-[#f0f0f0] px-2 py-0.5 text-[10px] text-[#525252]">
                  <FolderOpen size={9} />
                  <span className="max-w-[6rem] truncate sm:max-w-none">{projectName}</span>
                </span>
              )}
            </div>

            {/* Model picker + Generation mode */}
            <div className="flex w-full min-w-0 flex-col gap-2 md:w-auto md:flex-none md:flex-row md:items-center md:gap-2">
              <div ref={modelPickerRef} className="relative w-full min-w-0 md:w-auto">
                <DelayedTooltip label="Choose model (⇧⌘/)" side="bottom">
                  <button
                    type="button"
                    onClick={() => !isActiveLoading && setShowModelPicker((v) => !v)}
                    disabled={isActiveLoading}
                    className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-md bg-[#f0f0f0] px-2.5 py-1.5 text-left text-xs md:w-auto md:max-w-[13rem] md:py-1 ${
                      isActiveLoading ? 'cursor-not-allowed text-[#aaa]' : 'text-[#525252] hover:bg-[#e8e8e8]'
                    }`}
                  >
                    <span className="min-w-0 truncate">{modelPickerLabel}</span>
                    <ChevronDown size={11} className="shrink-0" />
                  </button>
                </DelayedTooltip>
                {showModelPicker && (
                  <div
                    className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-[#e5e5e5] bg-white py-1 shadow-lg md:left-auto md:right-0 md:w-64"
                    onMouseLeave={() => setHoveredModelId(null)}
                  >
                  {generationMode === 'image' ? (
                    IMAGE_MODELS.map((m) => {
                        const isSel = selectedImageModels.includes(m.id)
                        const isDisabled = !isSel && selectedImageModels.length >= 4
                        return (
                          <button key={m.id}
                            disabled={isDisabled}
                            onClick={() => setSelectedImageModels((prev) => prev.includes(m.id) ? (prev.length > 1 ? prev.filter((x) => x !== m.id) : prev) : [...prev, m.id].slice(0, 4))}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                              isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#f5f5f5]'
                            } ${isSel ? 'text-[#0a0a0a] font-medium' : 'text-[#525252]'}`}>
                            <span className="flex items-center gap-2">
                              {isSel ? <Check size={10} /> : <span className="w-[10px] inline-block" />}
                              {m.name}
                            </span>
                          </button>
                        )
                      })
                  ) : generationMode === 'video' ? (
                    VIDEO_MODELS.map((m) => {
                        const isSel = selectedVideoModels.includes(m.id)
                        const isDisabled = !isSel && selectedVideoModels.length >= 4
                        return (
                          <button key={m.id}
                            disabled={isDisabled}
                            onClick={() => setSelectedVideoModels((prev) => prev.includes(m.id) ? (prev.length > 1 ? prev.filter((x) => x !== m.id) : prev) : [...prev, m.id].slice(0, 4))}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                              isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#f5f5f5]'
                            } ${isSel ? 'text-[#0a0a0a] font-medium' : 'text-[#525252]'}`}>
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
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#f5f5f5] ${
                            isSel ? 'text-[#0a0a0a] font-medium' : 'text-[#525252]'
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
                      const isDisabled = !isSelected && selectedModels.length >= 4
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleModel(m.id)}
                          disabled={isDisabled}
                          onMouseEnter={() => !isDisabled && setHoveredModelId(m.id)}
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                            isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#f5f5f5]'
                          } ${isSelected ? 'text-[#0a0a0a] font-medium' : 'text-[#525252]'}`}
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
        </div>

        {/* Messages */}
        <div
          ref={messagesScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4"
        >
          <div className="mx-auto flex min-h-full w-full min-w-0 max-w-4xl flex-col gap-5 sm:gap-6">
            {!hasHistory && (
              <div className="flex flex-1 items-center justify-center px-1 sm:px-0">
                <div className="w-full max-w-xl text-center">
                  <p className="mb-3 text-3xl" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
                    chat
                  </p>
                  <p className="mb-6 text-sm text-[#888]">Start a conversation with any AI model</p>
                  <div className="grid grid-cols-1 gap-2 text-xs text-[#525252] sm:grid-cols-2">
                    {CHAT_SUGGESTIONS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="rounded-lg border border-[#e5e5e5] p-2.5 text-left leading-snug hover:bg-[#f5f5f5] transition-colors"
                        onClick={() => setInput(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
                            className="max-w-[75%] rounded-lg border border-[#e5e5e5] bg-[#f0f0f0] px-2.5 py-1.5 text-left text-[11px] text-[#525252] transition-colors hover:bg-[#e8e8e8] hover:text-[#0a0a0a]"
                          >
                            <span className="flex items-center gap-1.5 font-medium text-[#0a0a0a]">
                              <Reply size={12} strokeWidth={1.75} className="shrink-0 text-[#71717a]" />
                              Replying to
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-[#71717a]">{mediaReplyMeta.replySnippet}</span>
                          </button>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <div className="chat-user-bubble min-w-0 max-w-[min(92%,36rem)] break-words select-text rounded-2xl rounded-br-sm bg-[#0a0a0a] px-3 py-2.5 text-sm leading-relaxed text-[#fafafa] sm:max-w-[75%] sm:px-4">
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
                            className="rounded-md p-1.5 text-[#71717a] transition-all hover:bg-[#f0f0f0] hover:text-[#0a0a0a] active:scale-90 active:bg-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-30"
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
                            className="rounded-md p-1.5 text-[#71717a] transition-all hover:bg-[#f0f0f0] hover:text-[#0a0a0a] active:scale-90 active:bg-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Reply"
                          >
                            <Reply size={14} strokeWidth={1.75} />
                          </button>
                          <span className="ml-2 shrink-0 text-left text-[11px] text-[#aaa]">{mediaModelLabel}</span>
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
                  isActExch
                    ? (actChat.status === 'streaming' || actChat.status === 'submitted')
                    : !!slotInst && (slotInst.status === 'streaming' || slotInst.status === 'submitted')
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

                const modelLabelSingle = getChatModelDisplayName(selectedModelId)
                const modelLabel =
                  exchModelList.length > 1
                    ? `${modelLabelSingle} · ${exchModelList.length} models`
                    : modelLabelSingle

                const textTurnIdForActions = getUserTurnId(msg)
                const textIsExiting = !!textTurnIdForActions && exitingTurnIds.includes(textTurnIdForActions)

                const assistantPlainForReply = assistantBlocksToPlainText(assistantVisualBlocks)

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
                    errorMessage={errorLabel(instError)}
                    exchModelList={exchModelList}
                    selectedTab={selectedTab}
                    onTabSelect={(tabIdx) => handleTabSelect(curExchIdx, tabIdx)}
                    isLoadingTabs={isActiveLoading}
                    responseInProgress={instLoading}
                    sourceCitations={sourceCitations}
                    turnIdForActions={textTurnIdForActions}
                    modelLabel={modelLabel}
                    onDeleteTurn={() => {
                      const tid = getUserTurnId(msg)
                      if (tid) void handleDeleteTurnById(tid)
                    }}
                    onReply={() =>
                      beginReplyToAssistantText(assistantPlainForReply, getUserTurnId(msg))
                    }
                    actionsLocked={isLatest && isActiveLoading}
                    isExiting={textIsExiting}
                    replyThreadMeta={getUserReplyThreadMeta(msg)}
                    onJumpToReply={jumpToReplyTarget}
                  />
                )
              }

              return blocks
            })()}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          {(attachedImages.length > 0 || pendingChatDocuments.length > 0) && (
            <div className="mx-auto w-full max-w-4xl mb-2 flex flex-wrap gap-2">
              {attachedImages.map((img, i) => (
                <div key={`img-${i}`} className="relative group">
                  <img src={img.dataUrl} alt={img.name}
                    className="w-16 h-16 object-cover rounded-lg border border-[#e5e5e5]" />
                  <button
                    onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#0a0a0a] text-[#fafafa] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}
              {pendingChatDocuments.map((doc) => (
                <div
                  key={doc.clientId}
                  className="relative group flex items-center gap-2 max-w-[220px] px-2.5 py-1.5 rounded-lg border border-[#e5e5e5] bg-white text-xs text-[#525252]"
                >
                  <FileText size={14} className="shrink-0 text-[#888]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#0a0a0a]">{doc.name}</p>
                    {doc.status === 'uploading' && (
                      <p className="text-[10px] text-[#aaa] mt-0.5 animate-pulse">Indexing…</p>
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
                    className="shrink-0 p-0.5 rounded hover:bg-[#f0f0f0] text-[#aaa]"
                    aria-label="Remove"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mx-auto w-full max-w-4xl">
            {attachmentError && (
              <div className="mb-2 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                <AlertCircle size={13} className="shrink-0" />
                {attachmentError}
              </div>
            )}
            {composerNotice && (
              <div className="mb-2 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <AlertCircle size={13} className="shrink-0 text-amber-600" />
                {composerNotice}
              </div>
            )}
            {isSendBlocked && !isActiveLoading ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#fafafa] border border-[#e5e5e5] text-xs text-[#888]">
                <AlertCircle size={13} className="text-amber-500 shrink-0" />
                {premiumModelBlocked
                  ? 'This model requires Pro. Switch to a free model or upgrade.'
                  : 'No credits remaining. Please top up your account.'}
              </div>
            ) : (
              <div className="overflow-visible rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                {replyContext && (
                  <div className="flex items-start gap-2 rounded-t-2xl border-b border-[#e5e5e5] bg-[#f0f0f0] px-3 py-2.5 text-xs text-[#525252]">
                    <Reply size={14} className="mt-0.5 shrink-0 text-[#71717a]" strokeWidth={1.75} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#0a0a0a]">Replying to prior response</p>
                      <p className="mt-0.5 line-clamp-2 text-[#71717a]">{replyContext.snippet}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyContext(null)}
                      className="shrink-0 rounded-md p-1 text-[#71717a] transition-colors hover:bg-[#e5e5e5] hover:text-[#0a0a0a]"
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
                  className="w-full min-h-11 resize-none border-0 bg-transparent px-0.5 py-1 text-sm leading-6 text-[#0a0a0a] shadow-none outline-none ring-0 placeholder:text-[#aaa] focus:ring-0"
                />
                <div className="mt-2 flex min-h-9 items-center gap-2">
                  <div ref={attachMenuRef} className="relative shrink-0">
                    <DelayedTooltip label="Attach files or switch to image/video" side="top">
                      <button
                        type="button"
                        onClick={() => setShowAttachMenu((v) => !v)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#71717a] transition-colors hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                      >
                        <Plus size={18} strokeWidth={1.75} />
                      </button>
                    </DelayedTooltip>
                  {showAttachMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white border border-[#e5e5e5] rounded-xl shadow-lg py-1 w-52 z-20">
                      <button
                        type="button"
                        onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false) }}
                        disabled={!supportsVision}
                        title={!supportsVision ? 'You need a vision model to attach images.' : undefined}
                        className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors ${
                          supportsVision
                            ? 'text-[#525252] hover:bg-[#f5f5f5]'
                            : 'text-[#bbb] cursor-not-allowed'
                        }`}
                      >
                        <ImageIcon size={13} className="text-[#0a0a0a]" />
                        <span>Attach Images</span>
                      </button>
                      <div className="border-t border-[#f0f0f0] my-1" />
                      <button
                        type="button"
                        onClick={() => { handleModeChange('image'); setShowAttachMenu(false) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors"
                      >
                        <ImageIcon size={13} className="text-[#0a0a0a]" />
                        <span>Generate Image</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleModeChange('video'); setShowAttachMenu(false) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors"
                      >
                        <Video size={13} className="text-[#0a0a0a]" />
                        <span>Generate Video</span>
                      </button>
                      <div className="border-t border-[#f0f0f0] my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          docInputRef.current?.click()
                          setShowAttachMenu(false)
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors"
                      >
                        <FileText size={13} />
                        <span>Documents</span>
                        <span className="ml-auto text-[10px] text-[#aaa]">PDF, Word, text</span>
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
                    <div className="flex shrink-0 items-center gap-1 rounded-full bg-[#0a0a0a] px-2 py-1 text-xs font-medium text-[#fafafa]">
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
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0a0a0a] text-[#fafafa] transition-colors hover:bg-[#333]"
                        >
                          <div className="h-3.5 w-3.5 rounded-sm bg-[#fafafa]" />
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
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0a0a0a] text-[#fafafa] transition-colors hover:bg-[#333] disabled:opacity-40"
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
        </div>

        {!hideSidebar && (
          <div className="shrink-0 border-t border-[#e5e5e5] bg-[#fafafa]/95 backdrop-blur md:hidden">
            <button
              type="button"
              onClick={() => setMobileChatListOpen(true)}
              className="flex w-full items-center justify-center gap-2 py-2.5 text-xs font-medium text-[#525252] active:bg-[#f0f0f0]"
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
