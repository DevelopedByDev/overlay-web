'use client'

import { type ReactNode, useMemo, useState, useSyncExternalStore } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { Pluggable } from 'unified'
import { mergeGfmTableContinuationLines } from '@/lib/markdown-table-fix'
import { stripThinkingPlaceholderMarkdown } from '@/lib/agent-assistant-text'
import type { SourceCitationMap } from '@/lib/ask-knowledge-context'
import { linkifyInlineWebCitations, webSourceDisplayKey, type WebSourceItem } from '@/lib/web-sources'
import { WebSourceTooltip } from './WebSourceTooltip'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

function useDocumentThemeIsDark(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const el = document.documentElement
      const obs = new MutationObserver(onStoreChange)
      obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
      return () => obs.disconnect()
    },
    () => document.documentElement.getAttribute('data-theme') === 'dark',
    () => false,
  )
}

function extractLinkText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractLinkText).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    return extractLinkText((node as { props: { children?: ReactNode } }).props.children)
  }
  return ''
}

const mdSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'br'],
  attributes: {
    ...defaultSchema.attributes,
    br: [],
  },
}

function stripHtmlishToMarkdown(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '')
    .replace(/<li>/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    .replace(/<\/?(ul|ol)>/gi, '')
    .replace(/&nbsp;/gi, ' ')
}

/** Models often emit full-width lenticular brackets; normalize to ASCII for **Sources:** lines. */
function bracketNormalize(text: string): string {
  return text.replace(/【/g, '[').replace(/】/g, ']')
}

/**
 * Remove the trailing "Sources: …" prose block models emit at the end of web-search responses.
 * We surface sources via inline chips + the sources sidebar button, so the plaintext list is redundant.
 * Conservative: only strips when the block appears near the end of the message.
 */
function stripTrailingSourcesBlock(text: string): string {
  const lines = text.split('\n')
  // Find last non-empty line that starts a Sources: paragraph.
  let startIdx = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i]!.trimStart()
    if (trimmed === '') continue
    if (/^(\*\*)?\s*(Sources|Citations|References)\s*:?/i.test(trimmed)) {
      startIdx = i
    }
    break
  }
  if (startIdx < 0) return text
  // Strip from the Sources: line through end-of-text (inclusive).
  const kept = lines.slice(0, startIdx)
  while (kept.length > 0 && kept[kept.length - 1]!.trim() === '') kept.pop()
  return kept.join('\n')
}

