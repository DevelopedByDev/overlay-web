'use client'

import { type ReactNode, useMemo, useState } from 'react'
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
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

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
  options?: { sourceCitations?: SourceCitationMap; linkifyCitations?: boolean },
): string {
  let t = mergeGfmTableContinuationLines(stripHtmlishToMarkdown(stripThinkingPlaceholderMarkdown(text)))
  t = bracketNormalize(t)
  if (options?.linkifyCitations && options?.sourceCitations && Object.keys(options.sourceCitations).length > 0) {
    t = linkifySourceCitations(t, options.sourceCitations)
  }
  return t
}

const CONNECT_SERVICE_DESCRIPTIONS: Record<string, string> = {
  'gmail': 'Compose, send, and search emails',
  'google calendar': 'Read and create calendar events',
  'google sheets': 'Read, update, and create spreadsheets',
  'google drive': 'Search and manage Drive files',
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
        <button className="code-block-copy" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneLight}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: '0 0 10px 10px',
          background: '#f8f8f8',
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
const mdComponents = {
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
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <span
            className="inline-flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#e5e5e5] bg-white hover:bg-[#f5f5f5] transition-colors my-1.5"
            style={{ minWidth: 260, maxWidth: 360 }}
          >
            <span
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-[#f5f5f5] text-xs font-bold text-[#0a0a0a]"
              style={{ width: 36, height: 36 }}
            >
              {serviceName.charAt(0).toUpperCase()}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-[#0a0a0a] leading-snug">{serviceName}</span>
              <span className="block text-xs text-[#888] leading-snug">{description}</span>
            </span>
            <span className="shrink-0 rounded-md bg-[#0a0a0a] px-3 py-1.5 text-xs whitespace-nowrap text-[#fafafa]">
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
      return <span className="text-[#0a0a0a] whitespace-pre-wrap wrap-break-word">{children}</span>
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

    const blockText = text.slice(offset, offset + boundary).trim()
    if (blockText) completedBlocks.push(blockText)
    offset += boundary + 1
  }

  return { completedBlocks, streamTail: text.slice(offset) }
}

export function MarkdownMessage({ text, isStreaming, sourceCitations, suppressTypingIndicator = false }: Props) {
  const hasCitationMap = !!(sourceCitations && Object.keys(sourceCitations).length > 0)
  const normalizedDisplay = useMemo(
    () =>
      normalizeGeneratedMarkdown(text, {
        sourceCitations,
        linkifyCitations: !isStreaming && hasCitationMap,
      }),
    [text, sourceCitations, isStreaming, hasCitationMap],
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
            components={mdComponents}
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
            components={mdComponents}
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
