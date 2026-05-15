'use client'

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import posthog from 'posthog-js'
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
  RotateCw,
  Reply,
  GitBranch,
  Pencil,
  BrainCircuit,
  DollarSign,
  ArrowUp,
  Play,
  MessageSquare,
  BookOpen,
  Search,
  Maximize2,
  PanelRight,
  Zap,
  AtSign,
  ShieldCheck,
} from 'lucide-react'
import { Chat, useChat } from '@ai-sdk/react'
import { getToolName, isReasoningUIPart, isToolUIPart, type UIMessage } from 'ai'
import { useQuery } from 'convex/react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { TopUpPreferenceControl } from '@/components/billing/TopUpPreferenceControl'
import {
  DEFAULT_MODEL_ID,
  FREE_TIER_AUTO_MODEL_ID,
  FREE_TIER_DEFAULT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_VIDEO_MODEL_ID,
  isFreeTierChatModelId,
  isLegacyFreeTierDefaultModelId,
  type ChatModel,
  type GenerationMode,
  type VideoSubMode,
} from '@/lib/model-types'
import {
  IMAGE_MODELS,
  VIDEO_MODELS,
  getChatModelDisplayName,
  getModel,
  getModelsByIntelligence,
  getVideoModelsBySubMode,
  modelSupportsZeroDataRetention,
} from '@/lib/model-data'
import {
  ACT_MODEL_KEY,
  CHAT_MODEL_KEY,
  readStoredActModelId,
  readStoredAskModelIds,
} from '@/lib/chat-model-prefs'
import type { SourceCitationMap } from '@/lib/ask-knowledge-context'
import type { WebSourceItem } from '@/lib/web-sources'
import { webSourceDisplayKey } from '@/lib/web-sources'
import { safeHttpUrl } from '@/lib/safe-url'
import { GenerationModeSelect, GenerationModeToggle } from './GenerationModeToggle'
import {
  CHAT_CREATED_EVENT,
  CHAT_DELETED_EVENT,
  CHAT_MODIFIED_EVENT,
  CHAT_TITLE_UPDATED_EVENT,
  dispatchChatCreated,
  dispatchChatDeleted,
  dispatchChatModified,
  dispatchChatTitleUpdated,
  sanitizeChatTitle,
  type ChatCreatedDetail,
  type ChatModifiedDetail,
  type ChatDeletedDetail,
  type ChatTitleUpdatedDetail,
} from '@/lib/chat-title'
import {
  fetchChatList,
  getCachedChatList,
  primeChatList,
  removeCachedChat,
  upsertCachedChat,
} from '@/lib/chat-list-cache'
import { useAsyncSessions } from '@/lib/async-sessions-store'
import dynamic from 'next/dynamic'
const MarkdownMessage = dynamic(() => import('./MarkdownMessage').then((mod) => ({ default: mod.MarkdownMessage })))
import { WebSourcesSidebar } from './WebSourcesSidebar'
import { FileViewerPanel } from './FileViewer'
import { DelayedTooltip } from './DelayedTooltip'
import {
  normalizeAgentAssistantText,
  redactOpaqueNotebookFileIdsInVisibleText,
  splitRedactedThinkingSegments,
} from '@/lib/agent-assistant-text'
import type { OutputType } from '@/lib/output-types'
import { useAppSettings } from './AppSettingsProvider'
import { ExportMenu } from './ExportMenu'
import { useGuestGate } from './GuestGateProvider'
import { useAuth } from '@/contexts/AuthContext'
import { useConvexWorkOSToken } from '@/components/ConvexProviderWithWorkOS'
import {
  createPersistentChatTransport,
  getCloudflareChatStreamRelayApi,
} from '@/lib/cloudflare-chat-transport'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { DEFAULT_CHAT_SUGGESTIONS } from '@/lib/chat-suggestions-defaults'
import {
  buildSkillDraftFromTurn,
  type SkillDraftSummary,
} from '@/lib/skill-drafts'
import type { AutomationDraftSummary } from '@/lib/automation-drafts'
import { isOverlayGatedToolOutput } from '@/lib/overlay-gated-feature'
import { warmIntegrationLogoCache } from '@/lib/integration-logo-cache'
import { ConfirmDialog } from './ConfirmDialog'
import {
  ASSISTANT_COLLAPSIBLE_BODY_CLASS,
  CHAT_GEN_MODE_KEY,
  DEFAULT_CHAT_TITLE,
  IMAGE_MODEL_SELECTION_MODE_KEY,
  OVERLAY_LOGO_SRC,
  SELECTED_IMAGE_MODELS_KEY,
  SELECTED_VIDEO_MODELS_KEY,
  SUPPORTED_INPUT_IMAGE_TYPES,
  TOOL_UI_DONE_STATES,
  VIDEO_MODEL_SELECTION_MODE_KEY,
  VIDEO_SUB_MODE_KEY,
  VIDEO_SUB_MODE_LABELS,
  VIDEO_SUB_MODES,
} from './chat-interface/constants'
import { DraftReviewModal, FlashCopyIconButton } from './chat-interface/Modals'
import { AutomationEditorPanel, type AutomationDetail, type AutomationDetailTab, normalizeAutomationDetailTab, AUTOMATION_DETAIL_TABS } from './chat-interface/AutomationEditor'
import {
  applyLiveMessageDeltaParts,
  assistantBlocksToPlainText,
  buildAssistantVisualSegments,
  buildAssistantVisualSequence,
  buildMediaSummary,
  chatGreetingLine,
  chooseAssistantCandidate,
  collectWebSourcesFromBlocks,
  collectWebSourcesFromSingleBlock,
  computeToolChainFlags,
  errorLabel,
  faviconUrl,
  generateTitle,
  getDescriptiveToolLabel,
  getDraftFromToolBlock,
  getMessageImages,
  getMessageText,
  getRoutedModelId,
  getUserMessageDocNames,
  getUserReplyThreadMeta,
  getUserTurnId,
  groupOutputsIntoExchanges,
  hostFromUrl,
  pickFirstStringFromInput,
  resolveActAssistant,
  sanitizeEmptyChatStarters,
  scrollToExchangeTurn,
  splitUserDisplayText,
  stripAssistantAfterUserTurn,
} from './chat-interface/chatLogic'
import type {
  AskModelSelectionMode,
  AssistantVisualBlock,
  AttachedImage,
  ChatMessageMetadata,
  ChatOutput,
  Conversation,
  ConversationRuntime,
  ConversationUiState,
  DraftModalState,
  Entitlements,
  GenerationResult,
  LiveConversationMessage,
  LiveMessageDelta,
  PendingChatDocument,
  ToolGroupItem,
  ToolVisualBlock,
} from './chat-interface/types'
import { MentionInput, type MentionInputHandle } from './chat-interface/MentionInput'
import type { MentionItem } from './chat-interface/mention-types'

const LARGE_PASTE_WORD_LIMIT = 1_000
const LARGE_PASTE_CHAR_LIMIT = 30_000
const LARGE_PASTE_MAX_BYTES = 12 * 1024 * 1024

function exceedsWordLimit(value: string, limit: number): boolean {
  let count = 0
  let inWord = false
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    const isWhitespace = code <= 32 || code === 160
    if (isWhitespace) {
      inWord = false
    } else if (!inWord) {
      count += 1
      if (count > limit) return true
      inWord = true
    }
  }
  return false
}

function pastedTextFileName(value: string): string {
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
  const base = (firstLine ?? 'pasted-text')
    .replace(/[^a-zA-Z0-9 ._-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .toLowerCase()
  return `${base || 'pasted-text'}.txt`
}

function shouldAttachPastedTextAsFile(value: string): boolean {
  return value.length > LARGE_PASTE_CHAR_LIMIT || exceedsWordLimit(value, LARGE_PASTE_WORD_LIMIT)
}

function ModelBadges({ m, isFreeTier }: { m: ChatModel; isFreeTier: boolean }) {
  const router = useRouter()
  const showUpgrade = isFreeTier && m.cost > 0

  return (
    <span className="flex h-5 shrink-0 items-center gap-1">
      {showUpgrade && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            router.push('/account')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
              router.push('/account')
            }
          }}
          className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded"
          style={{ background: 'var(--chat-badge-upgrade-bg)', color: 'var(--chat-badge-upgrade-fg)' }}
        >
          <ArrowUp size={10} strokeWidth={2} />
        </span>
      )}
      {m.supportsVision && (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--surface-subtle)] text-[var(--muted)]">
          <ImageIcon size={10} strokeWidth={1.75} />
        </span>
      )}
      {m.supportsReasoning && (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--surface-subtle)] text-[var(--muted)]">
          <BrainCircuit size={10} strokeWidth={1.75} />
        </span>
      )}
    </span>
  )
}

function MetricRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
        <Icon size={11} strokeWidth={1.75} className="shrink-0 text-[var(--muted-light)]" />
        <span>{label}</span>
      </div>
      <span className="whitespace-nowrap text-[11px] font-medium tabular-nums text-[var(--foreground)]">{value}</span>
    </div>
  )
}

function ModelQualitiesPanel({ modelId }: { modelId: string }) {
  const m = getModel(modelId)
  if (!m) return null
  return (
    <div className="pointer-events-none flex flex-col gap-1">
      <MetricRow
        icon={BrainCircuit}
        label="Intelligence"
        value={Math.round(m.intelligence)}
      />
      <MetricRow
        icon={DollarSign}
        label="Cost"
        value={m.cost === 0 ? 'Free' : `$${(m.pricePer1mTokens ?? m.cost).toFixed(2)}/M`}
      />
      <MetricRow
        icon={Zap}
        label="Speed"
        value={m.medianOutputTokensPerSecond ? `${Math.round(m.medianOutputTokensPerSecond)} t/s` : 'N/A'}
      />
      <MetricRow
        icon={ShieldCheck}
        label="ZDR"
        value={
          <span className="inline-flex items-center gap-1 text-[var(--foreground)]">
            {m.supportsZeroDataRetention ? <Check size={11} strokeWidth={2} /> : <X size={11} strokeWidth={2} />}
          </span>
        }
      />
    </div>
  )
}

function cloneUiMessageForThread(msg: UIMessage): UIMessage {
  try {
    return structuredClone(msg) as UIMessage
  } catch {
    return JSON.parse(JSON.stringify(msg)) as UIMessage
  }
}



function ToolLineLogo() {
  return (
    <Image
      src={OVERLAY_LOGO_SRC}
      alt=""
      width={8}
      height={8}
      className="mt-[5px] size-2 shrink-0 select-none"
      draggable={false}
    />
  )
}

/** Vertical connector between consecutive tool rows (logo stays top-aligned; line in logo column). */
function ToolLogoColumn({ connectTop, connectBottom }: { connectTop: boolean; connectBottom: boolean }) {
  const showLine = connectTop || connectBottom
  const logoBottom = 'calc(0.3125rem + 0.5rem)' /* mt-[5px] + size-2 */
  return (
    <div className="relative flex w-2 shrink-0 flex-col items-center self-stretch">
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
      <div className="relative z-[1] shrink-0 rounded-full bg-[var(--background)]">
        <ToolLineLogo />
      </div>
      <div className="min-h-0 flex-1" />
    </div>
  )
}

/**
 * Standalone reasoning block: while the reasoning part is actively streaming we auto-expand
 * and render the text through `MarkdownMessage` (same formatting as the main assistant reply).
 * Once the reasoning finishes we collapse to a single row with a chevron the user can toggle.
 */
