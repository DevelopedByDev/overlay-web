'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Globe, Puzzle, RefreshCw } from 'lucide-react'

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

const STORAGE_KEY = 'overlay:chrome-extension-panel-collapsed'

export default function ExtensionBridgePanel() {
  const [installed, setInstalled] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [scopes, setScopes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'false') setCollapsed(false)
    } catch {
      // ignore localStorage failures
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(collapsed))
    } catch {
      // ignore localStorage failures
    }
  }, [collapsed])

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
      setCollapsed(false)
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
    <div className="rounded-lg border border-[#e5e5e5] bg-white">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-[#f7f7f7]"
        aria-expanded={!collapsed}
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#e5e5e5] bg-[#fafafa] text-[#0a0a0a]">
          <Puzzle size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#0a0a0a]">Overlay Chrome</p>
          <p className="mt-0.5 text-[11px] text-[#888]">
            {installed
              ? `Connected · ${scopeLabel}${version ? ` · v${version}` : ''}`
              : 'Install or enable the extension to pull local browser context.'}
          </p>
        </div>
        <ChevronDown size={13} className={`shrink-0 text-[#888] transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      {!collapsed ? (
        <div className="border-t border-[#f0f0f0] px-2.5 py-2.5">
          <p className="text-[11px] leading-5 text-[#666]">
            Use Overlay Chrome to bring your active tab and current window into chat without leaving the app.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshBridge()}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-md border border-[#e5e5e5] px-2.5 py-1.5 text-[11px] text-[#525252] transition-colors hover:bg-[#f5f5f5] hover:text-[#0a0a0a] disabled:opacity-50"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void insertBrowserContext()}
              disabled={!installed || loading}
              className="inline-flex items-center gap-1 rounded-md bg-[#0a0a0a] px-2.5 py-1.5 text-[11px] text-[#fafafa] transition-colors hover:bg-[#222] disabled:opacity-50"
            >
              <Globe size={11} />
              Add browser context
            </button>
          </div>
          {!installed ? (
            <p className="mt-2 text-[10px] leading-4 text-[#888]">
              Load the built extension from `overlay-chrome/dist` in Chrome, then refresh here.
            </p>
          ) : null}
          {error ? <p className="mt-2 text-[10px] leading-4 text-red-500">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
