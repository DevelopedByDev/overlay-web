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
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[#525252] transition-colors hover:bg-[#f0f0f0] hover:text-[#0a0a0a]"
        aria-expanded={!collapsed}
      >
        <Puzzle size={13} />
        <span className="flex-1 truncate text-left">Chrome Extension</span>
        <ChevronDown size={11} className={`shrink-0 text-[#aaa] transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      {!collapsed && (
        <div className="mb-1 mt-0.5 space-y-1.5 pl-7 pr-1">
          <p className="text-[11px] leading-4 text-[#888]">
            {installed
              ? `Connected · ${scopeLabel}${version ? ` · v${version}` : ''}`
              : 'Install or enable the extension to pull browser context.'}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void refreshBridge()}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[#525252] transition-colors hover:bg-[#f0f0f0] disabled:opacity-50"
            >
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            {installed && (
              <button
                type="button"
                onClick={() => void insertBrowserContext()}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[#525252] transition-colors hover:bg-[#f0f0f0] disabled:opacity-50"
              >
                <Globe size={10} />
                Add context
              </button>
            )}
          </div>
          {error && <p className="text-[10px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