function ReasoningBlock({
  text,
  streaming,
  connectTop,
  connectBottom,
}: {
  text: string
  streaming: boolean
  connectTop: boolean
  connectBottom: boolean
}) {
  const [userExpanded, setUserExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (streaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [text, streaming])
  const hasContent = text.trim().length > 0
  const label = streaming ? 'Thinking' : 'Thought'
  const showDetails = streaming ? hasContent : userExpanded && hasContent

  return (
    <div className="w-full px-1 py-0.5">
      <div className="max-w-[min(100%,36rem)]">
        <div className="flex items-stretch gap-2.5 py-1 text-[13px] leading-snug">
          <ToolLogoColumn connectTop={connectTop} connectBottom={connectBottom} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={streaming ? 'tool-line-shimmer' : 'text-[var(--tool-line-label)]'}>
                {label}
              </span>
              {!streaming && hasContent ? (
                <button
                  type="button"
                  onClick={() => setUserExpanded((open) => !open)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                  aria-label={userExpanded ? 'Collapse reasoning' : 'Expand reasoning'}
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
        {hasContent ? (
          <div
            className={`ml-[26px] overflow-hidden transition-[max-height] duration-300 ${
              showDetails ? 'max-h-[min(42vh,304px)] pt-1 pb-2' : 'max-h-0'
            }`}
          >
            {showDetails ? (
              <div
                ref={scrollRef}
                className={`message-appear reasoning-markdown text-[12px] leading-relaxed text-[var(--muted)] ${ASSISTANT_COLLAPSIBLE_BODY_CLASS} ${streaming ? '[scrollbar-width:none]' : '[scrollbar-width:thin]'}`}
              >
                <MarkdownMessage
                  text={text}
                  isStreaming={streaming}
                  suppressTypingIndicator
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Web search tool: shows the query and the top sources in a compact list (favicon + title + host),
 * inspired by Perplexity/ChatGPT search previews. While the tool runs we auto-expand the details;
 * once it finishes we collapse to a single row and the user can click the chevron to re-open.
 */
function WebSearchToolBlock({
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
  const running = !isDone && !isError
  const queryRaw =
    pickFirstStringFromInput(block.toolInput, ['query', 'q', 'objective']) ?? ''
  const query = queryRaw.trim()
  const label = getDescriptiveToolLabel(block.name, block.toolInput)
  const [userExpanded, setUserExpanded] = useState(false)
  const sources = useMemo(() => collectWebSourcesFromSingleBlock(block), [block])
  const visibleSources = sources.slice(0, 3)
  const extraCount = Math.max(0, sources.length - visibleSources.length)
  const hasDetails = query.length > 0 || sources.length > 0
  const showDetails =
    (running && hasDetails) || (isDone && userExpanded && hasDetails)

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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1">
              <span className={running ? 'tool-line-shimmer' : 'text-[var(--tool-line-label)]'}>
                {label}
              </span>
              {hasDetails && isDone ? (
                <button
                  type="button"
                  onClick={() => setUserExpanded((open) => !open)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                  aria-label={userExpanded ? 'Collapse web search details' : 'Expand web search details'}
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
            className={`ml-[26px] overflow-hidden transition-[max-height] duration-300 ${
              showDetails ? 'max-h-[min(42vh,304px)] pt-1 pb-2' : 'max-h-0'
            }`}
          >
            {showDetails ? (
              <div className={`message-appear flex flex-col gap-1.5 ${ASSISTANT_COLLAPSIBLE_BODY_CLASS} [scrollbar-width:thin]`}>
                {query ? (
                  <div className="flex min-w-0 items-center gap-2 text-[12px] leading-snug text-[var(--muted)]">
                    <Search size={12} strokeWidth={1.75} className="shrink-0 opacity-70" aria-hidden />
                    <span className="min-w-0 truncate">{query}</span>
                  </div>
                ) : null}
                {visibleSources.length > 0 ? (
                  <ul className="flex flex-col">
                    {visibleSources.flatMap((source, idx) => {
                      const safeUrl = safeHttpUrl(source.url)
                      if (!safeUrl) return []
                      const site = webSourceDisplayKey(source.url)
                      const fav = faviconUrl(source.url)
                      const host = hostFromUrl(source.url) || site
                      const titleCandidate = source.title?.trim() || ''
                      const isTitleJustHost =
                        !titleCandidate ||
                        titleCandidate.toLowerCase() === host.toLowerCase() ||
                        titleCandidate.toLowerCase() === site.toLowerCase()
                      const displayTitle = isTitleJustHost ? host : titleCandidate
                      return (
                        <li key={`${source.url}-${idx}`}>
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex min-w-0 items-center gap-2 rounded-md py-0.5 text-[12px] leading-snug transition-colors hover:text-[var(--foreground)]"
                          >
                            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-elevated)] ring-1 ring-[var(--border)]">
                              {fav ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={fav} alt="" className="h-3 w-3" width={12} height={12} />
                              ) : (
                                <span className="text-[8px] font-semibold text-[var(--muted)]">
                                  {site.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </span>
                            <span className="min-w-0 truncate text-[var(--muted)] group-hover:text-[var(--foreground)]">
                              {displayTitle}
                            </span>
                            <span className="shrink-0 text-[11px] text-[var(--muted)] opacity-60">{site}</span>
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
                {extraCount > 0 ? (
                  <div className="text-[12px] text-[var(--muted)] opacity-70">+{extraCount} more</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
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

function GatedPaidFeatureCallout({
  block,
  connectTop,
  connectBottom,
}: {
  block: ToolVisualBlock
  connectTop: boolean
  connectBottom: boolean
}) {
  const out = block.toolOutput as { message?: unknown }
  const line =
    typeof out.message === 'string' && out.message.trim() ? out.message.trim() : 'This requires a paid plan.'
  return (
    <div className="w-full px-1 py-0.5">
      <div className="flex w-full max-w-full items-start justify-start gap-2.5">
        <ToolLogoColumn connectTop={connectTop} connectBottom={connectBottom} />
        <p className="w-fit max-w-[min(100%,22rem)] rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
          {line}{' '}
          <Link
            href="/pricing"
            className="whitespace-nowrap font-medium text-[var(--foreground)] underline underline-offset-2 hover:opacity-80"
          >
            Upgrade
          </Link>
        </p>
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
  items,
  connectTop,
  connectBottom,
}: {
  items: ToolGroupItem[]
  connectTop: boolean
  connectBottom: boolean
}) {
  const [open, setOpen] = useState(false)
  const tools = items.filter((it): it is ToolVisualBlock => it.kind === 'tool')
  const n = tools.length
  const anyRunning =
    tools.some((t) => !TOOL_UI_DONE_STATES.has(t.state)) ||
    items.some((it) => it.kind === 'reasoning' && it.state !== 'done')
  const anyErr = tools.some((t) => t.state === 'output-error' || t.state === 'output-denied')
  const summary =
    anyErr
      ? `${n} tools called`
      : anyRunning
        ? n === 1 ? '1 tool in progress' : `${n} tools in progress`
        : n === 1 ? '1 tool called' : `${n} tools called`

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
          {items.map((it, idx) => {
            const top = idx > 0
            const bot = idx < items.length - 1
            if (it.kind === 'reasoning') {
              return (
                <ReasoningBlock
                  key={`r-${it.key}`}
                  text={it.text}
                  streaming={it.state === 'streaming'}
                  connectTop={top}
                  connectBottom={bot}
                />
              )
            }
            return isOverlayGatedToolOutput(it.toolOutput) ? (
              <GatedPaidFeatureCallout
                key={it.key}
                block={it}
                connectTop={top}
                connectBottom={bot}
              />
            ) : (
              <ToolCallRowWithReasoning
                key={it.key}
                block={it}
                variant="nested"
                connectTop={top}
                connectBottom={bot}
              />
            )
          })}
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
  const label = getDescriptiveToolLabel('interactive_browser_session', block.toolInput)
  const running = !isDone && !isError
  const hasDetails = Boolean(task || liveUrl)
  /** After the tool finishes, details start collapsed; user expands with the chevron. */
  const [userExpanded, setUserExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (running && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [task, running])
  const showDetails =
    (running && Boolean(task)) || (isDone && userExpanded && hasDetails)

  if (isOverlayGatedToolOutput(block.toolOutput)) {
    return (
      <GatedPaidFeatureCallout
        block={block}
        connectTop={connectTop}
        connectBottom={connectBottom}
      />
    )
  }

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
            className={`ml-[26px] overflow-hidden transition-[max-height] duration-300 ${
              showDetails ? 'max-h-[min(42vh,304px)] pt-2' : 'max-h-0'
            }`}
          >
            {showDetails ? (
              <div
                ref={scrollRef}
                key={userExpanded ? 'open' : running ? 'streaming' : 'closed'}
                className={`space-y-3 message-appear ${ASSISTANT_COLLAPSIBLE_BODY_CLASS} ${running ? '[scrollbar-width:none]' : '[scrollbar-width:thin]'}`}
              >
                {task ? (
                  <div className="reasoning-markdown text-[12px] leading-relaxed text-[var(--muted)]">
                    <MarkdownMessage
                      text={task}
                      isStreaming={running}
                      suppressTypingIndicator
                    />
                  </div>
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

function extractMemoryContents(name: string, toolInput?: Record<string, unknown>): string[] {
  if (!toolInput) return []
  if (name === 'save_memory' || name === 'update_memory') {
    const c = toolInput.content
    return typeof c === 'string' && c.trim() ? [c.trim()] : []
  }
  if (name === 'save_memory_batch') {
    const arr = toolInput.memories
    if (!Array.isArray(arr)) return []
    const out: string[] = []
    for (const m of arr) {
      if (m && typeof m === 'object' && typeof (m as { content?: unknown }).content === 'string') {
        const s = ((m as { content: string }).content).trim()
        if (s) out.push(s)
      }
    }
    return out
  }
  return []
}

function MemoryToolBlock({
  block,
  connectTop,
  connectBottom,
}: {
  block: ToolVisualBlock
  connectTop: boolean
  connectBottom: boolean
}) {
  const isDone = TOOL_UI_DONE_STATES.has(block.state)
  const isError = block.state === 'output-error' || block.state === 'output-denied'
  const running = !isDone && !isError
  const contents = extractMemoryContents(block.name, block.toolInput)
  const hasDetails = contents.length > 0
  const baseLabel = getDescriptiveToolLabel(block.name, block.toolInput)
  const label = contents.length > 1 ? `Saving ${contents.length} memories` : baseLabel
  const [userExpanded, setUserExpanded] = useState(false)
  const showDetails = isDone && userExpanded && hasDetails

  if (isError) {
    return (
      <div className="w-full px-1 py-0.5">
        <div className="flex max-w-[min(100%,36rem)] items-stretch gap-2.5 py-1 text-[13px] leading-snug">
          <ToolLogoColumn connectTop={connectTop} connectBottom={connectBottom} />
          <span className="min-w-0 flex-1 text-red-600">{baseLabel} — couldn’t complete</span>
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
                  aria-label={userExpanded ? 'Collapse saved memories' : 'Expand saved memories'}
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
            className={`ml-[26px] overflow-hidden transition-[max-height] duration-300 ${
              showDetails ? 'max-h-[min(42vh,304px)] pt-2' : 'max-h-0'
            }`}
          >
            {showDetails ? (
              <ul className={`message-appear space-y-1 ${ASSISTANT_COLLAPSIBLE_BODY_CLASS} pr-1 [scrollbar-width:thin]`}>
                {contents.map((c, i) => (
                  <li
                    key={i}
                    className="text-[12px] leading-relaxed text-[var(--muted)]"
                  >
                    {c}
                  </li>
                ))}
              </ul>
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

function renderInlineMentions(
  text: string,
  mentions?: Array<{ type: string; id: string; name: string }>
): React.ReactNode {
  if (!mentions?.length || !text) return text
  const sorted = [...mentions].sort((a, b) => b.name.length - a.name.length)
  const escaped = sorted.map((m) => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`@(${escaped.join('|')})`, 'g')
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(
      <span
        key={match.index}
        className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-muted)] border border-[var(--border)] px-1.5 py-0.5 text-xs font-medium text-[var(--foreground)] align-middle mx-0.5"
      >
        {match[0]}
      </span>
    )
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}


// ─── ExchangeBlock ───────────────────────────────────────────────────────────

interface ExchangeBlockProps {
  userMsgId: string
  userBodyText: string
  userDocumentNames: string[]
  userIndexedAttachments?: { name: string; fileIds: string[] }[]
  userImages: string[]
  exchIdx: number
  /** Model id for this tab — stable key for markdown remount when picker slots change */
  responseModelId: string
  /** Ordered tools, text, and file parts as they appear in the assistant message */
  assistantVisualBlocks: AssistantVisualBlock[]
  isStreaming: boolean
  isTextStreaming: boolean
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
  onBranch: () => void
  /** User stopped streaming for this exchange; show notice + footer actions. */
  interrupted?: boolean
  actionsLocked: boolean
  isExiting?: boolean
  replyThreadMeta: { replyToTurnId: string; replySnippet: string } | null
  onJumpToReply: (turnId: string) => void
  onOpenDraft: (state: DraftModalState) => void
  /** Open the shared sources sidebar with these web sources (lifted to ChatInterface). */
  onOpenSources: (turnId: string, sources: WebSourceItem[]) => void
  /** Whether the shared sidebar is currently showing this exchange's sources. */
  isSourcesOpenForThis: boolean
  onRetry?: () => void
  retryDisabled?: boolean
  onOpenFilePreview?: (name: string, fileIds: string[]) => void
  userMentions?: Array<{ type: string; id: string; name: string }>
  onContinue?: () => void
}

function ExchangeBlock({
  userMsgId, userBodyText, userDocumentNames, userIndexedAttachments, userImages, exchIdx, responseModelId, assistantVisualBlocks, isStreaming, isTextStreaming, errorMessage,
  exchModelList, selectedTab, onTabSelect, isLoadingTabs, responseInProgress, sourceCitations,
  turnIdForActions, modelLabel, onDeleteTurn, onReply, onBranch, interrupted = false, actionsLocked, isExiting = false, replyThreadMeta, onJumpToReply,
  onOpenDraft, onOpenSources, isSourcesOpenForThis, onRetry, retryDisabled = true, onOpenFilePreview, userMentions, onContinue,
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
    const webSources = useMemo(() => collectWebSourcesFromBlocks(assistantVisualBlocks), [assistantVisualBlocks])
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
        className={`relative flex flex-col gap-2 message-appear transition-all duration-300 ease-out ${
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
                {userDocumentNames.map((name) => {
                  const attachment = userIndexedAttachments?.find((a) => a.name === name)
                  const clickable = !!attachment && attachment.fileIds.length > 0 && !!onOpenFilePreview
                  return (
                    <div
                      key={name}
                      className={`flex max-w-[220px] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs text-[var(--muted)] shadow-sm ${clickable ? 'cursor-pointer hover:bg-[var(--surface-subtle)] transition-colors' : ''}`}
                      onClick={() => {
                        if (clickable) onOpenFilePreview!(name, attachment.fileIds)
                      }}
                      title={clickable ? 'Click to preview' : undefined}
                    >
                      <FileText size={13} className="shrink-0 text-[var(--muted)]" />
                      <span className="truncate font-medium text-[var(--foreground)]">{name}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {showTextBubble && (
              <div className="chat-user-bubble ml-auto min-w-0 max-w-full break-words select-text rounded-2xl rounded-br-sm border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-sm leading-relaxed text-[var(--foreground)] sm:px-4">
                <span className="whitespace-pre-wrap">{renderInlineMentions(userBodyText, userMentions)}</span>
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
            // Actively streaming = still emitting reasoning deltas (or message-level stream and
            // this part has not been explicitly marked `done`). Everything else collapses.
            const active =
              (isStreaming && seg.block.state === 'streaming') ||
              (isStreaming && seg.block.state !== 'done' && seg.originIndex === assistantVisualBlocks.length - 1)
            return (
              <ReasoningBlock
                key={`${exchIdx}-seq-r-${seg.originIndex}-${seg.block.key}`}
                text={seg.block.text}
                streaming={active}
                connectTop={chain.chainTop}
                connectBottom={chain.chainBottom}
              />
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
            const onlyTools = seg.items.every((it): it is ToolVisualBlock => it.kind === 'tool')
            if (onlyTools && seg.items.length === 1) {
              const t = seg.items[0] as ToolVisualBlock
              const draft = getDraftFromToolBlock(t)
              if (draft) {
                const isAutomationDraft = draft.kind === 'automation'
                return (
                  <DraftSuggestionCard
                    key={`${exchIdx}-draft-${seg.originIndex}-${t.key}`}
                    title={draft.draft.name}
                    description={draft.draft.description}
                    badge={isAutomationDraft ? 'Automation Draft' : 'Skill Draft'}
                    reason={draft.draft.reason}
                    primaryLabel="Review draft"
                    secondaryLabel={isAutomationDraft ? 'Create automation' : 'Save skill'}
                    onPrimary={() => onOpenDraft(draft)}
                    onSecondary={() => onOpenDraft(draft)}
                  />
                )
              }
              if (isOverlayGatedToolOutput(t.toolOutput)) {
                return (
                  <GatedPaidFeatureCallout
                    key={`${exchIdx}-gated-${seg.originIndex}-${t.key}`}
                    block={t}
                    connectTop={chain.chainTop}
                    connectBottom={chain.chainBottom}
                  />
                )
              }
              if (t.name === 'perplexity_search' || t.name === 'parallel_search') {
                return (
                  <WebSearchToolBlock
                    key={`${exchIdx}-seq-${seg.originIndex}-${t.key}`}
                    block={t}
                    connectTop={chain.chainTop}
                    connectBottom={chain.chainBottom}
                  />
                )
              }
              if (t.name === 'save_memory' || t.name === 'save_memory_batch' || t.name === 'update_memory') {
                return (
                  <MemoryToolBlock
                    key={`${exchIdx}-seq-${seg.originIndex}-${t.key}`}
                    block={t}
                    connectTop={chain.chainTop}
                    connectBottom={chain.chainBottom}
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
                items={seg.items}
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
                isStreaming={isTextStreaming && isLastText}
                sourceCitations={isLastText ? sourceCitations : undefined}
                webSources={isLastText && webSources.length > 0 ? webSources : undefined}
                suppressTypingIndicator
              />
            </div>
          )
        })}

        {responseInProgress && assistantVisualBlocks.length === 0 && (
          <div className="flex items-center px-1 py-2 min-h-7" aria-live="polite" aria-busy="true">
            <span
              className="overlay-stream-marker overlay-stream-marker--standalone"
              aria-label="Response loading"
              role="img"
            />
          </div>
        )}

        {responseInProgress && assistantVisualBlocks.length > 0 && !errorMessage ? (
          <div className="flex items-center px-1 py-1 min-h-5" aria-live="polite" aria-busy="true">
            <span
              className="overlay-stream-marker overlay-stream-marker--standalone scale-75 opacity-80"
              aria-label="Response still generating"
              role="img"
            />
          </div>
        ) : null}

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

        {onContinue && responseSettled && !errorMessage && (
          <div className="flex justify-start px-1 py-1">
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
            >
              <Play size={13} strokeWidth={1.75} />
              Continue
            </button>
          </div>
        )}

        {showFooter && (
          <div className="message-appear flex items-center gap-1 px-1 pt-0.5">
            <FlashCopyIconButton
              copyText={copyPlainText}
              disabled={copyPlainText.length === 0 || isExiting}
              ariaLabel="Copy response"
            />
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={retryDisabled}
                className="rounded-md p-1.5 text-[var(--muted)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-90 active:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Regenerate response"
                title="Regenerate response"
              >
                <RotateCw size={14} strokeWidth={1.75} />
              </button>
            )}
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
            <button
              type="button"
              onClick={onBranch}
              disabled={!turnIdForActions || actionsLocked || isExiting}
              className="rounded-md p-1.5 text-[var(--muted)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-90 active:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Branch chat from here"
              title="Branch chat from here"
            >
              <GitBranch size={14} strokeWidth={1.75} />
            </button>
            {webSources.length > 0 ? (
              <button
                type="button"
                onClick={() => onOpenSources(turnIdForActions ?? userMsgId, webSources)}
                disabled={isExiting}
                className={`ml-0.5 inline-flex items-center gap-1 rounded-md px-2 py-1.5 transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30 ${
                  isSourcesOpenForThis
                    ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                    : 'text-[var(--muted)]'
                }`}
                aria-label="Open sources"
                aria-pressed={isSourcesOpenForThis}
              >
                <BookOpen size={14} strokeWidth={1.75} className="shrink-0" />
                <span className="text-[11px] font-medium">Sources</span>
              </button>
            ) : null}
            <span className="ml-2 min-w-0 text-left text-[11px] text-[var(--muted-light)]">{modelLabel}</span>
          </div>
        )}

      </div>
    )
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

function sameModelSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const bSet = new Set(b)
  return a.every((modelId) => bSet.has(modelId))
}

function sameModelOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((modelId, index) => modelId === b[index])
}

function latestTextExchangeIndex(ui: ConversationUiState): number {
  for (let i = ui.exchangeModels.length - 1; i >= 0; i--) {
    if ((ui.exchangeGenTypes[i] ?? 'text') === 'text') return i
  }
  return -1
}

function selectedModelForExchange(ui: ConversationUiState, exchangeIndex: number): string | null {
  if (exchangeIndex < 0) return null
  const models = ui.exchangeModels[exchangeIndex] ?? []
  if (models.length === 0) return null
  const selectedTab = Math.min(
    Math.max(ui.selectedTabPerExchange[exchangeIndex] ?? 0, 0),
    models.length - 1,
  )
  return models[selectedTab] ?? models[0] ?? null
}

function cloneUiMessageThread(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => cloneUiMessageForThread(message))
}

function createConversationUiState(
  overrides: Partial<ConversationUiState> = {},
): ConversationUiState {
  return {
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
  const actTransport = '/api/app/conversations/act'
  const transport = () => createPersistentChatTransport({
    api: actTransport,
    prepareSendMessagesRequest: ({ api, id, messages, body, headers, credentials, trigger, messageId }) => ({
      api,
      headers,
      credentials,
      body: {
        ...body,
        id,
        messages: messages.at(-1) ? [messages.at(-1)] : [],
        trigger,
        messageId,
      },
    }),
  })
  const askChats: ConversationRuntime['askChats'] = [
    new Chat({
      id: `${chatId}:ask:0`,
      transport: transport(),
    }),
    new Chat({
      id: `${chatId}:ask:1`,
      transport: transport(),
    }),
    new Chat({
      id: `${chatId}:ask:2`,
      transport: transport(),
    }),
    new Chat({
      id: `${chatId}:ask:3`,
      transport: transport(),
    }),
  ]

  return {
    askChats,
    actChat: new Chat({
      id: `${chatId}:act`,
      transport: transport(),
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
        className={`media-gen-mesh media-gen-mesh--fill pointer-events-none z-10 rounded-xl transition-opacity duration-300 ease-out ${
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


// ─── main component ───────────────────────────────────────────────────────────

export default function ChatInterface({
  userId,
  firstName,
  hideSidebar,
  projectName,
  mode = 'chat',
  hideHeader = false,
  belowEmptyComposer,
}: {
  userId: string | null
  firstName?: string
  hideSidebar?: boolean
  projectName?: string
  mode?: 'chat' | 'automate'
  hideHeader?: boolean
  belowEmptyComposer?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { settings } = useAppSettings()
  const { user: authUser } = useAuth()
  const convexAccessToken = useConvexWorkOSToken()
  const { startSession, completeSession, markRead, setActiveViewer, getUnread, sessions } = useAsyncSessions()
  const activeChatIdRef = useRef<string | null>(null)
  const loadChatRequestRef = useRef(0)
  const liveGeneratingByChatRef = useRef(new Map<string, boolean>())
  const appliedLiveDeltaIdsRef = useRef(new Set<string>())
  const resumedCloudflareStreamsRef = useRef(new Set<string>())
  const runtimesRef = useRef(new Map<string, ConversationRuntime>())
  const emptyRuntimeRef = useRef(createConversationRuntime('__empty__'))

  // Clear active viewer + ref when this tab unmounts so any in-flight .then() sees isActive=false
  useEffect(() => {
    return () => {
      activeChatIdRef.current = null
      setActiveViewer(null)
    }
  }, [setActiveViewer])

  const [chats, setChats] = useState<Conversation[]>(() => getCachedChatList() ?? [])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [, forceLiveSyncRender] = useState(0)
  const [runtimeHydrationVersion, setRuntimeHydrationVersion] = useState(0)
  /** Lifted sources-panel state so the sidebar sits beside the chat area and shrinks it,
   *  matching the AppSidebar width-transition pattern instead of overlaying the composer. */
  const [sourcesPanel, setSourcesPanel] = useState<{ turnId: string; sources: WebSourceItem[] } | null>(null)
  const openSourcesPanel = useCallback((turnId: string, sources: WebSourceItem[]) => {
    setSourcesPanel((prev) => (prev && prev.turnId === turnId ? null : { turnId, sources }))
  }, [])
  const closeSourcesPanel = useCallback(() => setSourcesPanel(null), [])
  /** File preview dialog state. */
  const [filePreview, setFilePreview] = useState<{ name: string; fileId: string } | null>(null)
  const [filePreviewContent, setFilePreviewContent] = useState('')
  const openFilePreview = useCallback(async (name: string, fileIds: string[]) => {
    const fileId = fileIds[0]
    if (!fileId) return
    setFilePreview({ name, fileId })
    try {
      const res = await fetch(`/api/app/files/${fileId}/content`)
      if (res.ok) {
        const text = await res.text()
        setFilePreviewContent(text)
      } else {
        setFilePreviewContent('')
      }
    } catch {
      setFilePreviewContent('')
    }
  }, [])
  const closeFilePreview = useCallback(() => {
    setFilePreview(null)
    setFilePreviewContent('')
  }, [])
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
    if ((restoredSelectedModels?.length ?? 1) > 1) {
      setAskModelSelectionMode('multiple')
    }
    const savedAct = localStorage.getItem(ACT_MODEL_KEY)
    if (savedAct) setSelectedActModel(savedAct)
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

  // Warm integration logo cache so Composio logos render in chat connect cards.
  useEffect(() => {
    void warmIntegrationLogoCache()
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
  /** Viewport position for the fixed model-qualities flyout (tracks hovered row). */
  const [modelQualitiesPos, setModelQualitiesPos] = useState<{ x: number; y: number } | null>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showModeMenu, setShowModeMenu] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)
  const lastStreamChunkAtRef = useRef<number>(Date.now())
  const autoContinuedForMessageRef = useRef<Set<string>>(new Set())
  const [input, setInputState] = useState('')
  const [inputRevision, setInputRevision] = useState(0)
  const [hasComposerText, setHasComposerText] = useState(false)
  const inputRef = useRef(input)
  const setInput = useCallback((next: string | ((previous: string) => string)) => {
    const resolved = typeof next === 'function' ? next(inputRef.current) : next
    inputRef.current = resolved
    setInputState(resolved)
    setHasComposerText(resolved.trim().length > 0)
    setInputRevision((value) => value + 1)
  }, [])
  const handleComposerInputChange = useCallback((text: string) => {
    inputRef.current = text
    const hasText = text.trim().length > 0
    setHasComposerText((previous) => (previous === hasText ? previous : hasText))
  }, [])

  // Restore guest draft after hydration so server/client initial renders match
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const draft = sessionStorage.getItem('overlay:guest-draft')
      if (draft) {
        sessionStorage.removeItem('overlay:guest-draft')
        setInput(draft)
      }
    } catch { /* ignore */ }
  }, [setInput])

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
  const DEFAULT_AUTOMATE_SUGGESTIONS = [
    'Email me a daily digest of my top priorities',
    'Monitor a website and alert me when it changes',
    'Summarize my unread Slack messages every morning',
    'Run a weekly report and send it to my team',
  ]
  const [emptyChatStarters, setEmptyChatStarters] = useState<string[]>(() =>
    mode === 'automate'
      ? DEFAULT_AUTOMATE_SUGGESTIONS
      : sanitizeEmptyChatStarters([...DEFAULT_CHAT_SUGGESTIONS], firstName)
  )

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
  const [deletingChatIds, setDeletingChatIds] = useState<string[]>([])
  const [activeChatDeleting, setActiveChatDeleting] = useState(false)
  /** Mobile: chat history opens from bottom sheet (primary sidebar is desktop-only). */
  const [mobileChatListOpen, setMobileChatListOpen] = useState(false)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingChatTitle, setEditingChatTitle] = useState('')
  const [confirmDeleteChat, setConfirmDeleteChat] = useState<{ id: string; title: string } | null>(null)
  const [selectedAutomation, setSelectedAutomation] = useState<AutomationDetail | null>(null)
  const [selectedAutomationLoading, setSelectedAutomationLoading] = useState(false)
  const [draftModalState, setDraftModalState] = useState<DraftModalState | null>(null)
  const [isDraftSaving, setIsDraftSaving] = useState(false)

  useEffect(() => {
    setExitingTurnIds([])
    appliedLiveDeltaIdsRef.current.clear()
    if (
      !pendingScrollTurnIdRef.current ||
      (pendingScrollChatIdRef.current && pendingScrollChatIdRef.current !== activeChatId)
    ) {
      pendingScrollTurnIdRef.current = null
      pendingScrollChatIdRef.current = null
    }
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
  const pendingScrollTurnIdRef = useRef<string | null>(null)
  const pendingScrollChatIdRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<MentionInputHandle>(null)
  const [mentions, setMentions] = useState<MentionItem[]>([])
  const modelPickerRef = useRef<HTMLDivElement>(null)
  const videoSubModePickerRef = useRef<HTMLDivElement>(null)
  const modelPickerListScrollRef = useRef<HTMLDivElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const modeMenuRef = useRef<HTMLDivElement>(null)

  const syncModelQualitiesPosition = useCallback((modelId: string | null) => {
    if (typeof document === 'undefined' || !modelId || !modelPickerRef.current) {
      setModelQualitiesPos(null)
      return
    }
    const row = modelPickerRef.current.querySelector(`[data-model-row="${CSS.escape(modelId)}"]`)
    if (!row || !(row instanceof HTMLElement)) {
      setModelQualitiesPos(null)
      return
    }
    const r = row.getBoundingClientRect()
    setModelQualitiesPos({ x: r.left - 8, y: r.top + r.height / 2 })
  }, [])
  const wasStreamingRef = useRef(false)
  const ttftSendTimeRef = useRef<number | null>(null)
  const ttftLoggedRef = useRef(false)
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
    if (!runtime.hydrated) return
    runtime.ui = buildActiveUiStateSnapshot()
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

  const resetActiveChatAfterDelete = useCallback((chatId: string) => {
    runtimesRef.current.delete(chatId)
    if (activeChatIdRef.current !== chatId) return

    activeChatIdRef.current = null
    pendingTitleRef.current = null
    setActiveChatId(null)
    setActiveChatTitle(null)
    setInterruptedExchangeIdx(null)
    setSourcesPanel(null)
    setMobileChatListOpen(false)
    const storedAsk = readStoredAskModelIds()
    const storedAct = readStoredActModelId()
    applyUiStateToView(createConversationUiState({
      selectedActModel: storedAct,
      selectedModels: storedAsk,
      askModelSelectionMode: storedAsk.length > 1 ? 'multiple' : 'single',
      activeChatTitle: null,
      isFirstMessage: true,
    }))
    clearTransientComposerState()
    setActiveViewer(null)
    if (!hideSidebar) router.replace('/app/chat')
  }, [
    applyUiStateToView,
    hideSidebar,
    router,
    setActiveViewer,
  ])

  useEffect(() => {
    function handleChatUpserted(event: Event) {
      const { detail } = event as CustomEvent<ChatCreatedDetail | ChatModifiedDetail>
      const nextChat = detail?.chat
      if (!nextChat?._id) return
      upsertCachedChat(nextChat)
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
      upsertCachedChat({
        _id: detail.chatId,
        title: detail.title,
        lastModified: Date.now(),
      })
      setChats((prev) => {
        const existing = prev.find((chat) => chat._id === detail.chatId)
        if (!existing) return prev
        const updated = { ...existing, title: detail.title, lastModified: Date.now() }
        return [updated, ...prev.filter((chat) => chat._id !== detail.chatId)]
      })
      updateRuntimeUiState(detail.chatId, (prev) => ({ ...prev, activeChatTitle: detail.title }))
      if (activeChatIdRef.current === detail.chatId) {
        setActiveChatTitle(detail.title)
      }
    }

    function handleChatDeleted(event: Event) {
      const { detail } = event as CustomEvent<ChatDeletedDetail>
      if (!detail?.chatId) return
      const deletedChatId = detail.chatId
      removeCachedChat(deletedChatId)
      setDeletingChatIds((prev) => (
        prev.includes(deletedChatId) ? prev : [...prev, deletedChatId]
      ))
      if (activeChatIdRef.current === deletedChatId) {
        setActiveChatDeleting(true)
      }
      window.setTimeout(() => {
        setChats((prev) => prev.filter((chat) => chat._id !== deletedChatId))
        setDeletingChatIds((prev) => prev.filter((id) => id !== deletedChatId))
        if (activeChatIdRef.current === deletedChatId) {
          resetActiveChatAfterDelete(deletedChatId)
        }
        setActiveChatDeleting(false)
      }, 180)
    }
    window.addEventListener(CHAT_CREATED_EVENT, handleChatUpserted)
    window.addEventListener(CHAT_MODIFIED_EVENT, handleChatUpserted)
    window.addEventListener(CHAT_TITLE_UPDATED_EVENT, handleChatTitleUpdated)
    window.addEventListener(CHAT_DELETED_EVENT, handleChatDeleted)
    return () => {
      window.removeEventListener(CHAT_CREATED_EVENT, handleChatUpserted)
      window.removeEventListener(CHAT_MODIFIED_EVENT, handleChatUpserted)
      window.removeEventListener(CHAT_TITLE_UPDATED_EVENT, handleChatTitleUpdated)
      window.removeEventListener(CHAT_DELETED_EVENT, handleChatDeleted)
    }
  }, [resetActiveChatAfterDelete, updateRuntimeUiState])

  const activeRuntime = activeChatId ? ensureConversationRuntime(activeChatId) : emptyRuntimeRef.current
  const chatStreamRelayApi = getCloudflareChatStreamRelayApi()
  const chat0 = useChat({ chat: activeRuntime.askChats[0] })
  const chat1 = useChat({ chat: activeRuntime.askChats[1] })
  const chat2 = useChat({ chat: activeRuntime.askChats[2] })
  const chat3 = useChat({ chat: activeRuntime.askChats[3] })
  const actChat = useChat({ chat: activeRuntime.actChat })
  const chat0Ref = useRef(chat0)
  const chat1Ref = useRef(chat1)
  const chat2Ref = useRef(chat2)
  const chat3Ref = useRef(chat3)
  const actChatRef = useRef(actChat)
  chat0Ref.current = chat0
  chat1Ref.current = chat1
  chat2Ref.current = chat2
  chat3Ref.current = chat3
  actChatRef.current = actChat
  const liveMessages = useQuery(
    api.conversations.watchGeneratingMessages,
    activeChatId && authUser?.id && convexAccessToken
      ? {
          conversationId: activeChatId as Id<'conversations'>,
          userId: authUser.id,
          accessToken: convexAccessToken,
        }
      : 'skip',
  ) as Array<LiveConversationMessage> | undefined
  const liveMessageDeltas = useQuery(
    api.conversations.watchGeneratingMessageDeltas,
    activeChatId && authUser?.id && convexAccessToken
      ? {
          conversationId: activeChatId as Id<'conversations'>,
          userId: authUser.id,
          accessToken: convexAccessToken,
        }
      : 'skip',
  ) as Array<LiveMessageDelta> | undefined

  const chatInstances = useMemo(() => [chat0, chat1, chat2, chat3], [chat0, chat1, chat2, chat3])
  const activeAskChats = activeRuntime.askChats
  const activePersistedGenerating =
    (liveMessages ?? []).some(
      (message) => message.role === 'assistant' && message.status === 'generating',
    ) ||
    activeRuntime.actChat.messages.some((message) => {
      const m = message as unknown as { role?: string; status?: string }
      return m.role === 'assistant' && m.status === 'generating'
    }) ||
    activeRuntime.askChats.some((chat) =>
      chat.messages.some((message) => {
        const m = message as unknown as { role?: string; status?: string }
        return m.role === 'assistant' && m.status === 'generating'
      }),
    )

  const isActiveLoading =
    activeAskChats.some((c) => c.status === 'streaming' || c.status === 'submitted') ||
    actChat.status === 'streaming' ||
    actChat.status === 'submitted' ||
    activePersistedGenerating

  const supportsVision = getModel(selectedActModel)?.supportsVision ?? false

  useEffect(() => {
    if (!activeChatId || !chatStreamRelayApi) return
    const hasLocalHttpStream =
      actChat.status === 'streaming' ||
      actChat.status === 'submitted' ||
      chatInstances.some((chat) => chat.status === 'streaming' || chat.status === 'submitted')
    if (hasLocalHttpStream) return

    const targets = new Map<string, { turnId: string; variantIndex: number }>()
    const collect = (messages: UIMessage[]) => {
      for (const message of messages) {
        const m = message as unknown as {
          role?: string
          status?: string
          turnId?: string
          id?: string
          variantIndex?: number
        }
        if (m.role !== 'assistant' || m.status !== 'generating') continue
        const turnId = m.turnId?.trim() || ''
        if (!turnId) continue
        const variantIndex = m.variantIndex ?? 0
        targets.set(`${turnId}:${variantIndex}`, { turnId, variantIndex })
      }
    }

    for (const message of liveMessages ?? []) {
      if (message.role !== 'assistant' || message.status !== 'generating') continue
      const turnId = message.turnId?.trim() || ''
      if (!turnId) continue
      const variantIndex = message.variantIndex ?? 0
      targets.set(`${turnId}:${variantIndex}`, { turnId, variantIndex })
    }
    collect(activeRuntime.actChat.messages as UIMessage[])
    for (const chat of activeRuntime.askChats) collect(chat.messages as UIMessage[])

    for (const target of targets.values()) {
      const key = `${activeChatId}:${target.turnId}:${target.variantIndex}`
      if (resumedCloudflareStreamsRef.current.has(key)) continue
      const slotChat = chatInstances[target.variantIndex]
      const slotHasGenerating = slotChat?.messages.some((message) => {
        const m = message as unknown as { role?: string; status?: string; turnId?: string; variantIndex?: number }
        return (
          m.role === 'assistant' &&
          m.status === 'generating' &&
          m.turnId === target.turnId &&
          (m.variantIndex ?? 0) === target.variantIndex
        )
      })
      const targetChat = slotHasGenerating && slotChat ? slotChat : actChat
      resumedCloudflareStreamsRef.current.add(key)
      console.info('[chat-stream] path=cloudflare resume-request', {
        conversationId: activeChatId,
        turnId: target.turnId,
        variantIndex: target.variantIndex,
      })
      void targetChat.resumeStream({
        body: {
          conversationId: activeChatId,
          turnId: target.turnId,
          variantIndex: target.variantIndex,
          multiModelSlotIndex: target.variantIndex,
        },
      }).catch((error) => {
        resumedCloudflareStreamsRef.current.delete(key)
        console.warn('[chat-stream] path=cloudflare resume-failed', {
          conversationId: activeChatId,
          turnId: target.turnId,
          variantIndex: target.variantIndex,
          reason: error instanceof Error ? error.message : String(error),
        })
      })
    }
  }, [activeChatId, activeRuntime, actChat, chatInstances, chatStreamRelayApi, liveMessages])

  const isPaidSubscription = (entitlements?.planKind ?? (entitlements?.tier === 'free' ? 'free' : 'paid')) === 'paid'
  const budgetTotalCents = entitlements
    ? (entitlements.budgetTotalCents ?? Math.max(0, Math.round((entitlements.creditsTotal ?? 0) * 100)))
    : 0
  const budgetUsedCents = entitlements
    ? (entitlements.budgetUsedCents ?? Math.max(0, Math.round(entitlements.creditsUsed ?? 0)))
    : 0
  const budgetRemainingCents = entitlements
    ? (entitlements.budgetRemainingCents ?? Math.max(0, budgetTotalCents - budgetUsedCents))
    : 0
  const isBudgetExhaustedPaid = isPaidSubscription && budgetRemainingCents <= 0
  const isFreeTier = !isPaidSubscription || isBudgetExhaustedPaid
  const effectiveOnlyAllowZdrModels = isPaidSubscription && !isBudgetExhaustedPaid && settings.onlyAllowZdrModels
  const selectableTextModels = useMemo(() => {
    const models = getModelsByIntelligence(isFreeTier)
      .filter((m) => m.id !== 'nvidia/nemotron-nano-9b-v2')
    return effectiveOnlyAllowZdrModels
      ? models.filter((m) => m.supportsZeroDataRetention)
      : models
  }, [effectiveOnlyAllowZdrModels, isFreeTier])
  const premiumModelBlocked =
    isFreeTier && !isFreeTierChatModelId(selectedActModel)
  const isSendBlocked = premiumModelBlocked

  useEffect(() => {
    persistActiveRuntimeUiState()
  }, [persistActiveRuntimeUiState])

  useEffect(() => {
    if (!chatPrefsHydrated || !isFreeTier || activeChatId) return
    if (isFreeTierChatModelId(selectedActModel) && !isLegacyFreeTierDefaultModelId(selectedActModel)) return

    setSelectedModels([FREE_TIER_DEFAULT_MODEL_ID])
    setAskModelSelectionMode('single')
    setSelectedActModel(FREE_TIER_DEFAULT_MODEL_ID)
    localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify([FREE_TIER_DEFAULT_MODEL_ID]))
    localStorage.setItem(ACT_MODEL_KEY, FREE_TIER_DEFAULT_MODEL_ID)
  }, [chatPrefsHydrated, activeChatId, isFreeTier, selectedActModel])

  useEffect(() => {
    if (!chatPrefsHydrated || !effectiveOnlyAllowZdrModels) return
    const fallback = selectableTextModels[0]?.id
    if (!fallback) return
    const nextSelected = selectedModels.filter((id) => modelSupportsZeroDataRetention(id)).slice(0, 4)
    const resolvedSelected = nextSelected.length > 0 ? nextSelected : [fallback]
    const nextActModel = modelSupportsZeroDataRetention(selectedActModel) ? selectedActModel : resolvedSelected[0]!
    const changed =
      resolvedSelected.length !== selectedModels.length ||
      resolvedSelected.some((id, index) => id !== selectedModels[index]) ||
      nextActModel !== selectedActModel
    if (!changed) return
    setSelectedModels(resolvedSelected)
    setSelectedActModel(nextActModel)
    if (resolvedSelected.length === 1) setAskModelSelectionMode('single')
    if (!activeChatId) {
      try { localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(resolvedSelected)) } catch { /* ignore */ }
      try { localStorage.setItem(ACT_MODEL_KEY, nextActModel) } catch { /* ignore */ }
    }
  }, [
    activeChatId,
    chatPrefsHydrated,
    effectiveOnlyAllowZdrModels,
    selectableTextModels,
    selectedActModel,
    selectedModels,
  ])

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
      const serverChats = await fetchChatList({ force: true })
      const nextChats = pending
        ? serverChats.map((c) => (c._id === pending.chatId ? { ...c, title: pending.title } : c))
        : serverChats
      setChats(nextChats)
      if (pending) {
        primeChatList(nextChats)
      }
      // Clear the ref once the server has confirmed the title
      if (pending && serverChats.some((c) => c._id === pending.chatId && c.title === pending.title)) {
        if (pendingTitleRef.current?.chatId === pending.chatId) pendingTitleRef.current = null
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!activeChatId || !liveMessages) return
    const hasLocalHttpStream =
      activeChatIdRef.current === activeChatId &&
      (
        actChat.status === 'streaming' ||
        actChat.status === 'submitted' ||
        [chat0, chat1, chat2, chat3].some((chat) => chat.status === 'streaming' || chat.status === 'submitted')
      )
    if (hasLocalHttpStream) return
    const liveGeneratingMessages = liveMessages.filter(
      (message) => message.role === 'assistant' && message.status === 'generating',
    )
    const hadGenerating = liveGeneratingByChatRef.current.get(activeChatId) === true
    liveGeneratingByChatRef.current.set(activeChatId, liveGeneratingMessages.length > 0)
    const runtime = runtimesRef.current.get(activeChatId)
    if (!runtime) {
      if (hadGenerating && liveGeneratingMessages.length === 0) {
        completeSession(activeChatId, activeChatIdRef.current === activeChatId)
        void loadChats()
      }
      return
    }

    let changed = false
    const patchList = (messages: UIMessage[], incoming: (typeof liveMessages)[number]) => {
      if (incoming.role !== 'assistant') return false
      const variant = incoming.variantIndex ?? 0
      const nextMessage = {
        id: incoming._id,
        role: 'assistant' as const,
        parts: incoming.parts?.length
          ? incoming.parts
          : [{ type: 'text', text: incoming.content ?? '' }],
        metadata: {
          ...(incoming.routedModelId ? { routedModelId: incoming.routedModelId } : {}),
        },
        turnId: incoming.turnId,
        mode: incoming.mode,
        model: incoming.modelId,
        variantIndex: incoming.variantIndex,
        status: incoming.status,
      } as unknown as UIMessage

      const existingIdx = messages.findIndex((message) => {
        const m = message as unknown as { id?: string; turnId?: string; role?: string; variantIndex?: number }
        return (
          m.id === incoming._id ||
          (m.role === 'assistant' &&
            m.turnId === incoming.turnId &&
            (m.variantIndex ?? 0) === variant)
        )
      })
      if (existingIdx >= 0) {
        messages[existingIdx] = nextMessage
        return true
      }
      const userIdx = messages.findIndex((message) => {
        const m = message as unknown as { turnId?: string; id?: string; role?: string }
        return m.role === 'user' && (m.turnId === incoming.turnId || m.id === incoming.turnId)
      })
      if (userIdx >= 0) {
        messages.splice(userIdx + 1, 0, nextMessage)
        return true
      }
      return false
    }

    for (const incoming of liveMessages) {
      if (incoming.mode === 'act') {
        changed = patchList(runtime.actChat.messages as UIMessage[], incoming) || changed
        const slot = incoming.variantIndex ?? 0
        if (slot >= 0 && slot < runtime.askChats.length) {
          changed = patchList(runtime.askChats[slot]!.messages as UIMessage[], incoming) || changed
        }
      }
    }

    if (changed) {
      runtime.actChat.messages = [...runtime.actChat.messages]
      for (const chat of runtime.askChats) chat.messages = [...chat.messages]
      if (activeChatIdRef.current === activeChatId) {
        actChat.setMessages([...runtime.actChat.messages] as UIMessage[])
        chat0.setMessages([...runtime.askChats[0]!.messages] as UIMessage[])
        chat1.setMessages([...runtime.askChats[1]!.messages] as UIMessage[])
        chat2.setMessages([...runtime.askChats[2]!.messages] as UIMessage[])
        chat3.setMessages([...runtime.askChats[3]!.messages] as UIMessage[])
      }
      forceLiveSyncRender((value) => value + 1)
    }
    if (hadGenerating && liveGeneratingMessages.length === 0) {
      completeSession(activeChatId, activeChatIdRef.current === activeChatId)
      void loadChats()
    }
  }, [activeChatId, actChat, chat0, chat1, chat2, chat3, completeSession, liveMessages, loadChats, runtimeHydrationVersion])

  useEffect(() => {
    if (!activeChatId || !liveMessageDeltas?.length) return
    const hasLocalHttpStream =
      activeChatIdRef.current === activeChatId &&
      (
        actChat.status === 'streaming' ||
        actChat.status === 'submitted' ||
        [chat0, chat1, chat2, chat3].some((chat) => chat.status === 'streaming' || chat.status === 'submitted')
      )
    if (hasLocalHttpStream) return
    const runtime = runtimesRef.current.get(activeChatId)
    if (!runtime) return

    let changed = false
    const applyDeltaToList = (messages: UIMessage[], delta: LiveMessageDelta) => {
      const existingIdx = messages.findIndex((message) => {
        const m = message as unknown as { id?: string; role?: string }
        return m.role === 'assistant' && m.id === delta.messageId
      })
      if (existingIdx < 0) return false
      const existing = messages[existingIdx] as unknown as {
        parts?: Array<Record<string, unknown>>
      }
      messages[existingIdx] = {
        ...messages[existingIdx],
        parts: applyLiveMessageDeltaParts(existing.parts ?? [], delta),
      } as UIMessage
      return true
    }

    for (const delta of liveMessageDeltas) {
      if (appliedLiveDeltaIdsRef.current.has(delta._id)) continue
      let applied = false
      applied = applyDeltaToList(runtime.actChat.messages as UIMessage[], delta) || applied
      for (const chat of runtime.askChats) {
        applied = applyDeltaToList(chat.messages as UIMessage[], delta) || applied
      }
      if (applied) {
        appliedLiveDeltaIdsRef.current.add(delta._id)
        changed = true
      }
    }

    if (!changed) return
    runtime.actChat.messages = [...runtime.actChat.messages]
    for (const chat of runtime.askChats) chat.messages = [...chat.messages]
    if (activeChatIdRef.current === activeChatId) {
      actChat.setMessages([...runtime.actChat.messages] as UIMessage[])
      chat0.setMessages([...runtime.askChats[0]!.messages] as UIMessage[])
      chat1.setMessages([...runtime.askChats[1]!.messages] as UIMessage[])
      chat2.setMessages([...runtime.askChats[2]!.messages] as UIMessage[])
      chat3.setMessages([...runtime.askChats[3]!.messages] as UIMessage[])
    }
    forceLiveSyncRender((value) => value + 1)
    lastStreamChunkAtRef.current = Date.now()
  }, [activeChatId, actChat, chat0, chat1, chat2, chat3, liveMessageDeltas, liveMessages])

  // When loadChat finishes it bumps runtimeHydrationVersion. Explicitly sync the
  // runtime's loaded messages to the current useChat instances so the greeting
  // disappears immediately. Using refs avoids stale closures from loadChat.
  useEffect(() => {
    if (!activeChatId) return
    const runtime = runtimesRef.current.get(activeChatId)
    if (!runtime) return
    if (chat0Ref.current.messages !== runtime.askChats[0].messages) {
      chat0Ref.current.setMessages([...runtime.askChats[0].messages] as UIMessage[])
    }
    if (chat1Ref.current.messages !== runtime.askChats[1].messages) {
      chat1Ref.current.setMessages([...runtime.askChats[1].messages] as UIMessage[])
    }
    if (chat2Ref.current.messages !== runtime.askChats[2].messages) {
      chat2Ref.current.setMessages([...runtime.askChats[2].messages] as UIMessage[])
    }
    if (chat3Ref.current.messages !== runtime.askChats[3].messages) {
      chat3Ref.current.setMessages([...runtime.askChats[3].messages] as UIMessage[])
    }
    if (actChatRef.current.messages !== runtime.actChat.messages) {
      actChatRef.current.setMessages([...runtime.actChat.messages] as UIMessage[])
    }
  }, [activeChatId, runtimeHydrationVersion])

  useEffect(() => {
    if (!activeChatId) return
    const hasLocalHttpStream =
      activeChatIdRef.current === activeChatId &&
      (
        actChat.status === 'streaming' ||
        actChat.status === 'submitted' ||
        [chat0, chat1, chat2, chat3].some((chat) => chat.status === 'streaming' || chat.status === 'submitted')
      )
    if (hasLocalHttpStream) return
    const sessionIsStreaming = sessions[activeChatId]?.status === 'streaming'
    const liveQuerySawGenerating = liveGeneratingByChatRef.current.get(activeChatId) === true
    if (!sessionIsStreaming && !liveQuerySawGenerating && !activePersistedGenerating) return

    let cancelled = false
    const patchFromServer = async () => {
      try {
        const messagesParams = new URLSearchParams({
          conversationId: activeChatId,
          messages: 'true',
        })
        const res = await fetch(`/api/app/conversations?${messagesParams.toString()}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        })
        if (!res.ok || cancelled || activeChatIdRef.current !== activeChatId) return
        const data = await res.json() as {
          messages?: Array<{
            id: string
            turnId?: string
            role: 'user' | 'assistant'
            mode?: 'ask' | 'act'
            parts?: Array<Record<string, unknown>>
            model?: string
            variantIndex?: number
            routedModelId?: string
            status?: 'generating' | 'completed' | 'error'
          }>
        }
        const runtime = runtimesRef.current.get(activeChatId)
        if (!runtime) return
        const assistantRows = (data.messages ?? []).filter((message) => message.role === 'assistant')
        let changed = false
        const patchList = (messages: UIMessage[], incoming: (typeof assistantRows)[number]) => {
          const variant = incoming.variantIndex ?? 0
          const nextMessage = {
            id: incoming.id,
            role: 'assistant' as const,
            parts: incoming.parts?.length ? incoming.parts : [{ type: 'text', text: '' }],
            metadata: {
              ...(incoming.routedModelId ? { routedModelId: incoming.routedModelId } : {}),
            },
            turnId: incoming.turnId,
            mode: incoming.mode ?? 'act',
            model: incoming.model,
            variantIndex: incoming.variantIndex,
            status: incoming.status,
          } as unknown as UIMessage
          const existingIdx = messages.findIndex((message) => {
            const m = message as unknown as { id?: string; turnId?: string; role?: string; variantIndex?: number }
            return (
              m.id === incoming.id ||
              (m.role === 'assistant' &&
                m.turnId === incoming.turnId &&
                (m.variantIndex ?? 0) === variant)
            )
          })
          if (existingIdx < 0) {
            const userIdx = messages.findIndex((message) => {
              const m = message as unknown as { id?: string; turnId?: string; role?: string }
              return m.role === 'user' && (m.turnId === incoming.turnId || m.id === incoming.turnId)
            })
            if (userIdx < 0) return false
            messages.splice(userIdx + 1, 0, nextMessage)
            return true
          }
          const existing = messages[existingIdx] as unknown as { parts?: unknown; status?: string }
          if (
            existing.status === incoming.status &&
            JSON.stringify(existing.parts ?? []) === JSON.stringify((nextMessage as unknown as { parts?: unknown }).parts ?? [])
          ) {
            return false
          }
          messages[existingIdx] = nextMessage
          return true
        }
        for (const incoming of assistantRows) {
          if ((incoming.mode ?? 'act') !== 'act') continue
          changed = patchList(runtime.actChat.messages as UIMessage[], incoming) || changed
          const slot = incoming.variantIndex ?? 0
          if (slot >= 0 && slot < runtime.askChats.length) {
            changed = patchList(runtime.askChats[slot]!.messages as UIMessage[], incoming) || changed
          }
        }
        if (!changed) return
        runtime.actChat.messages = [...runtime.actChat.messages]
        for (const chat of runtime.askChats) chat.messages = [...chat.messages]
        actChat.setMessages([...runtime.actChat.messages] as UIMessage[])
        chat0.setMessages([...runtime.askChats[0]!.messages] as UIMessage[])
        chat1.setMessages([...runtime.askChats[1]!.messages] as UIMessage[])
        chat2.setMessages([...runtime.askChats[2]!.messages] as UIMessage[])
        chat3.setMessages([...runtime.askChats[3]!.messages] as UIMessage[])
        forceLiveSyncRender((value) => value + 1)
        if (!assistantRows.some((message) => message.status === 'generating')) {
          liveGeneratingByChatRef.current.set(activeChatId, false)
          completeSession(activeChatId, true)
          void loadChats()
        }
      } catch {
        // Ignore transient reconnect failures; the next tick or Convex subscription can recover.
      }
    }

    void patchFromServer()
    const interval = window.setInterval(() => {
      void patchFromServer()
    }, 5000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [activeChatId, actChat, activePersistedGenerating, chat0, chat1, chat2, chat3, completeSession, loadChats, mode, sessions])

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

  const markChatModified = useCallback((chatId: string, title?: string | null) => {
    const existingTitle =
      title ||
      activeChatTitle ||
      chats.find((chat) => chat._id === chatId)?.title ||
      DEFAULT_CHAT_TITLE
    const chat = {
      _id: chatId,
      title: existingTitle,
      lastModified: Date.now(),
    }
    upsertCachedChat(chat)
    setChats((prev) => {
      const existing = prev.find((item) => item._id === chatId)
      const merged = { ...existing, ...chat, title: chat.title || existing?.title || DEFAULT_CHAT_TITLE }
      return [merged, ...prev.filter((item) => item._id !== chatId)]
    })
    dispatchChatModified({ chat })
  }, [activeChatTitle, chats])

  const beginChatRename = useCallback((chatId: string, title: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setEditingChatId(chatId)
    setEditingChatTitle(title)
  }, [])

  const headerTitleInputRef = useRef<HTMLInputElement>(null)

  const beginHeaderChatRename = useCallback(() => {
    if (!activeChatId) return
    const title =
      activeChatTitle ??
      chats.find((c) => c._id === activeChatId)?.title ??
      DEFAULT_CHAT_TITLE
    setEditingChatId(activeChatId)
    setEditingChatTitle(title)
  }, [activeChatId, activeChatTitle, chats])

  useEffect(() => {
    if (!activeChatId || editingChatId !== activeChatId) return
    const el = headerTitleInputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [activeChatId, editingChatId])

  const cancelChatRename = useCallback(() => {
    setEditingChatId(null)
    setEditingChatTitle('')
  }, [])

  useEffect(() => {
    cancelChatRename()
  }, [activeChatId, cancelChatRename])

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

  /** Hide header rename until `loadChat` has applied messages/meta (`runtime.hydrated`). */
  const activeChatHydrated = Boolean(
    activeChatId && runtimesRef.current.get(activeChatId)?.hydrated,
  )

  // Called on the first message of a new chat. Titles come from the free title model;
  // avoid persisting first-word excerpts, which read as incomplete titles.
  const startFirstMessageRename = useCallback((chatId: string, text: string) => {
    void generateTitle(text).then(async (aiTitle) => {
      if (!aiTitle) return
      const finalTitle = applyChatTitleUpdate(chatId, aiTitle)
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
          lastMode: 'act',
          askModelIds: selectedModels,
          actModelId: selectedActModel,
        }),
      })
    }, 600)
    return () => clearTimeout(t)
  }, [selectedModels, selectedActModel, activeChatId])

  // Auto-load a specific chat when embedded in project view (`id` = conversation)
  const showOwnSidebar = !hideSidebar && settings.useSecondarySidebar
  const idParam = searchParams?.get('id') ?? null
  const automationIdParam = mode === 'automate' ? searchParams?.get('automationId') ?? null : null
  const automationDetailTab = normalizeAutomationDetailTab(searchParams?.get('tab'))
  const automationConversationId =
    selectedAutomation?.sourceConversationId || selectedAutomation?.conversationId || null
  const hasAutomationContext = mode === 'automate' && Boolean(automationIdParam)
  const showAutomationChatTab = !hasAutomationContext || automationDetailTab === 'chat'

  // Automations must always run with exactly one model. Collapse multi-model selection
  // whenever the user is working inside an automation surface so saved automations and
  // automation-chat runs never inherit a stale multi-model state.
  useEffect(() => {
    if (!hasAutomationContext) return
    if (askModelSelectionMode !== 'multiple' && selectedModels.length <= 1) return
    const primary = selectedActModel || selectedModels[0] || DEFAULT_MODEL_ID
    setAskModelSelectionMode('single')
    setSelectedModels([primary])
    setSelectedActModel(primary)
  }, [hasAutomationContext, askModelSelectionMode, selectedModels, selectedActModel])
  /** When chat is opened inside a project, files/docs attach to this project for search scoping. */
  const rawEmbedProjectId = hideSidebar ? searchParams?.get('projectId')?.trim() ?? null : null
  const embedProjectId =
    rawEmbedProjectId &&
    /^[a-z0-9]+$/i.test(rawEmbedProjectId) &&
    rawEmbedProjectId.length >= 16 &&
    rawEmbedProjectId.length <= 64
      ? rawEmbedProjectId
      : null

  useEffect(() => {
    if (hideSidebar) return
    const browserIdParam =
      typeof window === 'undefined'
        ? idParam
        : new URLSearchParams(window.location.search).get('id')
    const effectiveIdParam = idParam ?? browserIdParam
    const shouldResetToEmptySurface =
      (mode === 'chat' && !effectiveIdParam) ||
      (mode === 'automate' && !effectiveIdParam && !automationIdParam)
    if (!shouldResetToEmptySurface) return
    if (!activeChatIdRef.current && !activeChatId) return

    persistActiveRuntimeUiState()
    activeChatIdRef.current = null
    pendingTitleRef.current = null
    setActiveChatId(null)
    setActiveChatTitle(null)
    setInterruptedExchangeIdx(null)
    setSourcesPanel(null)
    setMobileChatListOpen(false)
    setActiveViewer(null)
    // Restore the user's saved new-chat defaults from localStorage rather than the last
    // viewed chat's models (which live in the view state after a chat switch).
    const storedAsk = readStoredAskModelIds()
    const storedAct = readStoredActModelId()
    applyUiStateToView(createConversationUiState({
      selectedActModel: storedAct,
      selectedModels: storedAsk,
      askModelSelectionMode: storedAsk.length > 1 ? 'multiple' : 'single',
      activeChatTitle: null,
      isFirstMessage: true,
    }))
    clearTransientComposerState()
  }, [
    activeChatId,
    applyUiStateToView,
    automationIdParam,
    hideSidebar,
    idParam,
    mode,
    persistActiveRuntimeUiState,
    setActiveViewer,
  ])

  // Skip reloading the same chat we just created/switched to locally; otherwise the
  // route update can race the optimistic first-turn state and snap the UI back to empty.
  useEffect(() => {
    if (!idParam || activeChatIdRef.current === idParam) return
    void loadChat(idParam)
    // `loadChat` is intentionally excluded so this only reacts to route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam])

  useEffect(() => {
    function handleChatRouteSelected(event: Event) {
      const chatId = (event as CustomEvent<{ chatId?: string }>).detail?.chatId
      if (!chatId || activeChatIdRef.current === chatId) return
      void loadChat(chatId, { replaceUrl: false })
    }
    window.addEventListener('overlay:chat-route-selected', handleChatRouteSelected)
    return () => window.removeEventListener('overlay:chat-route-selected', handleChatRouteSelected)
    // `loadChat` is intentionally excluded so this listener does not churn on render-only state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mode !== 'automate' || !automationIdParam) {
      setSelectedAutomation(null)
      setSelectedAutomationLoading(false)
      return
    }

    let cancelled = false
    setSelectedAutomationLoading(true)
    void fetch(`/api/app/automations?automationId=${encodeURIComponent(automationIdParam)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load automation')
        return await res.json() as AutomationDetail
      })
      .then((automation) => {
        if (!cancelled) setSelectedAutomation(automation)
      })
      .catch(() => {
        if (!cancelled) setSelectedAutomation(null)
      })
      .finally(() => {
        if (!cancelled) setSelectedAutomationLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [automationIdParam, mode])

  useEffect(() => {
    if (mode !== 'automate' || !automationConversationId) return
    if (activeChatIdRef.current === automationConversationId) return
    void loadChat(automationConversationId)
    // `loadChat` is intentionally excluded so this only reacts to selected automation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automationConversationId, mode])

  useEffect(() => {
    if (wasStreamingRef.current && !isActiveLoading && chat0.messages.length > 0) {
      snapshotCurrentAskThreadsForModelPicker()
      loadSubscription()
    }
    wasStreamingRef.current = isActiveLoading
    if (isActiveLoading) setIsOptimisticLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveLoading, chat0.messages.length])

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_TTFT_DEBUG !== 'true') return
    if (ttftLoggedRef.current) return
    if (!isActiveLoading) return
    if (ttftSendTimeRef.current === null) return
    const _msgs = actChat.messages
    const _lastMsg = [..._msgs].reverse().find((m) => m.role === 'assistant')
    if (!_lastMsg) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _parts = (_lastMsg as any).parts as Array<{ type: string; text?: string }> | undefined
    const _hasText = _parts?.some((p) => p.type === 'text' && (p.text?.trim().length ?? 0) > 0)
    if (!_hasText) return
    ttftLoggedRef.current = true
    const _ttft = performance.now() - ttftSendTimeRef.current
    const _model = selectedActModel
    console.log(`[TTFT][client] first-token | ${_ttft.toFixed(1)}ms | mode=act | model=${_model}`)
  }, [isActiveLoading, actChat.messages, selectedActModel])

  useLayoutEffect(() => {
    const turnId = pendingScrollTurnIdRef.current
    if (!turnId || !messagesScrollRef.current) return
    const pendingChatId = pendingScrollChatIdRef.current
    if (pendingChatId && activeChatId !== pendingChatId) return
    const scrollFrame = window.requestAnimationFrame(() => {
      const container = messagesScrollRef.current
      if (!container || pendingScrollTurnIdRef.current !== turnId) return
      const target = container.querySelector<HTMLElement>(
        `[data-exchange-turn="${CSS.escape(turnId)}"]`,
      )
      if (!target) return

      const containerRect = container.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const targetTop = targetRect.top - containerRect.top + container.scrollTop
      const desiredTop = Math.max(0, targetTop - 16)
      const maxTop = Math.max(0, container.scrollHeight - container.clientHeight)
      const nextTop = Math.min(desiredTop, maxTop)
      container.scrollTo({
        top: nextTop,
        behavior: 'smooth',
      })
      if (desiredTop <= maxTop + 2 || (!isActiveLoading && !isOptimisticLoading)) {
        pendingScrollTurnIdRef.current = null
        pendingScrollChatIdRef.current = null
      }
    })
    return () => window.cancelAnimationFrame(scrollFrame)
  }, [
    activeChatId,
    chat0.messages,
    actChat.messages,
    exchangeModes.length,
    generationResults.size,
    isActiveLoading,
    isOptimisticLoading,
    runtimeHydrationVersion,
  ])

  useEffect(() => {
    if (shouldScrollRef.current) {
      if (pendingScrollTurnIdRef.current) {
        shouldScrollRef.current = false
        return
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      shouldScrollRef.current = false
    }
  }, [chat0.messages.length, actChat.messages.length])

  useEffect(() => {
    if (!showModelPicker) {
      setHoveredModelId(null)
      setModelQualitiesPos(null)
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

  useLayoutEffect(() => {
    if (!showModelPicker || (!hasAutomationContext && generationMode !== 'text') || !hoveredModelId) {
      setModelQualitiesPos(null)
      return
    }
    syncModelQualitiesPosition(hoveredModelId)
  }, [
    showModelPicker,
    generationMode,
    hasAutomationContext,
    hoveredModelId,
    selectedModels,
    selectedActModel,
    selectedAutomation?.modelId,
    syncModelQualitiesPosition,
  ])

  useEffect(() => {
    const el = modelPickerListScrollRef.current
    if (!el || !showModelPicker || !hoveredModelId) return
    const onScroll = () => syncModelQualitiesPosition(hoveredModelId)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [showModelPicker, hoveredModelId, syncModelQualitiesPosition])

  useEffect(() => {
    if (!showModelPicker || !hoveredModelId) return
    const onResize = () => syncModelQualitiesPosition(hoveredModelId)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [showModelPicker, hoveredModelId, syncModelQualitiesPosition])

  useEffect(() => {
    function openPicker() { setShowModelPicker(true) }
    function closePicker() { setShowModelPicker(false) }
    window.addEventListener('overlay:tour:open-model-picker', openPicker)
    window.addEventListener('overlay:tour:close-model-picker', closePicker)
    return () => {
      window.removeEventListener('overlay:tour:open-model-picker', openPicker)
      window.removeEventListener('overlay:tour:close-model-picker', closePicker)
    }
  }, [])

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
    if (!showModeMenu) return
    function handleOutside(e: MouseEvent) {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node))
        setShowModeMenu(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showModeMenu])

  // Auto-resize is now handled internally by MentionInput

  // ── response lookup ────────────────────────────────────────────────────────

  function getResponseForExchangeForModel(
    modelId: string,
    exchIdx: number,
    /** For Act multi-compare, slot order is the exchange's model list, not the global picker. */
    slotOrder?: string[],
  ): UIMessage | null {
    const order = slotOrder && slotOrder.length > 0 ? slotOrder : selectedModels
    const liveIdx = order.indexOf(modelId)
    const canUseLiveSlot =
      liveIdx >= 0 &&
      (sameModelOrder(order, activeRuntime.ui.selectedModels) ||
        (isActiveLoading && !!slotOrder?.length))
    const msgs =
      canUseLiveSlot
        ? activeAskChats[liveIdx].messages
        : activeRuntime.ui.orphanModelThreads.get(modelId) ?? []
    let uCount = 0
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].role === 'user') {
        if (uCount === exchIdx) {
          const candidates: UIMessage[] = []
          for (let j = i + 1; j < msgs.length; j++) {
            if (msgs[j].role === 'user') break
            if (msgs[j].role === 'assistant') candidates.push(msgs[j]!)
          }
          return chooseAssistantCandidate(candidates)
        }
        uCount++
      }
    }
    return null
  }

  function prepareAskModelThreadsForTextTurn(
    runtime: ConversationRuntime,
    nextModelIds: string[],
  ): { historyBaseModelId?: string } {
    const ui = runtime.ui
    const nextModels = nextModelIds.slice(0, 4)
    if (nextModels.length === 0) return {}

    const orphanThreads = cloneOrphanModelThreadsMap(ui.orphanModelThreads)
    ui.selectedModels.slice(0, 4).forEach((modelId, slotIdx) => {
      const slotMessages = runtime.askChats[slotIdx]?.messages
      if (slotMessages?.length) {
        orphanThreads.set(modelId, cloneUiMessageThread(slotMessages as UIMessage[]))
      }
    })

    const latestTextIdx = latestTextExchangeIndex(ui)
    const previousModels = latestTextIdx >= 0 ? (ui.exchangeModels[latestTextIdx] ?? []) : []
    const modelSetUnchanged = previousModels.length > 0 && sameModelSet(previousModels, nextModels)
    const selectedBaseModelId = selectedModelForExchange(ui, latestTextIdx)
    const baseModelId = modelSetUnchanged ? undefined : selectedBaseModelId ?? previousModels[0] ?? ui.selectedModels[0]
    const baseSlotIdx = baseModelId ? ui.selectedModels.indexOf(baseModelId) : -1
    const activeBaseThread =
      baseSlotIdx >= 0 ? (runtime.askChats[baseSlotIdx]?.messages as UIMessage[] | undefined) : undefined
    const baseThread =
      baseModelId
        ? orphanThreads.get(baseModelId) ?? activeBaseThread
        : undefined

    nextModels.forEach((modelId, slotIdx) => {
      const sourceThread =
        modelSetUnchanged
          ? orphanThreads.get(modelId) ?? []
          : baseThread ?? orphanThreads.get(modelId) ?? []
      runtime.askChats[slotIdx]!.messages = cloneUiMessageThread(sourceThread as UIMessage[])
    })
    for (let slotIdx = nextModels.length; slotIdx < runtime.askChats.length; slotIdx++) {
      runtime.askChats[slotIdx]!.messages = []
    }
    runtime.ui = createConversationUiState({
      ...ui,
      selectedModels: nextModels,
      selectedActModel: nextModels[0] ?? ui.selectedActModel,
      askModelSelectionMode: nextModels.length > 1 ? 'multiple' : 'single',
      orphanModelThreads: orphanThreads,
    })
    return baseModelId ? { historyBaseModelId: baseModelId } : {}
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

  const saveAutomationDraft = useCallback(async (draft: AutomationDraftSummary) => {
    setIsDraftSaving(true)
    try {
      const res = await fetch('/api/app/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          instructions: draft.instructions,
          schedule: draft.schedule,
          timezone: draft.timezone,
          graphSource: draft.graphSource,
          enabled: true,
          ...(activeChatId ? { sourceConversationId: activeChatId } : {}),
          ...(embedProjectId ? { projectId: embedProjectId } : {}),
        }),
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to create automation')
      }
      setDraftModalState(null)
      window.dispatchEvent(new Event('overlay:automations-updated'))
      setComposerNotice('Automation created. It will run on its saved schedule.')
      window.setTimeout(() => setComposerNotice(null), 5000)
    } catch (error) {
      setComposerNotice(error instanceof Error ? error.message : 'Failed to create automation.')
      window.setTimeout(() => setComposerNotice(null), 6000)
    } finally {
      setIsDraftSaving(false)
    }
  }, [activeChatId, embedProjectId])

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

  /**
   * `localStorage` CHAT_MODEL_KEY / ACT_MODEL_KEY represent the user's **default for new chats**,
   * not the last-viewed chat's models. Per-chat selections are held in `runtime.ui` and restored
   * on chat switch. We only write to localStorage when the user is composing on the empty
   * surface (no active chat), so switching between existing chats never mutates the new-chat
   * default and a page reload restores the user's actual preference.
   */
  const isOnNewChatSurface = !activeChatId
  const persistNewChatAskModels = useCallback((ids: string[]) => {
    if (!isOnNewChatSurface) return
    try { localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
  }, [isOnNewChatSurface])
  const persistNewChatActModel = useCallback((id: string) => {
    if (!isOnNewChatSurface) return
    try { localStorage.setItem(ACT_MODEL_KEY, id) } catch { /* ignore */ }
  }, [isOnNewChatSurface])

  const snapshotCurrentAskThreadsForModelPicker = useCallback(() => {
    if (!activeChatIdRef.current) return
    const latestTextIdx = (() => {
      for (let i = exchangeModels.length - 1; i >= 0; i--) {
        if ((exchangeGenTypes[i] ?? 'text') === 'text') return i
      }
      return -1
    })()
    const threadModelOrder =
      latestTextIdx >= 0 && exchangeModels[latestTextIdx]?.length
        ? exchangeModels[latestTextIdx]!
        : selectedModels
    const nextOrphans = cloneOrphanModelThreadsMap(activeRuntime.ui.orphanModelThreads)
    threadModelOrder.slice(0, 4).forEach((modelId, slotIdx) => {
      const messages = activeRuntime.askChats[slotIdx]?.messages as UIMessage[] | undefined
      if (messages?.length) {
        nextOrphans.set(modelId, cloneUiMessageThread(messages))
      }
    })
    activeRuntime.ui = createConversationUiState({
      ...activeRuntime.ui,
      orphanModelThreads: nextOrphans,
    })
  }, [activeRuntime, exchangeGenTypes, exchangeModels, selectedModels])

  const handleTextModelSelectionModeChange = useCallback(
    (next: AskModelSelectionMode) => {
      if (generationMode !== 'text') return
      if (next === askModelSelectionMode) return
      if (isFreeTier && next === 'multiple') return
      if (hasAutomationContext && next === 'multiple') return
      snapshotCurrentAskThreadsForModelPicker()
      setAskModelSelectionMode(next)
      if (next === 'single' && selectedModels.length > 1) {
        const one = [selectedModels[0]!]
        setSelectedModels(one)
        setSelectedActModel(one[0]!)
        persistNewChatAskModels(one)
        persistNewChatActModel(one[0]!)
      } else if (next === 'multiple' && selectedModels.length > 0) {
        setSelectedActModel(selectedModels[0]!)
        persistNewChatActModel(selectedModels[0]!)
      }
    },
    [
      generationMode,
      askModelSelectionMode,
      isFreeTier,
      hasAutomationContext,
      selectedModels,
      snapshotCurrentAskThreadsForModelPicker,
      persistNewChatAskModels,
      persistNewChatActModel,
    ],
  )

  function toggleTextModelInPicker(modelId: string) {
    snapshotCurrentAskThreadsForModelPicker()
    if (askModelSelectionMode === 'single') {
      if (selectedActModel === modelId && selectedModels.length === 1) return
      const next = [modelId]
      setSelectedActModel(modelId)
      setSelectedModels(next)
      persistNewChatActModel(modelId)
      persistNewChatAskModels(next)
      setShowModelPicker(false)
      return
    }
    const isSel = selectedModels.includes(modelId)
    if (isSel) {
      if (selectedModels.length === 1) return
      const next = selectedModels.filter((x) => x !== modelId)
      setSelectedModels(next)
      if (!next.includes(selectedActModel)) {
        setSelectedActModel(next[0]!)
        persistNewChatActModel(next[0]!)
      }
      persistNewChatAskModels(next)
    } else {
      if (selectedModels.length >= 4) return
      const next = [...selectedModels, modelId]
      setSelectedModels(next)
      if (next.length === 1) {
        setSelectedActModel(modelId)
        persistNewChatActModel(modelId)
      }
      persistNewChatAskModels(next)
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

  function removeTurnFromRuntime(chatId: string, turnId: string) {
    const runtime = ensureConversationRuntime(chatId)
    const removeTurn = (messages: UIMessage[]) => messages.filter((message) => (
      ((message as { turnId?: string }).turnId || message.id) !== turnId
    ))

    const previousUserTurnIds = (runtime.askChats[0]?.messages ?? [])
      .filter((message) => message.role === 'user')
      .map((message) => ((message as { turnId?: string }).turnId || message.id))
    const removedExchangeIndex = previousUserTurnIds.indexOf(turnId)

    runtime.askChats.forEach((chat, index) => {
      chat.messages = removeTurn(chat.messages as UIMessage[]) as never
      if (activeChatIdRef.current === chatId && chatInstances[index]) {
        chatInstances[index].setMessages([...chat.messages] as UIMessage[])
      }
    })
    runtime.actChat.messages = removeTurn(runtime.actChat.messages as UIMessage[]) as never
    if (activeChatIdRef.current === chatId) {
      actChat.setMessages([...runtime.actChat.messages] as UIMessage[])
    }

    if (removedExchangeIndex >= 0) {
      runtime.ui = createConversationUiState({
        ...runtime.ui,
        exchangeModes: runtime.ui.exchangeModes.filter((_, index) => index !== removedExchangeIndex),
        exchangeModels: runtime.ui.exchangeModels.filter((_, index) => index !== removedExchangeIndex),
        selectedTabPerExchange: runtime.ui.selectedTabPerExchange.filter((_, index) => index !== removedExchangeIndex),
        exchangeGenTypes: runtime.ui.exchangeGenTypes.filter((_, index) => index !== removedExchangeIndex),
        generationResults: new Map(
          [...runtime.ui.generationResults.entries()]
            .filter(([index]) => index !== removedExchangeIndex)
            .map(([index, value]) => [index > removedExchangeIndex ? index - 1 : index, value]),
        ),
        isFirstMessage: !runtime.askChats[0]?.messages.some((message) => message.role === 'user'),
      })
      if (activeChatIdRef.current === chatId) applyUiStateToView(runtime.ui)
    }
    setRuntimeHydrationVersion((value) => value + 1)
  }

  function syncStandaloneChatUrl(chatId: string | null, options: { replaceUrl?: boolean } = {}) {
    if (hideSidebar || options.replaceUrl === false) return
    const replaceUrl = (href: string) => {
      window.history.replaceState(null, '', href)
    }
    if (mode === 'automate') {
      const params = new URLSearchParams()
      if (chatId) params.set('id', chatId)
      const automationId = searchParams?.get('automationId')
      if (automationId) params.set('automationId', automationId)
      const tab = normalizeAutomationDetailTab(searchParams?.get('tab'))
      if (tab !== 'chat') params.set('tab', tab)
      const query = params.toString()
      replaceUrl(`/app/automations${query ? `?${query}` : ''}`)
      return
    }
    const basePath = '/app/chat'
    replaceUrl(chatId ? `${basePath}?id=${encodeURIComponent(chatId)}` : basePath)
  }

  async function createNewChat(options: {
    title?: string
    prepareRuntime?: (args: {
      chatId: string
      runtime: ConversationRuntime
      selectedModels: string[]
      selectedActModel: string
      askModelSelectionMode: AskModelSelectionMode
    }) => void
  } = {}): Promise<string | null> {
    // Invalidate any in-flight loadChat request before this newly-created runtime
    // becomes active; otherwise an older load can repaint the view after send.
    ++loadChatRequestRef.current
    persistActiveRuntimeUiState()
    const initialTitle = options.title ?? (mode === 'automate' ? 'New automation' : DEFAULT_CHAT_TITLE)
    const initialSelectedModels = askModelSelectionMode === 'single' ? [selectedActModel] : selectedModels.slice(0, 4)
    const initialAskModelSelectionMode: AskModelSelectionMode = initialSelectedModels.length > 1 ? 'multiple' : 'single'
    const res = await fetch('/api/app/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: initialTitle,
        askModelIds: initialSelectedModels,
        actModelId: selectedActModel,
        lastMode: 'act',
        ...(embedProjectId ? { projectId: embedProjectId } : {}),
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setInterruptedExchangeIdx(null)
      const newChat: Conversation = {
        _id: data.id,
        title: initialTitle,
        lastModified: Date.now(),
        lastMode: 'act',
        askModelIds: initialSelectedModels,
        actModelId: selectedActModel,
      }
      upsertCachedChat(newChat)
      setChats((prev) => [newChat, ...prev])
      dispatchChatCreated({ chat: newChat })
      posthog.capture('chat_new_chat_created', { mode: 'act' })
      const runtime = ensureConversationRuntime(data.id, {
        selectedActModel,
        selectedModels: initialSelectedModels,
        askModelSelectionMode: initialAskModelSelectionMode,
        activeChatTitle: initialTitle,
        isFirstMessage: true,
      })
      resetRuntimeState(runtime, {
        selectedActModel,
        selectedModels: initialSelectedModels,
        askModelSelectionMode: initialAskModelSelectionMode,
        activeChatTitle: initialTitle,
        isFirstMessage: true,
      })
      options.prepareRuntime?.({
        chatId: data.id,
        runtime,
        selectedModels: initialSelectedModels,
        selectedActModel,
        askModelSelectionMode: initialAskModelSelectionMode,
      })
      runtime.hydrated = true
      if (pendingScrollTurnIdRef.current && !pendingScrollChatIdRef.current) {
        pendingScrollChatIdRef.current = data.id
      }
      activeChatIdRef.current = data.id
      setActiveViewer(data.id)
      setActiveChatId(data.id)
      syncStandaloneChatUrl(data.id)
      applyUiStateToView(runtime.ui)
      setRuntimeHydrationVersion((value) => value + 1)
      resetRuntimeState(emptyRuntimeRef.current)
      clearTransientComposerState()
      return data.id
    }
    return null
  }

  async function handleBranchConversationAtTurn(turnId: string | null) {
    const sourceChatId = activeChatIdRef.current ?? activeChatId
    const targetTurnId = turnId?.trim()
    if (!sourceChatId || !targetTurnId || isActiveLoading) return
    try {
      setComposerNotice('Creating branch…')
      setIsSwitchingChat(true)
      const sourceRes = await fetch(`/api/app/conversations?conversationId=${sourceChatId}&messages=true`)
      if (!sourceRes.ok) throw new Error('Could not load source chat')
      const sourceData = await sourceRes.json() as {
        messages?: Array<{
          turnId?: string
          mode?: 'ask' | 'act'
          role?: 'user' | 'assistant'
          contentType?: 'text' | 'image' | 'video'
          parts?: Array<{ type: string; text?: string; url?: string; mediaType?: string; fileName?: string }>
          model?: string
          variantIndex?: number
          replyToTurnId?: string
          replySnippet?: string
        }>
      }
      const rows: NonNullable<typeof sourceData.messages> = []
      for (const message of sourceData.messages ?? []) {
        rows.push(message)
        if (message.turnId === targetTurnId && message.role === 'assistant') {
          continue
        }
      }
      const targetIdx = rows.findLastIndex((message) => message.turnId === targetTurnId)
      if (targetIdx < 0) throw new Error('Could not find that turn')
      const branchRows = rows.slice(0, targetIdx + 1)
      const branchChatId = await createNewChat({ title: `${activeChatTitle || DEFAULT_CHAT_TITLE} branch` })
      if (!branchChatId) throw new Error('Could not create branch')
      for (const message of branchRows) {
        const content = (message.parts ?? [])
          .filter((part) => part.type === 'text' && part.text?.trim())
          .map((part) => part.text!.trim())
          .join('\n\n') || (message.role === 'assistant' ? '[Response]' : '[Message]')
        const parts = (message.parts ?? []).filter((part) => part.type === 'text' || part.type === 'file')
        const res = await fetch('/api/app/conversations/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: branchChatId,
            turnId: message.turnId,
            mode: message.mode ?? 'act',
            role: message.role,
            content,
            parts,
            modelId: message.model,
            contentType: message.contentType ?? 'text',
            variantIndex: message.variantIndex,
            ...(message.replyToTurnId ? { replyToTurnId: message.replyToTurnId, replySnippet: message.replySnippet } : {}),
          }),
        })
        if (!res.ok) throw new Error('Could not copy branch messages')
      }
      const branchRuntime = runtimesRef.current.get(branchChatId)
      if (branchRuntime) branchRuntime.hydrated = false
      await loadChat(branchChatId)
      setComposerNotice('Branch created.')
      window.setTimeout(() => setComposerNotice(null), 2500)
    } catch (error) {
      setComposerNotice(error instanceof Error ? error.message : 'Could not create branch')
      window.setTimeout(() => setComposerNotice(null), 5000)
      setIsSwitchingChat(false)
    }
  }

  async function loadChat(chatId: string, options: { replaceUrl?: boolean } = {}) {
    const requestId = ++loadChatRequestRef.current
    persistActiveRuntimeUiState()
    clearTransientComposerState()
    setInterruptedExchangeIdx(null)
    setSourcesPanel(null)
    markRead(chatId)
    activeChatIdRef.current = chatId
    setActiveViewer(chatId)
    setActiveChatId(chatId)
    syncStandaloneChatUrl(chatId, options)
    const runtime = ensureConversationRuntime(chatId)
    const existingChat = chats.find((chat) => chat._id === chatId)
    setActiveChatTitle(existingChat?.title ?? runtime.ui.activeChatTitle ?? null)
    pendingTitleRef.current = null

    // Fast path: runtime already loaded — switch instantly with no spinner or API calls.
    const runtimeHasLoadedHistory =
      runtime.actChat.messages.some((message) => message.role === 'user') ||
      runtime.askChats.some((chat) => chat.messages.some((message) => message.role === 'user')) ||
      runtime.ui.generationResults.size > 0
    if (runtime.hydrated && runtimeHasLoadedHistory) {
      shouldScrollRef.current = true
      applyUiStateToView(runtime.ui)
      setRuntimeHydrationVersion((value) => value + 1)
      return
    }

    setIsSwitchingChat(true)
    runtime.hydrated = false
    try {
      const shouldLoadMeta = !existingChat?.title || !existingChat?.askModelIds?.length || !existingChat?.actModelId
      const messagesParams = new URLSearchParams({
        conversationId: chatId,
        messages: 'true',
      })
      const [messagesRes, outputsRes, metaRes] = await Promise.all([
        fetch(`/api/app/conversations?${messagesParams.toString()}`),
        fetch(`/api/app/files?kind=output&conversationId=${chatId}`),
        shouldLoadMeta ? fetch(`/api/app/conversations?conversationId=${chatId}`) : Promise.resolve(null),
      ])
      if (requestId !== loadChatRequestRef.current) return
      if (metaRes?.status === 404) {
        removeCachedChat(chatId)
        setChats((prev) => prev.filter((chat) => chat._id !== chatId))
        runtimesRef.current.delete(chatId)
        if (activeChatIdRef.current === chatId) {
          activeChatIdRef.current = null
          setActiveChatId(null)
          setActiveChatTitle(null)
          setActiveViewer(null)
          syncStandaloneChatUrl(null, options)
        }
        setComposerNotice('That chat no longer exists.')
        window.setTimeout(() => setComposerNotice(null), 4000)
        return
      }
      if (!messagesRes.ok) {
        if (messagesRes.status === 404) {
          removeCachedChat(chatId)
          setChats((prev) => prev.filter((chat) => chat._id !== chatId))
          runtimesRef.current.delete(chatId)
          if (activeChatIdRef.current === chatId) {
            activeChatIdRef.current = null
            setActiveChatId(null)
            setActiveChatTitle(null)
            setActiveViewer(null)
            syncStandaloneChatUrl(null, options)
          }
          setComposerNotice('That chat no longer exists.')
          window.setTimeout(() => setComposerNotice(null), 4000)
          return
        }
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
        status?: 'generating' | 'completed' | 'error'
        variantIndex?: number
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

      const outputRows = outputsRes.ok ? await outputsRes.json() : []
      const outputs: ChatOutput[] = Array.isArray(outputRows)
        ? outputRows.map((file: {
            _id: string
            outputType?: string
            prompt?: string
            modelId?: string
            downloadUrl?: string
            createdAt?: number
            updatedAt?: number
            turnId?: string
          }) => ({
            _id: file._id,
            type: (file.outputType || 'document') as ChatOutput['type'],
            status: 'completed',
            prompt: file.prompt || 'Generated output',
            modelId: file.modelId || '',
            url: file.downloadUrl,
            createdAt: file.createdAt ?? file.updatedAt ?? 0,
            turnId: file.turnId,
          }))
        : []
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
      let resolvedSelectedModels = existingChat?.askModelIds?.slice(0, 4) ?? selectedModels
      let resolvedActModel = existingChat?.actModelId ?? selectedActModel
      if (metaRes?.ok) {
        const meta = await metaRes.json() as {
          title?: string
          lastMode?: 'ask' | 'act'
          askModelIds?: string[]
          actModelId?: string
        }
        if (requestId !== loadChatRequestRef.current) return
        if (meta.title) resolvedTitle = meta.title
        if (meta.askModelIds?.length) {
          resolvedSelectedModels = meta.askModelIds.slice(0, 4)
        }
        if (meta.actModelId) {
          resolvedActModel = meta.actModelId
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
          if (hasAutomationContext && responses.length === 0) {
            responses.push({
              model: DEFAULT_MODEL_ID,
              msg: {
                id: `missing-automation-response-${tid}`,
                turnId: tid,
                role: 'assistant',
                mode,
                parts: [{
                  type: 'text',
                  text: 'No saved model response was found for this automation run. You can retry this turn to regenerate it.',
                }],
                status: 'error',
              } as RawMsg,
            })
          }
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
      const restoredModelThreads = new Map<string, UIMessage[]>()

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
        resolvedSelectedModels = slotModels

        uniqueModels.forEach((modelId) => {
          const msgs: RawMsg[] = []
          for (const ex of exchanges) {
            msgs.push(ex.userMsg)
            const r = ex.responses.find((x) => x.model === modelId)
            if (r) msgs.push(r.msg)
          }
          restoredModelThreads.set(modelId, cloneUiMessageThread(msgs as unknown as UIMessage[]))
        })

        slotModels.forEach((modelId, slotIdx) => {
          const msgs = restoredModelThreads.get(modelId) ?? []
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
        selectedActModel: resolvedActModel,
        selectedModels: resolvedSelectedModels,
        askModelSelectionMode: resolvedSelectedModels.length > 1 ? 'multiple' : 'single',
        exchangeModes: exchangeModesFromServer,
        exchangeModels: restoredExchangeModels,
        selectedTabPerExchange: exchanges.map(() => 0),
        activeChatTitle: resolvedTitle,
        generationResults: restoredResults,
        exchangeGenTypes: restoredGenTypes,
        isFirstMessage: !hasUserMessages,
        orphanModelThreads: restoredModelThreads,
      })
      if (requestId !== loadChatRequestRef.current) return
      runtime.hydrated = true
      if (rawMessages.some((msg) => msg.role === 'assistant' && msg.status === 'generating')) {
        startSession(chatId, 'act', resolvedTitle ?? DEFAULT_CHAT_TITLE, Math.max(0, rawMessages.length - 1))
      }
      shouldScrollRef.current = true
      applyUiStateToView(runtime.ui)
      setRuntimeHydrationVersion((value) => value + 1)
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
      removeTurnFromRuntime(cid, turnId)
    } catch {
      setComposerNotice('Could not delete this turn.')
      window.setTimeout(() => setComposerNotice(null), 5000)
    } finally {
      setExitingTurnIds((prev) => prev.filter((id) => id !== turnId))
    }
  }

  const handleRetryExchange = useCallback(
    async (
      userMsg: UIMessage,
      exchIdx: number,
      isActExch: boolean,
      exchModelList: string[],
    ) => {
      const chatId = activeChatIdRef.current ?? activeChatId
      if (!chatId || isActiveLoading) return
      const turnId = getUserTurnId(userMsg)
      if (!turnId) return
      if (!isActExch) return

      posthog.capture('chat_response_retry_clicked', {
        exchange_index: exchIdx,
        mode: 'act',
      })

      const runtime = ensureConversationRuntime(chatId)
      shouldScrollRef.current = true

      runtime.askChats.forEach((c) => c.stop())
      runtime.actChat.stop()

      const meta = userMsg.metadata as ChatMessageMetadata | undefined
      const indexedFileNames = meta?.indexedDocuments ?? []
      const indexedAttachments = meta?.indexedAttachments ?? []
      const partsForModel =
        userMsg.parts?.filter((p) => p.type === 'text' || p.type === 'file') ?? []
      const replyExtra =
        meta?.replyToTurnId && meta?.replySnippet
          ? String(meta.replySnippet).slice(0, 16000)
          : undefined

      const multiRetry = exchModelList.length > 1
      const retrySlots = Math.min(4, exchModelList.length)
      if (multiRetry) {
        for (let s = 0; s < retrySlots; s++) {
          runtime.askChats[s].messages = stripAssistantAfterUserTurn(
            runtime.askChats[s].messages,
            turnId,
          )
        }
        runtime.actChat.messages = stripAssistantAfterUserTurn(runtime.actChat.messages, turnId)
      } else {
        runtime.actChat.messages = stripAssistantAfterUserTurn(runtime.actChat.messages, turnId)
        runtime.askChats[0].messages = stripAssistantAfterUserTurn(runtime.askChats[0].messages, turnId)
      }
      const modelId = exchModelList[0] ?? selectedActModel
      const msgCountBeforeSend = runtime.askChats[0].messages.length
      startSession(chatId, 'act', activeChatTitle ?? '', msgCountBeforeSend)

      const baseBody = {
        conversationId: chatId,
        turnId,
        mode,
        automationMode: mode === 'automate',
        ...(indexedFileNames.length > 0 ? { indexedFileNames, indexedAttachments } : {}),
        ...(replyExtra ? { replyContextForModel: replyExtra } : {}),
      }

      /* eslint-disable @typescript-eslint/no-explicit-any */
      if (multiRetry) {
        const sends = exchModelList.slice(0, retrySlots).map((mid, slotIdx) =>
          runtime.askChats[slotIdx]!.sendMessage(
            {
              role: 'user',
              parts: partsForModel as any,
              messageId: turnId,
              ...(meta && Object.keys(meta).length > 0 ? { metadata: meta } : {}),
            } as any,
            {
              body: {
                ...baseBody,
                modelId: mid,
                multiModelSlotIndex: slotIdx,
                multiModelTotal: retrySlots,
              },
            },
          ),
        )
        void Promise.all(sends)
          .then(() => {
            runtime.actChat.messages = [...runtime.askChats[0]!.messages]
            completeSession(chatId, activeChatIdRef.current === chatId)
            loadChats()
            loadSubscription()
          })
          .catch((err) => {
            console.error('[ChatInterface] Act multi retry sendMessage failed', err)
            completeSession(chatId, activeChatIdRef.current === chatId)
            if (activeChatIdRef.current === chatId) {
              setComposerNotice(
                err instanceof Error ? err.message : 'Could not retry. Try again.',
              )
              window.setTimeout(() => setComposerNotice(null), 8000)
            }
          })
      } else {
        void runtime.actChat
          .sendMessage(
            {
              role: 'user',
              parts: partsForModel as any,
              messageId: turnId,
              ...(meta && Object.keys(meta).length > 0 ? { metadata: meta } : {}),
            } as any,
            {
              body: {
                ...baseBody,
                modelId,
              },
            },
          )
          .then(() => {
            completeSession(chatId, activeChatIdRef.current === chatId)
            loadChats()
            loadSubscription()
          })
          .catch((err) => {
            console.error('[ChatInterface] Act retry sendMessage failed', err)
            completeSession(chatId, activeChatIdRef.current === chatId)
            if (activeChatIdRef.current === chatId) {
              setComposerNotice(
                err instanceof Error ? err.message : 'Could not retry. Try again.',
              )
              window.setTimeout(() => setComposerNotice(null), 8000)
            }
          })
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    },
    [
      activeChatId,
      activeChatTitle,
      ensureConversationRuntime,
      completeSession,
      loadChats,
      loadSubscription,
      selectedActModel,
      startSession,
      isActiveLoading,
      mode,
    ],
  )

  function requestDeleteChat(chat: { _id: string; title: string }, e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmDeleteChat({ id: chat._id, title: chat.title })
  }

  async function performDeleteChat() {
    const target = confirmDeleteChat
    if (!target) return
    setConfirmDeleteChat(null)
    dispatchChatDeleted({ chatId: target.id })
    await fetch(`/api/app/conversations?conversationId=${target.id}`, { method: 'DELETE' })
    await loadChats()
  }

  function removePendingDocument(clientId: string) {
    setPendingChatDocuments((prev) => prev.filter((d) => d.clientId !== clientId))
  }

  function queueDocumentUpload(file: File) {
    const clientId = crypto.randomUUID()
    setAttachmentError(null)
    setPendingChatDocuments((prev) => [
      ...prev,
      { clientId, name: file.name, fileIds: [], status: 'uploading' },
    ])
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
        const data = (await res.json().catch(() => ({}))) as {
          ids?: string[]
          name?: string
        }
        const fileIds = Array.isArray(data.ids) ? data.ids.map((id) => String(id)) : []
        const resolvedName =
          typeof data.name === 'string' && data.name.trim().length > 0 ? data.name.trim() : file.name
        setPendingChatDocuments((prev) =>
          prev.map((d) =>
            d.clientId === clientId
              ? { ...d, status: 'ready' as const, fileIds, name: resolvedName }
              : d,
          ),
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
    const pastedText = e.clipboardData.getData('text/plain')
    if (pastedText && shouldAttachPastedTextAsFile(pastedText)) {
      e.preventDefault()
      const blob = new Blob([pastedText], { type: 'text/plain;charset=utf-8' })
      if (blob.size > LARGE_PASTE_MAX_BYTES) {
        setAttachmentError('Pasted text is too large to attach here. Upload it as a smaller text file.')
        return
      }
      const fileName = pastedTextFileName(pastedText)
      const file = new File([blob], fileName, { type: 'text/plain' })
      queueDocumentUpload(file)
      setComposerNotice(`Large paste attached as ${fileName}.`)
      window.setTimeout(() => setComposerNotice(null), 5000)
      return
    }

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

  const { requireAuth } = useGuestGate()

  async function handleSend() {
    if (!userId && !authUser) {
      try { sessionStorage.setItem('overlay:guest-draft', inputRef.current) } catch { /* ignore */ }
      requireAuth('send')
      return
    }
    const replyCtxSnapshot = replyContext
    const text = inputRef.current.trim()
    const hasReadyDocs = pendingChatDocuments.some((d) => d.status === 'ready')
    const selectedActModelSnapshot = selectedActModel
    const textModelsForTurn =
      askModelSelectionMode === 'multiple' ? selectedModels.slice(0, 4) : [selectedActModel]
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

    posthog.capture('chat_message_sent', {
      mode: 'act',
      generation_type: effectiveGenType,
      has_attachments: attachedImages.length > 0 || pendingChatDocuments.length > 0,
      is_first_message: isFirstMessage,
    })

    if (process.env.NEXT_PUBLIC_TTFT_DEBUG === 'true') {
      ttftSendTimeRef.current = performance.now()
      ttftLoggedRef.current = false
    }
    setIsOptimisticLoading(true)

    // ── Image / Video generation path ──────────────────────────────────────
    if (effectiveGenType === 'image' || effectiveGenType === 'video') {
      if (!text && attachedImages.length === 0) return
      if (isSendBlocked) return

      const wasFirst = isFirstMessage
      const promptForModel =
        replyCtxSnapshot?.bodyForModel && text
          ? `${text}\n\n---\n[User is replying in thread to prior content]\n${replyCtxSnapshot.bodyForModel}`
          : text
      const mediaSessionMode = 'act'
      const mediaTurnId = crypto.randomUUID()
      const activeModels = effectiveGenType === 'image' ? selectedImageModelsSnapshot : selectedVideoModelsSnapshot
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
      const mediaSlotCount = Math.max(1, activeModels.length)
      let exchIdx = 0
      let preparedFirstSendRuntime = false

      const prepareMediaRuntime = (runtime: ConversationRuntime) => {
        const ui = runtime.ui
        exchIdx = ui.exchangeModels.length
        const nextGenerationResults = cloneGenerationResultsMap(ui.generationResults)
        nextGenerationResults.set(
          exchIdx,
          activeModels.map(() => ({ type: effectiveGenType as 'image' | 'video', status: 'generating' as const })),
        )
        runtime.ui = createConversationUiState({
          ...ui,
          exchangeModes: [...ui.exchangeModes, 'act'],
          exchangeModels: [...ui.exchangeModels, [...activeModels]],
          selectedTabPerExchange: [...ui.selectedTabPerExchange, 0],
          exchangeGenTypes: [...ui.exchangeGenTypes, effectiveGenType],
          generationResults: nextGenerationResults,
          isFirstMessage: false,
        })
        runtime.askChats.slice(0, mediaSlotCount).forEach((chat) => {
          chat.messages = [
            ...chat.messages,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mediaUserMessage as any,
          ]
        })
      }

      const existingChatId = activeChatIdRef.current ?? activeChatId
      pendingScrollTurnIdRef.current = mediaTurnId
      pendingScrollChatIdRef.current = existingChatId
      if (!existingChatId) {
        const previewRuntime = emptyRuntimeRef.current
        resetRuntimeState(previewRuntime, {
          selectedActModel,
          selectedModels: activeModels,
          askModelSelectionMode: activeModels.length > 1 ? 'multiple' : 'single',
          activeChatTitle: activeChatTitleSnapshot ?? null,
          isFirstMessage: false,
        })
        prepareMediaRuntime(previewRuntime)
        previewRuntime.hydrated = true
        applyUiStateToView(previewRuntime.ui)
        setIsFirstMessage(false)
        setRuntimeHydrationVersion((value) => value + 1)
      }
      const chatId = existingChatId || await createNewChat({
        prepareRuntime: ({ runtime }) => {
          prepareMediaRuntime(runtime)
          preparedFirstSendRuntime = true
        },
      })
      if (!chatId) return
      markChatModified(chatId, activeChatTitleSnapshot)
      const targetRuntime = ensureConversationRuntime(chatId)

      if (!preparedFirstSendRuntime) {
        updateRuntimeUiState(chatId, (prev) => {
          exchIdx = prev.exchangeModels.length
          const nextGenerationResults = cloneGenerationResultsMap(prev.generationResults)
          nextGenerationResults.set(
            exchIdx,
            activeModels.map(() => ({ type: effectiveGenType as 'image' | 'video', status: 'generating' as const })),
          )
          return {
            ...prev,
            exchangeModes: [...prev.exchangeModes, 'act'],
            exchangeModels: [...prev.exchangeModels, [...activeModels]],
            selectedTabPerExchange: [...prev.selectedTabPerExchange, 0],
            exchangeGenTypes: [...prev.exchangeGenTypes, effectiveGenType],
            generationResults: nextGenerationResults,
            isFirstMessage: false,
          }
        })
        targetRuntime.askChats.slice(0, mediaSlotCount).forEach((chat) => {
          chat.messages = [
            ...chat.messages,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mediaUserMessage as any,
          ]
        })
      }

      setInput('')
      setAttachedImages([])
      setGenerationChip(null)
      setReplyContext(null)
      setIsFirstMessage(false)
      void fetch('/api/app/conversations/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: chatId,
          turnId: mediaTurnId,
          mode: 'act',
          role: 'user',
          content: text,
          parts: [{ type: 'text', text }],
          modelId: activeModels[0],
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
          targetRuntime.askChats.slice(0, mediaSlotCount).forEach((chat) => {
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
              mode: 'act',
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
          targetRuntime.askChats.slice(0, mediaSlotCount).forEach((chat) => {
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
              mode: 'act',
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

    const readyDocs = pendingChatDocuments.filter((d) => d.status === 'ready')
    const indexedAttachments = readyDocs.map((d) => ({ name: d.name, fileIds: d.fileIds }))
    const indexedFileNames = readyDocs.map((d) => d.name)

    // Capture before any await — isFirstMessage is true for the first message of a new/fresh chat
    const wasFirst = isFirstMessage
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
    if (indexedFileNames.length > 0) {
      userMeta.indexedDocuments = indexedFileNames
      userMeta.indexedAttachments = indexedAttachments
    }
    if (replyCtxSnapshot?.replyToTurnId) {
      userMeta.replyToTurnId = replyCtxSnapshot.replyToTurnId
      userMeta.replySnippet = replyCtxSnapshot.snippet
    }
    if (mentions.length > 0) {
      userMeta.mentions = mentions.map((m) => ({
        type: m.type,
        id: m.id,
        name: m.name,
        ...(m.meta?.fileIds ? { fileIds: m.meta.fileIds as string[] } : {}),
      }))
    }
    const userMetadata = Object.keys(userMeta).length > 0 ? userMeta : undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userUIMessage: any = {
      id: textTurnId,
      role: 'user',
      parts: partsForModel,
      ...(userMetadata ? { metadata: userMetadata } : {}),
    }

    const multiText = textModelsForTurn.length > 1
    const textSlotCount = Math.min(4, textModelsForTurn.length)
    let msgCountBeforeSend = 0
    let preparedFirstSendRuntime = false
    let textHistoryBaseModelId: string | undefined

    const prepareTextRuntime = (runtime: ConversationRuntime) => {
      textHistoryBaseModelId = prepareAskModelThreadsForTextTurn(runtime, textModelsForTurn).historyBaseModelId
      msgCountBeforeSend = runtime.askChats[0].messages.length
      const ui = runtime.ui
      runtime.ui = createConversationUiState({
        ...ui,
        exchangeModes: [...ui.exchangeModes, 'act'],
        exchangeModels: [...ui.exchangeModels, [...textModelsForTurn]],
        selectedTabPerExchange: [...ui.selectedTabPerExchange, 0],
        exchangeGenTypes: [...ui.exchangeGenTypes, 'text'],
        isFirstMessage: false,
      })
      for (let s = 0; s < textSlotCount; s++) {
        runtime.askChats[s]!.messages = [
          ...runtime.askChats[s]!.messages,
          userUIMessage as UIMessage,
        ]
      }
      if (!multiText) {
        runtime.actChat.messages = [
          ...runtime.actChat.messages,
          userUIMessage as UIMessage,
        ]
      }
    }

    const existingChatId = activeChatIdRef.current ?? activeChatId
    pendingScrollTurnIdRef.current = textTurnId
    pendingScrollChatIdRef.current = existingChatId
    if (!existingChatId) {
      const previewRuntime = emptyRuntimeRef.current
      resetRuntimeState(previewRuntime, {
        selectedActModel: selectedActModelSnapshot,
        selectedModels: textModelsForTurn,
        askModelSelectionMode: textModelsForTurn.length > 1 ? 'multiple' : 'single',
        activeChatTitle: activeChatTitleSnapshot ?? null,
        isFirstMessage: false,
      })
      prepareTextRuntime(previewRuntime)
      previewRuntime.hydrated = true
      applyUiStateToView(previewRuntime.ui)
      setIsFirstMessage(false)
      setRuntimeHydrationVersion((value) => value + 1)
    }
    const chatId = existingChatId || await createNewChat({
      prepareRuntime: ({ runtime }) => {
        prepareTextRuntime(runtime)
        preparedFirstSendRuntime = true
      },
    })
    if (!chatId) return
    markChatModified(chatId, activeChatTitleSnapshot)
    const targetRuntime = ensureConversationRuntime(chatId)

    if (wasFirst && (text || indexedFileNames.length > 0)) {
      startFirstMessageRename(chatId, text || indexedFileNames[0] || 'Documents')
    }

    activeChatIdRef.current = chatId

    if (!preparedFirstSendRuntime) {
      textHistoryBaseModelId = prepareAskModelThreadsForTextTurn(targetRuntime, textModelsForTurn).historyBaseModelId
      msgCountBeforeSend = targetRuntime.askChats[0].messages.length
      updateRuntimeUiState(chatId, (prev) => ({
        ...prev,
        exchangeModes: [...prev.exchangeModes, 'act'],
        exchangeModels: [...prev.exchangeModels, [...textModelsForTurn]],
        selectedTabPerExchange: [...prev.selectedTabPerExchange, 0],
        exchangeGenTypes: [...prev.exchangeGenTypes, 'text'],
        isFirstMessage: false,
      }))

      for (let s = 0; s < textSlotCount; s++) {
        targetRuntime.askChats[s]!.messages = [
          ...targetRuntime.askChats[s]!.messages,
          userUIMessage as UIMessage,
        ]
      }
      if (!multiText) {
        targetRuntime.actChat.messages = [
          ...targetRuntime.actChat.messages,
          userUIMessage as UIMessage,
        ]
      }
    }

    startSession(chatId, 'act', activeChatTitleSnapshot ?? '', msgCountBeforeSend)

    setInput('')
    setMentions([])
    setAttachedImages([])
    setPendingChatDocuments([])
    setAttachmentError(null)
    setReplyContext(null)
    setIsFirstMessage(false)

    const commonActBody = {
      conversationId: chatId,
      turnId: textTurnId,
      mode,
      automationMode: mode === 'automate',
      ...(indexedFileNames.length > 0
        ? { indexedFileNames, indexedAttachments: indexedAttachments }
        : {}),
      ...(replyCtxSnapshot?.bodyForModel ? { replyContextForModel: replyCtxSnapshot.bodyForModel } : {}),
      ...(userMeta.mentions && userMeta.mentions.length > 0 ? { mentions: userMeta.mentions } : {}),
      ...(textHistoryBaseModelId ? { historyBaseModelId: textHistoryBaseModelId } : {}),
    }

    /* eslint-disable @typescript-eslint/no-explicit-any -- UIMessage / sendMessage payload */
    if (multiText) {
      const sends = textModelsForTurn.map((modelId, slotIdx) =>
        targetRuntime.askChats[slotIdx]!.sendMessage(
          {
            role: 'user',
            parts: partsForModel as any,
            messageId: textTurnId,
            ...(userMetadata ? { metadata: userMetadata } : {}),
          } as any,
          {
            body: {
              ...commonActBody,
              modelId,
              multiModelSlotIndex: slotIdx,
              multiModelTotal: textSlotCount,
            },
          },
        ),
      )
      void Promise.all(sends)
        .then(() => {
          targetRuntime.actChat.messages = [...targetRuntime.askChats[0]!.messages]
          completeSession(chatId, activeChatIdRef.current === chatId)
          loadChats()
          loadSubscription()
        })
        .catch((err) => {
          console.error('[ChatInterface] Act multi sendMessage failed', err)
          completeSession(chatId, activeChatIdRef.current === chatId)
          if (activeChatIdRef.current === chatId) {
            setComposerNotice(
              err instanceof Error ? err.message : 'Could not complete Act request. Try again.',
            )
            window.setTimeout(() => setComposerNotice(null), 8000)
          }
        })
    } else {
      void targetRuntime.actChat.sendMessage(
        {
          role: 'user',
          parts: partsForModel as any,
          messageId: textTurnId,
          ...(userMetadata ? { metadata: userMetadata } : {}),
        } as any,
        {
          body: {
            ...commonActBody,
            modelId: selectedActModelSnapshot,
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
    }
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
        const editorEl = textareaRef.current?.getElement?.()
        if (editorEl && (t === editorEl || editorEl.contains(t))) return
        if (t.closest('input, textarea, select, [contenteditable="true"]')) return
        e.preventDefault()
        textareaRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onGlobalKeyDown, true)
    return () => window.removeEventListener('keydown', onGlobalKeyDown, true)
  }, [])

  async function stopActiveChat() {
    if (!isActiveLoading) return
    const userTurns = primaryMessages.filter((m) => m.role === 'user').length
    const idx = userTurns > 0 ? userTurns - 1 : -1
    const chatId = activeChatIdRef.current ?? activeChatId
    const cloudflareStopTargets = new Map<string, { turnId: string; variantIndex: number }>()
    const collectCloudflareStopTargets = (messages: UIMessage[]) => {
      for (const message of messages) {
        const m = message as unknown as {
          role?: string
          status?: string
          turnId?: string
          id?: string
          variantIndex?: number
        }
        if (m.role === 'assistant' && m.status === 'generating' && m.turnId?.trim()) {
          const variantIndex = m.variantIndex ?? 0
          cloudflareStopTargets.set(`${m.turnId}:${variantIndex}`, {
            turnId: m.turnId,
            variantIndex,
          })
        }
      }
    }
    collectCloudflareStopTargets(activeRuntime.actChat.messages as UIMessage[])
    for (const chat of activeRuntime.askChats) {
      collectCloudflareStopTargets(chat.messages as UIMessage[])
    }
    if (cloudflareStopTargets.size === 0) {
      const lastUser = [...primaryMessages].reverse().find((message) => message.role === 'user') as
        | (UIMessage & { id?: string })
        | undefined
      const turnId = lastUser?.id?.trim()
      if (turnId) {
        cloudflareStopTargets.set(`${turnId}:0`, { turnId, variantIndex: 0 })
      }
    }

    // 1. Stop local streams immediately
    activeAskChats.forEach((chat) => chat.stop())
    activeRuntime.actChat.stop()

    // 2. Tell the backend to finalize the generating message before we clear
    //    local state, so patchFromServer doesn't race and restore the spinner.
    if (chatId) {
      if (chatStreamRelayApi && cloudflareStopTargets.size > 0) {
        await Promise.allSettled([...cloudflareStopTargets.values()].map((target) =>
          fetch(`${chatStreamRelayApi}/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              conversationId: chatId,
              turnId: target.turnId,
              variantIndex: target.variantIndex,
              multiModelSlotIndex: target.variantIndex,
            }),
          }),
        ))
      }
      try {
        await Promise.race([
          fetch('/api/app/conversations/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: chatId }),
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000),
          ),
        ])
      } catch {
        // Backend call failed or timed out — proceed with local cleanup anyway
      }
    }

    // 3. Clear any stuck 'generating' status from local messages so
    //    activePersistedGenerating drops immediately.
    for (const chat of activeRuntime.askChats) {
      let changed = false
      for (const msg of chat.messages) {
        const m = msg as unknown as { role?: string; status?: string }
        if (m.role === 'assistant' && m.status === 'generating') {
          m.status = 'completed'
          changed = true
        }
      }
      if (changed) chat.messages = [...chat.messages]
    }
    let actChanged = false
    for (const msg of activeRuntime.actChat.messages) {
      const m = msg as unknown as { role?: string; status?: string }
      if (m.role === 'assistant' && m.status === 'generating') {
        m.status = 'completed'
        actChanged = true
      }
    }
    if (actChanged) activeRuntime.actChat.messages = [...activeRuntime.actChat.messages]

    // Sync useChat instances so the UI reflects the cleared state
    chat0.setMessages([...activeRuntime.askChats[0].messages] as UIMessage[])
    if (activeAskChats[1]) chat1.setMessages([...activeRuntime.askChats[1].messages] as UIMessage[])
    if (activeAskChats[2]) chat2.setMessages([...activeRuntime.askChats[2].messages] as UIMessage[])
    if (activeAskChats[3]) chat3.setMessages([...activeRuntime.askChats[3].messages] as UIMessage[])
    actChat.setMessages([...activeRuntime.actChat.messages] as UIMessage[])

    if (idx >= 0) setInterruptedExchangeIdx(idx)
    forceLiveSyncRender((v) => v + 1)

    // Nuclear option: if Chat.status itself is still stuck after 3s,
    // delete and recreate the runtime with fresh Chat objects.
    if (!chatId) return
    setTimeout(() => {
      const runtime = runtimesRef.current.get(chatId)
      if (!runtime) return
      const stillLoading =
        runtime.askChats.some((c) => c.status === 'streaming' || c.status === 'submitted') ||
        runtime.actChat.status === 'streaming' ||
        runtime.actChat.status === 'submitted'
      if (stillLoading) {
        const uiSnapshot = { ...runtime.ui }
        const oldAskMessages = runtime.askChats.map((c) => [...c.messages])
        const oldActMessages = [...runtime.actChat.messages]
        runtimesRef.current.delete(chatId)
        const newRuntime = createConversationRuntime(chatId, uiSnapshot)
        newRuntime.askChats.forEach((chat, i) => {
          if (oldAskMessages[i]) chat.messages = oldAskMessages[i] as never
        })
        newRuntime.actChat.messages = oldActMessages as never
        runtimesRef.current.set(chatId, newRuntime)
        forceLiveSyncRender((v) => v + 1)
      }
    }, 400)
  }

  const stopActiveChatRef = useRef(stopActiveChat)
  stopActiveChatRef.current = stopActiveChat

  function handleContinue() {
    setInput('continue')
    void handleSend()
  }

  // Stale-chat client-side guard: if the backend says a message is still generating
  // but no local HTTP stream has produced activity in >30s, force-stop the chat.
  useEffect(() => {
    if (!activeChatId) return
    const id = setInterval(() => {
      const runtime = runtimesRef.current.get(activeChatId)
      if (!runtime) return
      const hasLocalStream =
        runtime.askChats.some((c) => c.status === 'streaming' || c.status === 'submitted') ||
        runtime.actChat.status === 'streaming' ||
        runtime.actChat.status === 'submitted'
      if (hasLocalStream) {
        lastStreamChunkAtRef.current = Date.now()
        return
      }
      const hasPersistedGenerating = (liveMessages ?? []).some(
        (message) => message.role === 'assistant' && message.status === 'generating',
      )
      if (!hasPersistedGenerating) return
      if (Date.now() - lastStreamChunkAtRef.current > 30000) {
        stopActiveChatRef.current()
      }
    }, 5000)
    return () => clearInterval(id)
  }, [activeChatId, liveMessages])

  // ── derived values for header ─────────────────────────────────────────────

  const activeChat = chats.find((c) => c._id === activeChatId)
  const modelPickerLabel = generationMode === 'image'
    ? (selectedImageModels.length === 1 ? (IMAGE_MODELS.find((m) => m.id === selectedImageModels[0])?.name ?? 'Select model') : `${selectedImageModels.length} models`)
    : generationMode === 'video'
    ? (selectedVideoModels.length === 1 ? (VIDEO_MODELS.find((m) => m.id === selectedVideoModels[0])?.name ?? 'Select model') : `${selectedVideoModels.length} models`)
    : (askModelSelectionMode === 'multiple' && selectedModels.length > 1
      ? `${selectedModels.length} models`
      : (getChatModelDisplayName(selectedActModel) || 'Select model'))

  // Read messages directly from the runtime Chat instance so the UI never lags
  // behind the loaded state (useChat's useSyncExternalStore can be one beat late).
  const primaryMessageSource =
    activeRuntime.askChats.find((chat) => chat.messages.some((message) => message.role === 'user')) ??
    (activeRuntime.actChat.messages.some((message) => message.role === 'user') ? activeRuntime.actChat : activeRuntime.askChats[0])
  const primaryMessages = (primaryMessageSource.messages as UIMessage[]) ?? []
  const hasRuntimeMessages =
    activeRuntime.actChat.messages.some((message) => message.role === 'user') ||
    activeRuntime.askChats.some((chat) => chat.messages.some((message) => message.role === 'user'))
  const hasHistory = hasRuntimeMessages || generationResults.size > 0
  const isExistingConversationView = Boolean(idParam || activeChatId || automationConversationId)
  const showChatLoadingState = showAutomationChatTab && isExistingConversationView && !hasHistory && !activeChatHydrated
  /** Empty chat (any modality): center composer + suggestions only on the true new-chat surface. */
  const showCenteredEmptyChat = !hasHistory && (!isExistingConversationView || activeChatHydrated)
  const userTurnCount = primaryMessages.filter((m) => m.role === 'user').length
  const latestExchIdx = userTurnCount > 0 ? userTurnCount - 1 : -1

  const handleSendRef = useRef(handleSend)
  handleSendRef.current = handleSend

  // Auto-continue: when the latest assistant message contains a timeout sentinel
  // and the user has enabled auto-continue, automatically send "continue".
  useEffect(() => {
    if (!settings.autoContinue || !activeChatId) return
    const latestAssistantMsg = [...primaryMessages].reverse().find((m) => {
      const um = m as unknown as { role?: string }
      return um.role === 'assistant'
    })
    if (!latestAssistantMsg) return
    const msgId = (latestAssistantMsg as unknown as { id?: string }).id
    if (!msgId || autoContinuedForMessageRef.current.has(msgId)) return

    const text = assistantBlocksToPlainText(
      buildAssistantVisualSequence(
        (latestAssistantMsg as unknown as { parts?: unknown[] }).parts,
      ),
    )
    if (!text.includes('[Request timed out after 300s. Continue?]')) return
    if ((latestAssistantMsg as unknown as { status?: string }).status !== 'completed') return

    autoContinuedForMessageRef.current.add(msgId)
    const timer = setTimeout(() => {
      setInput('continue')
      void handleSendRef.current()
    }, 1000)
    return () => clearTimeout(timer)
  }, [settings.autoContinue, activeChatId, primaryMessages, setInput])

  // Reset auto-continue tracking when switching chats.
  useEffect(() => {
    autoContinuedForMessageRef.current.clear()
  }, [activeChatId])

  const greetingLine = mode === 'automate' ? 'What are we automating today?' : chatGreetingLine(firstName)

  const selectAutomationDetailTab = useCallback((tab: AutomationDetailTab) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (tab === 'chat') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const query = params.toString()
    router.replace(`${pathname}${query ? `?${query}` : ''}`)
  }, [pathname, router, searchParams])

  const automationHeaderModels = selectableTextModels
  const saveAutomationHeaderModel = useCallback(async (modelId: string) => {
    if (!selectedAutomation) return
    const previousAutomation = selectedAutomation
    const nextAutomation = { ...selectedAutomation, modelId }
    setSelectedAutomation(nextAutomation)
    try {
      const res = await fetch('/api/app/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          automationId: selectedAutomation._id,
          modelId,
        }),
      })
      if (!res.ok) throw new Error('Failed to save automation model')
      window.dispatchEvent(new Event('overlay:automations-updated'))
    } catch {
      setSelectedAutomation(previousAutomation)
    }
  }, [selectedAutomation])

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-w-0 overflow-x-hidden">
      {/* Sidebar — hidden when embedded in a project */}
      {showOwnSidebar && (
        <>
          <div className="hidden h-full w-52 flex-col border-r border-[var(--border)] bg-[var(--surface-muted)] md:flex">
            <div className="flex h-16 items-center border-b border-[var(--border)] px-3">
              <button
                onClick={() => void createNewChat()}
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
                const isDeleting = deletingChatIds.includes(chat._id)
                return (
                  <div
                    key={chat._id}
                    onClick={() => {
                      if (isDeleting) return
                      if (isEditing) return
                      void loadChat(chat._id, { replaceUrl: false })
                    }}
                    className={`group flex cursor-pointer items-center justify-between overflow-hidden rounded-md px-2.5 text-xs transition-all duration-200 ${
                      isDeleting ? 'max-h-0 -translate-y-1 py-0 opacity-0' : 'max-h-10 py-1.5 opacity-100'
                    } ${
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
                          onClick={(e) => requestDeleteChat(chat, e)}
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
                      const isDeleting = deletingChatIds.includes(chat._id)
                      return (
                        <div
                          key={chat._id}
                          onClick={() => {
                            if (isDeleting) return
                            if (isEditing) return
                            void loadChat(chat._id, { replaceUrl: false })
                            setMobileChatListOpen(false)
                          }}
                          className={`group flex items-center justify-between overflow-hidden rounded-md px-2.5 text-xs transition-all duration-200 ${
                            isDeleting ? 'max-h-0 -translate-y-1 py-0 opacity-0' : 'max-h-11 py-2 opacity-100'
                          } ${
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
                                onClick={(e) => requestDeleteChat(chat, e)}
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
        className={`relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden transition-opacity duration-200 ${
          activeChatDeleting ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
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
        {/* Sticky header — md: h-16 aligns with AppSidebar brand row border; mobile: no title; model left + mode menu right */}
        <div className={`flex shrink-0 flex-col gap-2 border-b border-[var(--border)] px-3 py-2.5 md:h-16 md:min-h-16 md:max-h-16 md:flex-row md:items-center md:justify-between md:gap-3 md:overflow-visible md:py-0 md:px-4 ${hideHeader ? 'hidden' : ''}`}>
            <div
              className={`group/header-title min-w-0 items-center gap-2 ${
                activeChatId && editingChatId === activeChatId
                  ? 'flex w-full'
                  : selectedAutomation
                    ? 'flex w-full flex-wrap md:w-auto md:flex-nowrap'
                  : 'hidden min-[768px]:flex'
              }`}
            >
              {activeChatId && editingChatId === activeChatId ? (
                <input
                  ref={headerTitleInputRef}
                  className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm font-medium text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)] md:max-w-[min(100%,20rem)] lg:max-w-[24rem]"
                  value={editingChatTitle}
                  onChange={(e) => setEditingChatTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void commitChatRename(activeChatId)
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelChatRename()
                    }
                  }}
                  onBlur={() => void commitChatRename(activeChatId)}
                />
              ) : (
                <div className="flex min-w-0 items-center gap-1">
                  <h2 className="min-w-0 max-w-[min(100%,20rem)] text-sm font-medium leading-snug text-[var(--foreground)] md:truncate lg:max-w-[24rem]">
                    <span className="line-clamp-2 md:line-clamp-1 md:truncate">
                      {selectedAutomation?.name || activeChatTitle || activeChat?.title || (mode === 'automate' ? 'New automation' : 'New conversation')}
                    </span>
                  </h2>
                  {activeChatId && !selectedAutomation ? (
                    <button
                      type="button"
                      onClick={beginHeaderChatRename}
                      className="shrink-0 rounded p-1 text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--border)] hover:text-[var(--foreground)] group-hover/header-title:opacity-100 focus-visible:opacity-100"
                      aria-label="Rename chat"
                    >
                      <Pencil size={14} />
                    </button>
                  ) : null}
                </div>
              )}
              {projectName && (
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                  <FolderOpen size={9} />
                  <span className="max-w-[6rem] truncate sm:max-w-none">{projectName}</span>
                </span>
              )}
            </div>

            {selectedAutomation && (
              <div className="flex w-full shrink-0 items-center justify-end gap-2 md:w-auto">
                <div ref={modelPickerRef} data-tour="model-picker" className="relative min-w-0 flex-1 md:w-auto md:flex-none">
                  <DelayedTooltip label="Choose automation model" side="bottom">
                    <button
                      type="button"
                      onClick={() => setShowModelPicker((value) => !value)}
                      className="flex h-8 min-h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md bg-[var(--surface-subtle)] px-2.5 py-0 text-left text-xs leading-none text-[var(--muted)] hover:bg-[var(--border)] md:h-auto md:min-h-0 md:w-auto md:max-w-[13rem] md:py-1"
                      aria-label="Automation model"
                    >
                      <span className="min-w-0 truncate">{getChatModelDisplayName(selectedAutomation.modelId ?? DEFAULT_MODEL_ID) || 'Select model'}</span>
                      <ChevronDown size={11} className="shrink-0" />
                    </button>
                  </DelayedTooltip>
                  {showModelPicker && (
                    <>
                      {hoveredModelId && modelQualitiesPos ? (
                        <div
                          aria-hidden
                          className="pointer-events-none fixed z-[100] hidden w-44 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 shadow-md md:block"
                          style={{
                            left: modelQualitiesPos.x,
                            top: modelQualitiesPos.y,
                            transform: 'translate(calc(-100% - 8px), -50%)',
                          }}
                        >
                          <ModelQualitiesPanel modelId={hoveredModelId} />
                        </div>
                      ) : null}
                      <div
                        data-tour="model-picker"
                        className="absolute left-0 right-0 top-full z-20 mt-1 max-w-[calc(100vw-1.5rem)] rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg md:left-auto md:right-0 md:w-64 md:max-w-none"
                        onMouseLeave={() => {
                          setHoveredModelId(null)
                          setModelQualitiesPos(null)
                        }}
                      >
                        <div ref={modelPickerListScrollRef} className="max-h-72 overflow-y-auto">
                          {automationHeaderModels
                            .map((m, index, models) => {
                              const isSel = m.id === (selectedAutomation.modelId ?? DEFAULT_MODEL_ID)
                              const isFreeModelRow = isFreeTierChatModelId(m.id)
                              const previous = models[index - 1]
                              const previousIsFreeModelRow = previous ? isFreeTierChatModelId(previous.id) : false
                              const showFreeTierGroupDivider =
                                isFreeTier && !isFreeModelRow && previousIsFreeModelRow
                              const showFreeGroupDivider =
                                !isFreeTier && isFreeModelRow && !previousIsFreeModelRow
                              const showDivider = showFreeTierGroupDivider || showFreeGroupDivider
                              const dividerLabel = showFreeTierGroupDivider ? 'Premium' : 'Free'
                              return (
                                <div key={m.id}>
                                  {showDivider && (
                                    <div className="mt-1 border-t border-[var(--border)] px-3 pb-1 pt-2 text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--muted-light)]">
                                      {dividerLabel}
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    data-model-row={m.id}
                                    onClick={() => {
                                      void saveAutomationHeaderModel(m.id)
                                      setShowModelPicker(false)
                                    }}
                                    onMouseEnter={(e) => {
                                      setHoveredModelId(m.id)
                                      const r = e.currentTarget.getBoundingClientRect()
                                      setModelQualitiesPos({ x: r.left - 8, y: r.top + r.height / 2 })
                                    }}
                                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-muted)] ${
                                      isSel ? 'font-medium text-[var(--foreground)]' : 'text-[var(--muted)]'
                                    }`}
                                  >
                                    <span className="flex items-center gap-2">
                                      {isSel ? <Check size={10} /> : <span className="inline-block w-[10px]" />}
                                      {m.name}
                                    </span>
                                    <ModelBadges m={m} isFreeTier={isFreeTier} />
                                  </button>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 items-center rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-0.5">
                  {AUTOMATION_DETAIL_TABS.map((tab) => {
                    const active = automationDetailTab === tab.id
                    const TabIcon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => selectAutomationDetailTab(tab.id)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm'
                            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        <TabIcon size={12} strokeWidth={1.75} />
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Model picker + Generation mode (mobile: one row, model left / mode select right) */}
            <div className={`flex w-full min-w-0 flex-col gap-2 md:min-w-0 md:flex-1 md:flex-row md:items-center md:justify-end md:gap-2 ${
              mode === 'automate' || !showAutomationChatTab ? 'hidden' : ''
            }`}>
              {generationMode === 'video' && (
                <div ref={videoSubModePickerRef} className="relative w-full min-w-0 md:w-auto">
                  <button
                    type="button"
                    onClick={() => !isActiveLoading && setShowVideoSubModePicker((v) => !v)}
                    disabled={isActiveLoading}
                    className={`flex h-8 min-h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md bg-[var(--surface-subtle)] px-2.5 py-0 text-left text-xs leading-none md:h-auto md:min-h-0 md:w-auto md:max-w-[13rem] md:py-1 ${
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
              {isFreeTier && (
                <Link
                  href={isBudgetExhaustedPaid ? '/account' : '/pricing'}
                  className="hidden shrink-0 items-center gap-1 rounded-md border border-[#fde68a] bg-[#fffbeb] px-2.5 py-1 text-[11px] font-medium text-[#92400e] transition-colors hover:bg-[#fef3c7] md:flex"
                >
                  <ArrowUp size={10} />
                  {isBudgetExhaustedPaid ? 'Top up' : 'Upgrade'}
                </Link>
              )}
              <div className="flex w-full min-w-0 items-center justify-between gap-2 md:contents">
                <div ref={modelPickerRef} data-tour="model-picker" className="relative min-w-0 flex-1 md:w-auto md:flex-none">
                <DelayedTooltip label="Choose model (⇧⌘/)" side="bottom">
                  <button
                    type="button"
                    onClick={() => setShowModelPicker((v) => !v)}
                    className="flex h-8 min-h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md bg-[var(--surface-subtle)] px-2.5 py-0 text-left text-xs leading-none text-[var(--muted)] hover:bg-[var(--border)] md:h-auto md:min-h-0 md:w-auto md:max-w-[13rem] md:py-1"
                  >
                    <span className="min-w-0 truncate">{modelPickerLabel}</span>
                    <ChevronDown size={11} className="shrink-0" />
                  </button>
                </DelayedTooltip>
                {showModelPicker && (
                  <>
                  {generationMode === 'text' && hoveredModelId && modelQualitiesPos ? (
                    <div
                      aria-hidden
                      className="pointer-events-none fixed z-[100] hidden w-44 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 shadow-md md:block"
                      style={{
                        left: modelQualitiesPos.x,
                        top: modelQualitiesPos.y,
                        transform: 'translate(calc(-100% - 8px), -50%)',
                      }}
                    >
                      <ModelQualitiesPanel modelId={hoveredModelId} />
                    </div>
                  ) : null}
                  <div
                    data-tour="model-picker"
                    className="absolute left-0 right-0 top-full z-20 mt-1 max-w-[calc(100vw-1.5rem)] rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg md:left-auto md:right-0 md:w-64 md:max-w-none"
                    onMouseLeave={() => {
                      setHoveredModelId(null)
                      setModelQualitiesPos(null)
                    }}
                  >
                  <div ref={modelPickerListScrollRef} className="max-h-72 overflow-y-auto">
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
                  ) : (
                    selectableTextModels
                      .map((m, index, models) => {
                        const isSel =
                        askModelSelectionMode === 'single'
                          ? m.id === selectedActModel
                          : selectedModels.includes(m.id)
                      const isDisabled =
                        askModelSelectionMode === 'multiple' && !isSel && selectedModels.length >= 4
                      const isFreeModelRow = isFreeTierChatModelId(m.id)
                      const previous = models[index - 1]
                      const previousIsFreeModelRow = previous ? isFreeTierChatModelId(previous.id) : false
                      // Free-tier users see free models first; the divider then
                      // marks the start of the (locked) premium section. Otherwise
                      // it marks the start of the free section appended at the end.
                      const showFreeTierGroupDivider =
                        isFreeTier && !isFreeModelRow && previousIsFreeModelRow
                      const showFreeGroupDivider =
                        !isFreeTier && isFreeModelRow && !previousIsFreeModelRow
                      const showDivider = showFreeTierGroupDivider || showFreeGroupDivider
                      const dividerLabel = showFreeTierGroupDivider ? 'Premium' : 'Free'
                      return (
                        <div key={m.id}>
                          {showDivider && (
                            <div className="mt-1 border-t border-[var(--border)] px-3 pb-1 pt-2 text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--muted-light)]">
                              {dividerLabel}
                            </div>
                          )}
                          <button
                            type="button"
                            data-model-row={m.id}
                            disabled={isDisabled}
                            onClick={() => toggleTextModelInPicker(m.id)}
                            onMouseEnter={(e) => {
                              setHoveredModelId(m.id)
                              const r = e.currentTarget.getBoundingClientRect()
                              setModelQualitiesPos({ x: r.left - 8, y: r.top + r.height / 2 })
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                              isDisabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-[var(--surface-muted)]'
                            } ${isSel ? 'text-[var(--foreground)] font-medium' : 'text-[var(--muted)]'}`}
                          >
                            <span className="flex items-center gap-2">
                              {isSel ? <Check size={10} /> : <span className="w-[10px] inline-block" />}
                              {m.name}
                            </span>
                            <ModelBadges m={m} isFreeTier={isFreeTier} />
                          </button>
                        </div>
                      )
                    })
                  )}
                  </div>
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
                  {generationMode === 'text' && !hasAutomationContext && (
                    <div className="border-t border-[var(--border)] px-2 py-2">
                      <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--surface-subtle)] p-0.5">
                        {(['single', 'multiple'] as const).map((selMode) => {
                          const isActive = askModelSelectionMode === selMode
                          const multipleDisabled = isFreeTier && selMode === 'multiple'
                          return (
                            <button
                              key={selMode}
                              type="button"
                              onClick={() => handleTextModelSelectionModeChange(selMode)}
                              disabled={multipleDisabled}
                              className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${
                                isActive
                                  ? 'bg-[var(--surface-elevated)] font-medium text-[var(--foreground)] shadow-sm'
                                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                              } ${
                                multipleDisabled ? 'cursor-not-allowed opacity-40' : ''
                              }`}
                            >
                              {selMode}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  </div>
                  </>
              )}
            </div>
                <div className="flex shrink-0 items-center gap-1.5 md:hidden">
                  <GenerationModeSelect
                    mode={generationMode}
                    onChange={handleModeChange}
                    disabled={isActiveLoading}
                  />
                  {activeChatId && !selectedAutomation && primaryMessages.length > 0 && (
                    <ExportMenu
                      className="shrink-0"
                      type="chat"
                      title={activeChatTitle || activeChat?.title || 'New conversation'}
                      content={primaryMessages.map((m) => ({
                        role: m.role,
                        content: (m.parts as Array<{ type: string; text?: string }>)?.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('\n') ?? '',
                        parts: m.parts as Array<{ type: string; text?: string }>,
                      }))}
                      metadata={{
                        createdAt: activeChat?.createdAt,
                        updatedAt: activeChat?.updatedAt,
                        modelIds: activeChat?.modelIds,
                      }}
                    />
                  )}
                </div>
              </div>
            <DelayedTooltip label="Cycle text / image / video (⇧⌘.)" side="bottom">
              <span data-tour="generation-mode-toggle" className="hidden md:inline-flex">
                <GenerationModeToggle mode={generationMode} onChange={handleModeChange} disabled={isActiveLoading} />
              </span>
            </DelayedTooltip>

            {/* Export Menu */}
            {activeChatId && !selectedAutomation && primaryMessages.length > 0 && (
              <ExportMenu
                className="hidden md:block"
                type="chat"
                title={activeChatTitle || activeChat?.title || 'New conversation'}
                content={primaryMessages.map((m) => ({
                  role: m.role,
                  content: (m.parts as Array<{ type: string; text?: string }>)?.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('\n') ?? '',
                  parts: m.parts as Array<{ type: string; text?: string }>,
                }))}
                metadata={{
                  createdAt: activeChat?.createdAt,
                  updatedAt: activeChat?.updatedAt,
                  modelIds: activeChat?.modelIds,
                }}
              />
            )}
          </div>
        </div>

        {hasAutomationContext && !selectedAutomationLoading && !selectedAutomation && !showAutomationChatTab && (
          <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6">
            <p className="text-sm text-[var(--muted)]">Automation not found.</p>
          </div>
        )}

        {!showAutomationChatTab && selectedAutomation && automationDetailTab === 'edit' && (
          <AutomationEditorPanel
            automation={selectedAutomation}
            onSaved={setSelectedAutomation}
            onTested={(conversationId) => {
              const params = new URLSearchParams(searchParams?.toString() ?? '')
              params.set('id', conversationId)
              params.set('automationId', selectedAutomation._id)
              params.delete('tab')
              router.replace(`${pathname}?${params.toString()}`)
            }}
            isFreeTier={isFreeTier}
          />
        )}

        {/* Messages — only after first exchange; existing chat loading reserves this area so the composer stays docked. */}
        {showAutomationChatTab && (hasHistory || showChatLoadingState) && (
        <div
          ref={messagesScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4"
        >
          <div className="mx-auto flex min-h-full w-full min-w-0 max-w-4xl flex-col gap-5 sm:gap-6">
            {showChatLoadingState ? (
              <div className="flex min-h-full flex-col justify-start pt-4 sm:pt-6">
                <div className="max-w-2xl space-y-4">
                  <div className="tool-line-shimmer w-fit text-sm font-medium">
                    Loading conversation
                  </div>
                  <div className="space-y-2.5">
                    <div className="ui-skeleton-line h-3 w-[min(72%,34rem)]" />
                    <div className="ui-skeleton-line h-3 w-[min(88%,42rem)]" />
                    <div className="ui-skeleton-line h-3 w-[min(54%,26rem)]" />
                  </div>
                </div>
              </div>
            ) : (() => {
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
                const isMultiAct = isActExch && exchModelList.length > 1
                const streamSlotIdx = !selectedModelId
                  ? -1
                  : isMultiAct
                    ? exchModelList.indexOf(selectedModelId)
                    : isActExch
                      ? -1
                      : selectedModels.indexOf(selectedModelId)
                const slotInst =
                  streamSlotIdx >= 0 ? chatInstances[streamSlotIdx] : null

                let responseMsg = getResponseForExchangeForModel(
                  selectedModelId,
                  curExchIdx,
                  isMultiAct ? exchModelList : undefined,
                )
                let responseText = responseMsg ? getMessageText(responseMsg) : ''

                // Act (single): assistant streams into actChat; align with chat0 user index (see resolveActAssistant).
                if (isActExch && !isMultiAct) {
                  const paired = resolveActAssistant(primaryMessages, actChat.messages, msg.id)
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

                const multiActInst = streamSlotIdx >= 0 ? chatInstances[streamSlotIdx] : null
                const persistedResponseStatus = (
                  responseMsg as unknown as { status?: 'generating' | 'completed' | 'error' } | null
                )?.status
                const activeHttpLoading = isLatest && (
                  (isActExch
                    ? (isMultiAct
                        ? (multiActInst?.status === 'streaming' || multiActInst?.status === 'submitted')
                        : (actChat.status === 'streaming' || actChat.status === 'submitted'))
                    : !!slotInst && (slotInst.status === 'streaming' || slotInst.status === 'submitted'))
                  || isOptimisticLoading
                )
                const instLoading = activeHttpLoading || persistedResponseStatus === 'generating'
                const instError = isLatest
                  ? (persistedResponseStatus === 'error'
                      ? new Error('Generation failed')
                      : isActExch
                      ? (isMultiAct && streamSlotIdx >= 0
                          ? (chatInstances[streamSlotIdx]?.error ?? null)
                          : isMultiAct
                            ? null
                            : actChat.error)
                      : (slotInst?.error ?? null))
                  : null

                const responseParts =
                  responseMsg && 'parts' in responseMsg && Array.isArray((responseMsg as { parts?: unknown[] }).parts)
                    ? (responseMsg as { parts: unknown[] }).parts
                    : undefined
                let assistantVisualBlocks = buildAssistantVisualSequence(responseParts)
                if (assistantVisualBlocks.length === 0 && responseText.trim()) {
                  assistantVisualBlocks = [{ kind: 'text', text: normalizeAgentAssistantText(responseText) }]
                }
                const hasAssistantText = assistantVisualBlocks.some((b) => b.kind === 'text' && b.text.trim().length > 0)
                const hasAssistantActivity = assistantVisualBlocks.length > 0
                const isStreaming = (activeHttpLoading || persistedResponseStatus === 'generating') && hasAssistantActivity
                const isTextStreaming = activeHttpLoading && hasAssistantText

                const rawUserText = getMessageText(msg)
                const metaDocs = getUserMessageDocNames(msg)
                const { bodyText, docNames: parsedDocNames } = splitUserDisplayText(rawUserText)
                const userDocumentNames = metaDocs.length > 0 ? metaDocs : parsedDocNames
                const userBodyText = metaDocs.length > 0 ? rawUserText.trim() : bodyText
                const userIndexedAttachments = (msg as { metadata?: { indexedAttachments?: { name: string; fileIds: string[] }[] } })?.metadata?.indexedAttachments ?? []

                const sourceCitations = (
                  responseMsg as { metadata?: { sourceCitations?: SourceCitationMap } } | undefined
                )?.metadata?.sourceCitations
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
                    userIndexedAttachments={userIndexedAttachments}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    userImages={getMessageImages(msg as any)}
                    exchIdx={curExchIdx}
                    responseModelId={selectedModelId}
                    assistantVisualBlocks={assistantVisualBlocks}
                    isStreaming={isStreaming}
                    isTextStreaming={isTextStreaming}
                    errorMessage={errLabelForTurn}
                    exchModelList={exchModelList}
                    selectedTab={selectedTab}
                    onTabSelect={(tabIdx) => handleTabSelect(curExchIdx, tabIdx)}
                    isLoadingTabs={false}
                    responseInProgress={instLoading}
                    sourceCitations={sourceCitations}
                    turnIdForActions={textTurnIdForActions}
                    modelLabel={modelLabel}
                    onDeleteTurn={() => {
                      const tid = getUserTurnId(msg)
                      if (tid) void handleDeleteTurnById(tid)
                    }}
                    onReply={() =>
                      beginReplyToAssistantText(replyPlainForInterrupt, getUserTurnId(msg))
                    }
                    onBranch={() => void handleBranchConversationAtTurn(getUserTurnId(msg))}
                    interrupted={interruptedHere}
                    actionsLocked={isLatest && isActiveLoading}
                    isExiting={textIsExiting}
                    replyThreadMeta={getUserReplyThreadMeta(msg)}
                    onJumpToReply={jumpToReplyTarget}
                    onOpenDraft={setDraftModalState}
                    onOpenSources={openSourcesPanel}
                    isSourcesOpenForThis={
                      !!sourcesPanel &&
                      sourcesPanel.turnId === (textTurnIdForActions ?? msg.id)
                    }
                    onRetry={() =>
                      void handleRetryExchange(
                        msg as UIMessage,
                        curExchIdx,
                        isActExch,
                        exchModelList,
                      )
                    }
                    retryDisabled={
                      !textTurnIdForActions ||
                      textIsExiting ||
                      (isLatest && isActiveLoading) ||
                      instLoading
                    }
                    onOpenFilePreview={openFilePreview}
                    userMentions={(msg as { metadata?: { mentions?: Array<{ type: string; id: string; name: string }> } })?.metadata?.mentions}
                    onContinue={
                      (['[Request timed out after 300s. Continue?]', '[Interrupted by user. Continue?]'] as const).some((s) =>
                        assistantPlainForReply.includes(s),
                      )
                        ? handleContinue
                        : undefined
                    }
                  />
                )
              }

              return blocks
            })()}
            <div ref={messagesEndRef} />
          </div>
        </div>
        )}

        {showAutomationChatTab && (
          <>
        {/* Input — empty chat: mobile = greeting centered, composer at bottom, no suggestions; md+ = legacy centered stack */}
        <div
          className={`flex min-h-0 flex-col ${
            showCenteredEmptyChat ? 'min-h-0 flex-1 md:justify-center' : 'shrink-0'
          } ${!showCenteredEmptyChat ? 'px-3 pb-3 sm:px-4 sm:pb-4' : 'px-4 pb-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))]'}`}
        >
          <AnimatePresence initial={false}>
            {showCenteredEmptyChat && (
              <motion.div
                key="chat-empty-hero"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="text-center max-md:min-h-0 max-md:flex-1 max-md:flex max-md:flex-col max-md:items-center max-md:justify-center md:mb-8"
              >
                <p className="text-3xl text-[var(--foreground)]" style={{ fontFamily: 'var(--font-serif)' }}>
                  {greetingLine}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Use CSS max-width (not motion maxWidth) so the composer column is always capped; framer omitted maxWidth on first paint and chips could span full viewport. */}
          <div
            className={`mx-auto w-full min-w-0 shrink-0 transition-[max-width] duration-[780ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
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
              isBudgetExhaustedPaid ? (
                <TopUpPreferenceControl
                  variant="app"
                  title="No budget for paid models"
                  description="You can keep chatting with free models now. Add budget to use paid models and gated tools like web search, browser sessions, sandboxes, image generation, and video generation."
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
                      Your paid storage stays active. You can also manage budget from{' '}
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
                        onClick={() => {
                          setSelectedModels([FREE_TIER_DEFAULT_MODEL_ID])
                          setAskModelSelectionMode('single')
                          setSelectedActModel(FREE_TIER_DEFAULT_MODEL_ID)
                          localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify([FREE_TIER_DEFAULT_MODEL_ID]))
                          localStorage.setItem(ACT_MODEL_KEY, FREE_TIER_DEFAULT_MODEL_ID)
                        }}
                        className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-opacity hover:opacity-90"
                      >
                        Use free model
                      </button>
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
              ) : (
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--muted)]">
                  <AlertCircle size={13} className="text-amber-500 shrink-0" />
                  This model requires a paid plan. Switch to Auto or upgrade.
                </div>
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
                <MentionInput
                  ref={textareaRef}
                  value={input}
                  valueRevision={inputRevision}
                  onChange={handleComposerInputChange}
                  onMentionsChange={setMentions}
                  onPaste={handlePaste}
                  onUploadFile={() => docInputRef.current?.click()}
                  placeholder={
                    mode === 'automate'
                      ? 'Describe an automation, use @ to reference files, skills, automations...'
                      : 'Ask anything, use @ to reference files, skills, automations...'
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
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
                  <DelayedTooltip label="Reference files, skills, automations…" side="top">
                    <button
                      type="button"
                      onClick={() => textareaRef.current?.openMentionPopup()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                      aria-label="Insert mention"
                    >
                      <AtSign size={16} strokeWidth={1.75} />
                    </button>
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
                    <div ref={modeMenuRef} className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowModeMenu((v) => !v)}
                        className={`flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs transition-colors hover:bg-[var(--surface-muted)] ${
                          mode === 'automate'
                            ? 'text-[var(--foreground)]'
                            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        {mode === 'automate' ? (
                          <Zap size={12} strokeWidth={1.75} />
                        ) : (
                          <MessageSquare size={12} strokeWidth={1.75} />
                        )}
                        <span>{mode === 'automate' ? 'Automate' : 'Chat'}</span>
                        <ChevronDown size={10} className="opacity-60" />
                      </button>
                      {showModeMenu && (
                        <div className="absolute bottom-full right-0 mb-2 z-20 w-40 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => { router.push('/app/chat'); setShowModeMenu(false) }}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-[var(--surface-muted)] ${
                              mode === 'chat' ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'
                            }`}
                          >
                            <MessageSquare size={13} />
                            <span>Chat</span>
                            {mode === 'chat' && <Check size={11} className="ml-auto" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => { router.push('/app/automations'); setShowModeMenu(false) }}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-[var(--surface-muted)] ${
                              mode === 'automate' ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'
                            }`}
                          >
                            <Zap size={13} strokeWidth={1.75} />
                            <span>Automate</span>
                            {mode === 'automate' && <Check size={11} className="ml-auto" />}
                          </button>
                        </div>
                      )}
                    </div>
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
                            !hasComposerText &&
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
                className="mx-auto mt-6 hidden w-full max-w-[36rem] min-w-0 px-0 md:mt-6 md:block"
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
          {showCenteredEmptyChat && belowEmptyComposer ? (
            <div className="mx-auto mt-8 w-full max-w-[36rem] min-w-0 px-0">
              {belowEmptyComposer}
            </div>
          ) : null}
        </div>
          </>
        )}

        <DraftReviewModal
          state={draftModalState}
          saving={isDraftSaving}
          onClose={() => {
            if (!isDraftSaving) setDraftModalState(null)
          }}
          onSaveSkill={saveSkillDraft}
          onSaveAutomation={saveAutomationDraft}
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
      <WebSourcesSidebar
        open={!!sourcesPanel}
        onClose={closeSourcesPanel}
        sources={sourcesPanel?.sources ?? []}
      />

      {/* File preview dialog */}
      {filePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeFilePreview() }}
        >
          <div
            className="flex max-h-[min(92vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-2">
              <span className="truncate text-sm font-medium text-[var(--foreground)]">{filePreview.name}</span>
              <button
                type="button"
                onClick={closeFilePreview}
                className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex min-h-[min(75vh,720px)] flex-1 flex-col overflow-hidden">
              <FileViewerPanel
                name={filePreview.name}
                content={filePreviewContent}
                url={`/api/app/files/${filePreview.fileId}/content`}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDeleteChat !== null}
        title="Delete chat?"
        description={confirmDeleteChat ? `“${confirmDeleteChat.title || 'Untitled chat'}” will be permanently deleted. This can’t be undone.` : undefined}
        confirmLabel="Delete"
        onConfirm={() => void performDeleteChat()}
        onCancel={() => setConfirmDeleteChat(null)}
      />
    </div>
  )
}
