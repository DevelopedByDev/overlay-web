'use client'

import { useEffect, useMemo, useState } from 'react'
import { Puzzle, RefreshCw, Globe } from 'lucide-react'

type BridgeResponse =
  | { source: 'overlay-extension'; type: 'overlay.bridge.pong'; timestamp: number }
  | {
      source: 'overlay-extension'
      type: 'overlay.bridge.capabilities'
      capabilities: {
        version: string
        scopes: string[]
      }
    }
  | {
      source: 'overlay-extension'
      type: 'overlay.bridge.browser-context'
      context: {
        pageContext: {
          title: string
          url: string
          selection: string | null
          headings: string[]
          excerpt: string
        } | null
        windowTabs: Array<{
          title: string
          url: string
          active: boolean
        }>
      }
    }
  | { source: 'overlay-extension'; type: 'overlay.bridge.error'; error: string }

function waitForBridgeResponse<T extends BridgeResponse['type']>(
  expectedType: T,
): Promise<Extract<BridgeResponse, { type: T }>> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(new Error('The Chrome extension did not respond.'))
    }, 1500)

    function onMessage(event: MessageEvent<BridgeResponse>) {
      const data = event.data
      if (!data || data.source !== 'overlay-extension') return
      if (data.type === 'overlay.bridge.error') {
        window.clearTimeout(timeout)
        window.removeEventListener('message', onMessage)
        reject(new Error(data.error))
        return
      }
      if (data.type !== expectedType) return
      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      resolve(data as Extract<BridgeResponse, { type: T }>)
    }

    window.addEventListener('message', onMessage)
  })
}

function formatBrowserContext(context: Extract<BridgeResponse, { type: 'overlay.bridge.browser-context' }>['context']) {
  const lines: string[] = ['[Browser context from Overlay Chrome extension]']

  if (context.pageContext) {
    lines.push(`Active page: ${context.pageContext.title}`)
    lines.push(`URL: ${context.pageContext.url}`)
    if (context.pageContext.selection) lines.push(`Selection: ${context.pageContext.selection}`)
    if (context.pageContext.headings.length > 0) {
      lines.push(`Headings: ${context.pageContext.headings.slice(0, 5).join(' • ')}`)
    }
    if (context.pageContext.excerpt) lines.push(`Excerpt: ${context.pageContext.excerpt}`)
  }

  if (context.windowTabs.length > 0) {
    lines.push(
      `Current window tabs:\n${context.windowTabs
        .slice(0, 8)
        .map((tab, index) => `${index + 1}. ${tab.title}${tab.active ? ' (active)' : ''}`)
        .join('\n')}`,
    )
  }

  return lines.join('\n\n')
}

export default function ExtensionBridgePanel() {
  const [installed, setInstalled] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [scopes, setScopes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refreshBridge() {
    setLoading(true)
    setError(null)
    try {
      const responsePromise = waitForBridgeResponse('overlay.bridge.capabilities')
      window.postMessage({ source: 'overlay-web-app', type: 'overlay.bridge.get-capabilities' }, window.location.origin)
      const response = await responsePromise
      setInstalled(true)
      setVersion(response.capabilities.version)
      setScopes(response.capabilities.scopes)
    } catch (bridgeError) {
      setInstalled(false)
      setVersion(null)
      setScopes([])
      setError(bridgeError instanceof Error ? bridgeError.message : 'Extension not available')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshBridge()
  }, [])

  async function insertBrowserContext() {
    setLoading(true)
    setError(null)
    try {
      const responsePromise = waitForBridgeResponse('overlay.bridge.browser-context')
      window.postMessage({ source: 'overlay-web-app', type: 'overlay.bridge.capture-browser-context' }, window.location.origin)
      const response = await responsePromise
      window.dispatchEvent(
        new CustomEvent('overlay:insert-browser-context', {
          detail: { text: formatBrowserContext(response.context) },
        }),
      )
    } catch (bridgeError) {
      setError(bridgeError instanceof Error ? bridgeError.message : 'Failed to capture browser context')
    } finally {
      setLoading(false)
    }
  }

  const scopeLabel = useMemo(() => {
    if (scopes.includes('current-window')) return 'Current window'
    if (scopes.includes('active-tab')) return 'Active tab'
    return 'Unavailable'
  }, [scopes])

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-40 hidden md:block">
      <div className="pointer-events-auto w-72 rounded-2xl border border-[#e5e5e5] bg-white/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#e5e5e5] bg-[#fafafa] text-[#0a0a0a]">
            <Puzzle size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#0a0a0a]">Chrome Extension</p>
            <p className="mt-0.5 text-xs text-[#888]">
              {installed
                ? `Connected · ${scopeLabel}${version ? ` · v${version}` : ''}`
                : 'Install or enable Overlay Chrome to pull local browser context into chat.'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshBridge()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-[#e5e5e5] px-2.5 py-1.5 text-xs text-[#525252] transition-colors hover:bg-[#f5f5f5] hover:text-[#0a0a0a] disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void insertBrowserContext()}
            disabled={!installed || loading}
            className="inline-flex items-center gap-1 rounded-md bg-[#0a0a0a] px-2.5 py-1.5 text-xs text-[#fafafa] transition-colors hover:bg-[#222] disabled:opacity-50"
          >
            <Globe size={12} />
            Insert browser context
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      </div>
    </div>
  )
}