/** Turn `[n]` on **Sources:** lines into markdown links to Knowledge (when we have retrieval metadata). */
function linkifySourceCitations(text: string, citations: SourceCitationMap): string {
  if (!citations || Object.keys(citations).length === 0) return text
  const lines = text.split('\n')
  return lines
    .map((line) => {
      const trimmed = line.trimStart()
      if (!/^(\*\*)?Sources:(\*\*)?/i.test(trimmed)) return line
      return line.replace(/\[\s*(\d+)\s*\](?!\()/g, (_m, d) => {
        const key = String(Number(d))
        const src = citations[key]
        if (!src) return `[${d}]`
        const href =
          src.kind === 'memory'
            ? `/app/knowledge?memory=${encodeURIComponent(src.sourceId)}`
            : `/app/knowledge?file=${encodeURIComponent(src.sourceId)}`
        return `[${d}](${href})`
      })
    })
    .join('\n')
}

function normalizeGeneratedMarkdown(
  text: string,
  options?: {
    sourceCitations?: SourceCitationMap
    linkifyCitations?: boolean
    webSources?: WebSourceItem[]
    linkifyWebCitations?: boolean
  },
): string {
  let t = mergeGfmTableContinuationLines(stripHtmlishToMarkdown(stripThinkingPlaceholderMarkdown(text)))
  t = bracketNormalize(t)
  const hasKnowledgeCitations =
    !!(options?.sourceCitations && Object.keys(options.sourceCitations).length > 0)
  const hasWebSources = !!(options?.webSources && options.webSources.length > 0)
  // Strip the redundant trailing "Sources:" prose block — we surface web sources via the sidebar
  // button + inline chips. Keep the block when we only have knowledge citations (those still
  // rely on the numbered list for Knowledge linkify).
  if (hasWebSources && !hasKnowledgeCitations) {
    t = stripTrailingSourcesBlock(t)
  }
  if (
    options?.linkifyWebCitations &&
    options?.webSources &&
    options.webSources.length > 0
  ) {
    t = linkifyInlineWebCitations(t, options.webSources, {
      skipKnowledgeSourceLines: hasKnowledgeCitations,
    })
  }
  if (options?.linkifyCitations && hasKnowledgeCitations) {
    t = linkifySourceCitations(t, options.sourceCitations!)
  }
  return t
}

const CONNECT_SERVICE_DESCRIPTIONS: Record<string, string> = {
  'gmail': 'Compose, send, and search emails',
  'google calendar': 'Read and create calendar events',
  'google sheets': 'Read, update, and create spreadsheets',
  'google drive': 'Search and manage Drive files',
  'google meet': 'Join and manage video meetings',
  'notion': 'Create pages and manage workspace',
  'outlook': 'Send emails and manage calendar',
  'x (twitter)': 'Post tweets and manage your account',
  'twitter': 'Post tweets and manage your account',
  'asana': 'Create tasks and manage projects',
  'linkedin': 'Manage posts and profile actions',
}

// Custom code block with syntax highlighting and copy button
function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false)
  const isDark = useDocumentThemeIsDark()

  function handleCopy() {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-lang">{language}</span>
        <button type="button" className="code-block-copy" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>
      <SyntaxHighlighter
        style={isDark ? oneDark : oneLight}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: '0 0 10px 10px',
          background: isDark ? 'transparent' : '#f8f8f8',
          fontSize: '0.85rem',
          lineHeight: '1.6',
        }}
        codeTagProps={{
          style: { fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace" },
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}

// Stable markdown components — defined outside component to avoid re-creation
const baseMdComponents = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a({ href, children }: any) {
    const linkText = extractLinkText(children as ReactNode).trim()
    const connectMatch = linkText.match(/^connect\s+(.+)$/i)

    if (connectMatch && href) {
      const serviceName = connectMatch[1].trim()
      const description =
        CONNECT_SERVICE_DESCRIPTIONS[serviceName.toLowerCase()] ||
        'Connect to use this integration'

      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="no-underline">
          <span
            className="my-1.5 inline-flex max-w-[360px] min-w-[260px] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5 transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] text-xs font-bold text-[var(--foreground)]"
            >
              {serviceName.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-snug text-[var(--foreground)]">{serviceName}</span>
              <span className="block text-xs leading-snug text-[var(--muted)]">{description}</span>
            </span>
            <span className="shrink-0 whitespace-nowrap rounded-md bg-[var(--foreground)] px-3 py-1.5 text-xs text-[var(--background)]">
              Connect
            </span>
          </span>
        </a>
      )
    }

    // Models sometimes wrap long pasted text as a link to `/app/...`, which becomes a client 404.
    if (
      typeof href === 'string' &&
      href.startsWith('/app/') &&
      (href.length > 96 || href.includes('%7C') || href.includes('|'))
    ) {
      return <span className="whitespace-pre-wrap wrap-break-word text-[var(--foreground)]">{children}</span>
    }

    if (typeof href === 'string' && href.startsWith('/app/')) {
      return (
        <a href={href} className="text-[#2563eb] underline underline-offset-2 font-medium hover:text-[#1d4ed8]">
          {children}
        </a>
      )
    }

    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  code({ className, children }: any) {
    const match = /language-(\w+)/.exec(className || '')
    // Block code = has a language class from the fence
    if (match) {
      return (
        <CodeBlock language={match[1]}>
          {String(children).replace(/\n$/, '')}
        </CodeBlock>
      )
    }
    return <code className={className}>{children}</code>
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table({ children }: any) {
    return (
      <div className="table-wrapper">
        <table>{children}</table>
      </div>
    )
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  td({ children }: any) {
    return <td className="align-top [&_p:last-child]:mb-0 [&_ul:last-child]:mb-0 [&_ol:last-child]:mb-0">{children}</td>
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  th({ children }: any) {
    return <th className="align-top">{children}</th>
  },
}

const markdownRemarkPlugins = [remarkGfm, remarkMath]
const markdownRehypePlugins: Pluggable[] = [
  rehypeRaw,
  [rehypeSanitize, mdSanitizeSchema] as Pluggable,
  rehypeKatex,
]

// Find the char position of a safe paragraph boundary in `text`.
// We only split at \n\n that is NOT inside a code fence, a table, or a math block.
function findParagraphBoundary(text: string): number | null {
  const lines = text.split('\n')
  let inCodeBlock = false
  let inTable = false
  let inMathBlock = false
  let pos = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
    }

    if (!inCodeBlock) {
      if (trimmed === '$$') {
        inMathBlock = !inMathBlock
      }

      if (line.trimStart().startsWith('|')) {
        inTable = true
      } else if (inTable && line.trim() === '') {
        inTable = false
      }
    }

    // A blank line outside a code block / table / math block = paragraph boundary
    if (trimmed === '' && !inCodeBlock && !inTable && !inMathBlock && i > 0) {
      return pos // return start of the blank line (content before it is a complete block)
    }

    pos += line.length + 1 // +1 for the \n
  }

  return null
}

interface Props {
  text: string
  isStreaming: boolean
  /** From stream metadata — links [n] on **Sources:** lines to Knowledge */
  sourceCitations?: SourceCitationMap
  /** Web search / browser tool results — inline `[n]` chips + sidebar (parent) */
  webSources?: WebSourceItem[]
  /**
   * When true, do not render the three-dot typing indicator here (parent shows a single indicator at the bottom).
   * Still renders completed paragraph blocks plus the in-flight tail so text streams without duplicate dots mid-message.
   */
  suppressTypingIndicator?: boolean
}

function splitStreamingMarkdown(text: string): { completedBlocks: string[]; streamTail: string } {
  const completedBlocks: string[] = []
  let offset = 0

  while (offset < text.length) {
    const boundary = findParagraphBoundary(text.slice(offset))
    if (boundary === null) break
    if (boundary === 0) {
      offset += 1
      continue
    }

    const blockText = text.slice(offset, offset + boundary)
    if (blockText) completedBlocks.push(blockText)
    offset += boundary
    while (offset < text.length && (text[offset] === '\n' || text[offset] === '\r')) {
      offset += 1
    }
  }

  return { completedBlocks, streamTail: text.slice(offset) }
}

export function MarkdownMessage({
  text,
  isStreaming,
  sourceCitations,
  webSources,
  suppressTypingIndicator = false,
}: Props) {
  const hasCitationMap = !!(sourceCitations && Object.keys(sourceCitations).length > 0)
  const hasWebSources = !!(webSources && webSources.length > 0)
  const normalizedDisplay = useMemo(
    () =>
      normalizeGeneratedMarkdown(text, {
        sourceCitations,
        linkifyCitations: !isStreaming && hasCitationMap,
        webSources,
        // Linkify web citations even while streaming so inline chips render with the text,
        // instead of appearing only after completion.
        linkifyWebCitations: hasWebSources,
      }),
    [text, sourceCitations, isStreaming, hasCitationMap, webSources, hasWebSources],
  )

  const mdRenderComponents = useMemo(
    () => {
      const chipClass =
        'overlay-webcite-chip mx-0.5 inline-flex max-w-full cursor-pointer items-baseline rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 align-baseline text-[11px] font-normal leading-none text-[var(--muted)] no-underline! transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]'

      const renderChip = (href: string, label: string, tooltipSources: WebSourceItem[]) => (
        <WebSourceTooltip sources={tooltipSources}>
          <a href={href} target="_blank" rel="noopener noreferrer" className={chipClass}>
            {label}
          </a>
        </WebSourceTooltip>
      )

      return {
        ...baseMdComponents,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        a(props: any) {
          const href = props.href
          const linkText = extractLinkText(props.children as ReactNode).trim()

          // Multi-citation chip: `#overlay-webcite-multi-1-2-3`
          if (typeof href === 'string' && href.startsWith('#overlay-webcite-multi-')) {
            const raw = href.slice('#overlay-webcite-multi-'.length)
            const indices = raw
              .split('-')
              .map((s) => parseInt(s, 10))
              .filter((n) => Number.isFinite(n) && n >= 1 && n <= (webSources?.length ?? 0))
            const picked = indices.map((i) => webSources![i - 1]!).filter(Boolean)
            if (picked.length > 0) {
              // Multi-chip opens the first source on click; tooltip surfaces the rest.
              return renderChip(picked[0]!.url, linkText || webSourceDisplayKey(picked[0]!.url), picked)
            }
            return <span className="mx-0.5 text-[11px] text-[var(--muted)] tabular-nums">[{raw}]</span>
          }

          // Single citation chip: `#overlay-webcite-N`
          if (typeof href === 'string' && href.startsWith('#overlay-webcite-')) {
            const raw = href.slice('#overlay-webcite-'.length)
            const n = parseInt(raw, 10)
            const src = webSources?.[n - 1]
            if (src) {
              return renderChip(src.url, linkText || webSourceDisplayKey(src.url), [src])
            }
            return <span className="mx-0.5 text-[11px] text-[var(--muted)] tabular-nums">[{raw}]</span>
          }

          // Generic external URL → also render as chip with a tooltip. Skip Connect-service
          // links (handled by baseMdComponents.a) and internal /app/ / hash / mailto links.
          if (
            typeof href === 'string' &&
            /^https?:\/\//i.test(href) &&
            !/^connect\s+/i.test(linkText)
          ) {
            // Prefer metadata from `webSources` when this URL was one of the collected sources.
            const matched = webSources?.find((s) => s.url === href)
            const fallback: WebSourceItem = matched ?? {
              url: href,
              title: '',
              origin: 'web-search',
            }
            const isTextJustUrl =
              !linkText || linkText === href || /^https?:\/\//i.test(linkText)
            const chipLabel = isTextJustUrl ? webSourceDisplayKey(href) : linkText
            return renderChip(href, chipLabel, [fallback])
          }

          return baseMdComponents.a(props)
        },
      }
    },
    [webSources],
  )
  const { completedBlocks, streamTail } = useMemo(
    () => splitStreamingMarkdown(normalizedDisplay),
    [normalizedDisplay],
  )
  const trailingBlock = !isStreaming && streamTail.trim() ? streamTail.trim() : ''
  const showInlineTypingDots = isStreaming && !suppressTypingIndicator

  if (!normalizedDisplay.trim() && !isStreaming) {
    return null
  }

  return (
    <div className="markdown-content">
      {completedBlocks.map((block, index) => (
        <div key={`md-block-${index}`} className="md-block-appear">
          <ReactMarkdown
            remarkPlugins={markdownRemarkPlugins}
            rehypePlugins={markdownRehypePlugins}
            components={mdRenderComponents}
          >
            {block}
          </ReactMarkdown>
        </div>
      ))}

      {trailingBlock ? (
        <div key={`md-block-${completedBlocks.length}`} className="md-block-appear">
          <ReactMarkdown
            remarkPlugins={markdownRemarkPlugins}
            rehypePlugins={markdownRehypePlugins}
            components={mdRenderComponents}
          >
            {trailingBlock}
          </ReactMarkdown>
        </div>
      ) : null}

      {showInlineTypingDots ? (
        <div className="md-typing-indicator" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      ) : null}
    </div>
  )
}
