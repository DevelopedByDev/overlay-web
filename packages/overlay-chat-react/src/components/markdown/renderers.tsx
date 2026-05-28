import { lazy,Suspense,useState,useSyncExternalStore,type ReactNode } from 'react'

const LazySyntaxHighlighter = lazy(() => import('../LazySyntaxHighlighter'))

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

export function extractLinkText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractLinkText).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    return extractLinkText((node as { props: { children?: ReactNode } }).props.children)
  }
  return ''
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
      <Suspense fallback={<pre className="m-0 overflow-x-auto p-3 text-sm"><code>{children}</code></pre>}>
        <LazySyntaxHighlighter isDark={isDark} language={language}>
          {children}
        </LazySyntaxHighlighter>
      </Suspense>
    </div>
  )
}

// Stable markdown components — defined outside component to avoid re-creation
export const baseMdComponents = {
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

    // `/app/...` handling lives in the component-local `a` override so it can
    // close over `appBaseUrl`; see the specialized renderer in MarkdownMessage.
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
