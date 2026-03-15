'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

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
}

// Find the char position of a safe paragraph boundary in `text`.
// We only split at \n\n that is NOT inside a code fence or a table.
function findParagraphBoundary(text: string): number | null {
  const lines = text.split('\n')
  let inCodeBlock = false
  let inTable = false
  let pos = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
    }

    if (!inCodeBlock) {
      if (line.trimStart().startsWith('|')) {
        inTable = true
      } else if (inTable && line.trim() === '') {
        inTable = false
      }
    }

    // A blank line outside a code block / table = paragraph boundary
    if (line.trim() === '' && !inCodeBlock && !inTable && i > 0) {
      return pos // return start of the blank line (content before it is a complete block)
    }

    pos += line.length + 1 // +1 for the \n
  }

  return null
}

interface Block {
  id: number
  text: string
}

interface Props {
  text: string
  isStreaming: boolean
}

export function MarkdownMessage({ text, isStreaming }: Props) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const nextIdRef = useRef(0)
  // Tracks how many characters of `text` have been committed into blocks
  const releasedRef = useRef(0)

  // Reset state when text is cleared (new conversation / new message starts)
  useEffect(() => {
    if (!text) {
      setBlocks([])
      releasedRef.current = 0
      nextIdRef.current = 0
    }
  }, [text])

  useEffect(() => {
    if (!isStreaming) {
      // Stream finished — flush anything remaining
      const remaining = text.slice(releasedRef.current).trim()
      if (remaining) {
        setBlocks((prev) => [...prev, { id: nextIdRef.current++, text: remaining }])
        releasedRef.current = text.length
      }
      return
    }

    // Find a paragraph boundary in the unprocessed text
    const unprocessed = text.slice(releasedRef.current)
    const boundary = findParagraphBoundary(unprocessed)

    if (boundary !== null && boundary > 0) {
      const blockText = unprocessed.slice(0, boundary).trim()
      if (blockText) {
        setBlocks((prev) => [...prev, { id: nextIdRef.current++, text: blockText }])
      }
      releasedRef.current += boundary + 1 // skip past the blank line
    }
  }, [text, isStreaming])

  const hasBlocks = blocks.length > 0

  return (
    <div className="markdown-content">
      {blocks.map((block) => (
        <div key={block.id} className="md-block-appear">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {block.text}
          </ReactMarkdown>
        </div>
      ))}

      {/* Pulsing dots while streaming and waiting for first paragraph boundary */}
      {isStreaming && !hasBlocks && (
        <div className="md-typing-indicator">
          <span />
          <span />
          <span />
        </div>
      )}

      {/* Once streaming ends, flush any remaining text that never hit a paragraph boundary */}
      {!isStreaming && blocks.length === 0 && text.trim() && (
        <div className="md-block-appear">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {text}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}
