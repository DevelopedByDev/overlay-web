import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, BookOpen, ChevronDown, FileText, GitBranch, Play, Reply, RotateCw, Search, Trash2 } from 'lucide-react'
import type { AssistantVisualBlock, DraftModalState, ToolGroupItem, ToolVisualBlock } from '@overlay/chat-core'
import {
  ASSISTANT_COLLAPSIBLE_BODY_CLASS,
  OVERLAY_LOGO_SRC,
  TOOL_UI_DONE_STATES,
  assistantBlocksToPlainText,
  buildAssistantVisualSegments,
  collectWebSourcesFromBlocks,
  collectWebSourcesFromSingleBlock,
  computeToolChainFlags,
  faviconUrl,
  getDraftFromToolBlock,
  hostFromUrl,
  isOverlayGatedToolOutput,
} from '@overlay/chat-core'
import type { SourceCitationMap } from '../lib/source-citations'
import { safeHttpUrl } from '../lib/safe-url'
import { webSourceDisplayKey, type WebSourceItem } from '../lib/web-sources'
import { getDescriptiveToolLabel, pickFirstStringFromInput } from '../lib/tool-labels'
import { MarkdownMessage } from './MarkdownMessage'
import { FlashCopyIconButton } from './DraftReviewModal'
import { JsonRenderPart } from './data-parts'

function ToolLineLogo() {
  return (
    <img
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
          <a
            href="/pricing"
            className="whitespace-nowrap font-medium text-[var(--foreground)] underline underline-offset-2 hover:opacity-80"
          >
            Upgrade
          </a>
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
): ReactNode {
  if (!mentions?.length || !text) return text
  const sorted = [...mentions].sort((a, b) => b.name.length - a.name.length)
  const escaped = sorted.map((m) => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`@(${escaped.join('|')})`, 'g')
  const parts: ReactNode[] = []
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

export interface ExchangeBlockProps {
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
  conversationId?: string | null
  assistantMessageId?: string | null
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
  getModelDisplayName: (modelId: string) => string
}

export function ExchangeBlock({
  userMsgId, userBodyText, userDocumentNames, userIndexedAttachments, userImages, exchIdx, responseModelId, assistantVisualBlocks, isStreaming, isTextStreaming, errorMessage,
  exchModelList, selectedTab, onTabSelect, isLoadingTabs, responseInProgress, conversationId, assistantMessageId, sourceCitations,
  turnIdForActions, modelLabel, onDeleteTurn, onReply, onBranch, interrupted = false, actionsLocked, isExiting = false, replyThreadMeta, onJumpToReply,
  onOpenDraft, onOpenSources, isSourcesOpenForThis, onRetry, retryDisabled = true, onOpenFilePreview, userMentions, onContinue, getModelDisplayName,
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
              const mName = getModelDisplayName(mId)
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
          if (seg.kind === 'render-ui') {
            return (
              <div key={`${exchIdx}-seq-${seg.originIndex}-${seg.block.key}`} className="w-full px-1 py-1">
                <JsonRenderPart
                  payload={seg.block.payload}
                  dataPartId={seg.block.dataPartId}
                  conversationId={conversationId}
                  assistantMessageId={assistantMessageId}
                  responseInProgress={responseInProgress}
                />
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
