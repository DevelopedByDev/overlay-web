'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Send, Plus, Trash2, ChevronDown, Loader2, ImageIcon, X, AlertCircle, Check } from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '@/lib/models'
import { MarkdownMessage } from './MarkdownMessage'

interface Chat {
  _id: string
  title: string
  model: string
  lastModified: number
}

interface AttachedImage {
  dataUrl: string
  mimeType: string
  name: string
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

function getMessageImages(msg: { parts?: Array<{ type: string; image?: string }> }): string[] {
  if (!msg.parts) return []
  return msg.parts.filter((p) => p.type === 'image' && p.image).map((p) => p.image!)
}

function shallowBoolArrayEqual(a: boolean[], b: boolean[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
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

// ─── ExchangeBlock (memoized) ─────────────────────────────────────────────
// Each exchange is its own memoized subtree so that only the actively
// streaming exchange re-renders on every token. Historical exchanges stay
// frozen until the user switches their model tab.

interface ExchangeBlockProps {
  userMsgId: string
  userText: string
  userImages: string[]          // stable for historical exchanges
  exchIdx: number
  exchModelList: string[]       // same array reference while models don't change
  tabNames: string[]            // display names, same reference
  tabLoadings: boolean[]        // per-tab loading state
  selectedTab: number
  onTabSelect: (exchIdx: number, tabIdx: number) => void
  responseText: string
  isStreaming: boolean          // currently streaming this response
  showThinking: boolean         // no content yet but loading
  errorMessage: string | null
}

const ExchangeBlock = React.memo(
  function ExchangeBlock({
    userText, userImages, exchIdx, exchModelList, tabNames, tabLoadings,
    selectedTab, onTabSelect, responseText, isStreaming, showThinking, errorMessage,
  }: ExchangeBlockProps) {
    return (
      <div className="flex flex-col gap-2 message-appear">
        {/* User message */}
        <div className="flex justify-end">
          <div className="max-w-[75%] space-y-2">
            {userImages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-end">
                {userImages.map((src, i) => (
                  <img key={i} src={src} alt="attached"
                    className="max-w-[200px] max-h-[200px] rounded-xl object-cover" />
                ))}
              </div>
            )}
            {userText && (
              <div className="rounded-2xl rounded-br-sm bg-[#0a0a0a] px-4 py-2.5 text-sm leading-relaxed text-[#fafafa]">
                <span className="whitespace-pre-wrap">{userText}</span>
              </div>
            )}
          </div>
        </div>

        {/* Per-exchange model tabs — only shown for multi-model exchanges */}
        {exchModelList.length > 1 && (
          <div className="flex items-center gap-1 mt-0.5">
            {exchModelList.map((mId, tabIdx) => {
              const isActive = tabIdx === selectedTab
              const loading = tabLoadings[tabIdx] ?? false
              return (
                <button
                  key={mId}
                  onClick={() => onTabSelect(exchIdx, tabIdx)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
                    isActive ? 'bg-[#0a0a0a] text-[#fafafa]' : 'bg-[#f0f0f0] text-[#525252] hover:bg-[#e8e8e8]'
                  }`}
                >
                  {loading && <Loader2 size={9} className="animate-spin" />}
                  {tabNames[tabIdx] ?? mId}
                </button>
              )
            })}
          </div>
        )}

        {/* Assistant response */}
        {responseText ? (
          <div className="w-full px-1 py-1 text-sm leading-relaxed text-[#0a0a0a]">
            <MarkdownMessage text={responseText} isStreaming={isStreaming} />
          </div>
        ) : showThinking ? (
          <div className="flex items-center gap-2 px-1 py-1 text-xs italic text-[#888]">
            <Loader2 size={12} className="animate-spin" />
            Thinking...
          </div>
        ) : null}

        {errorMessage && !isStreaming && !showThinking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">
              <AlertCircle size={12} />
              {errorMessage}
            </div>
          </div>
        )}
      </div>
    )
  },
  // Custom equality: skip re-render when nothing meaningful changed.
  // This is the key guard that prevents historical exchanges from re-rendering
  // during streaming of a later exchange.
  (prev, next) =>
    prev.userMsgId === next.userMsgId &&
    prev.userText === next.userText &&
    prev.exchIdx === next.exchIdx &&
    prev.selectedTab === next.selectedTab &&
    prev.responseText === next.responseText &&
    prev.isStreaming === next.isStreaming &&
    prev.showThinking === next.showThinking &&
    prev.errorMessage === next.errorMessage &&
    prev.exchModelList === next.exchModelList && // stable reference
    prev.onTabSelect === next.onTabSelect &&      // stable useCallback
    shallowBoolArrayEqual(prev.tabLoadings, next.tabLoadings)
)

// ─── helpers to classify api errors ─────────────────────────────────────────

function errorLabel(err: Error | null | undefined): string | null {
  if (!err) return null
  if (err.message?.includes('weekly_limit')) return 'Weekly limit reached — upgrade to Pro for unlimited messages.'
  if (err.message?.includes('premium_model')) return 'This model requires a Pro subscription.'
  if (err.message?.includes('insufficient_credits')) return 'No credits remaining.'
  return 'Something went wrong. Please try again.'
}

// ─── constants ──────────────────────────────────────────────────────────────

const CHAT_SUGGESTIONS = [
  'Explain how transformers work in machine learning',
  'Write a Python script to rename files in a folder',
  'What are the key differences between REST and GraphQL?',
  'Help me draft a professional email declining a meeting',
]

const CHAT_MODEL_KEY = 'overlay_chat_model'

// ─── main component ──────────────────────────────────────────────────────────

export default function ChatInterface({ userId: _userId }: { userId: string }) {
  void _userId

  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [selectedModels, setSelectedModels] = useState<string[]>([DEFAULT_MODEL_ID])

  useEffect(() => {
    const saved = localStorage.getItem(CHAT_MODEL_KEY)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) setSelectedModels(parsed.slice(0, 4))
    } catch {
      setSelectedModels([saved])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Per-exchange model tracking: index = exchange, value = ordered model IDs used
  const [exchangeModels, setExchangeModels] = useState<string[][]>([])
  // Per-exchange selected tab: which model tab is active for each exchange
  const [selectedTabPerExchange, setSelectedTabPerExchange] = useState<number[]>([])

  const [showModelPicker, setShowModelPicker] = useState(false)
  const [input, setInput] = useState('')
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const shouldScrollRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelPickerRef = useRef<HTMLDivElement>(null)
  // Track whether we were streaming so subscription refresh only fires on transition
  const wasStreamingRef = useRef(false)

  // ── 4 fixed chat instances ────────────────────────────────────────────────
  const transport0 = useMemo(() => new DefaultChatTransport({ api: '/api/app/chat' }), [])
  const transport1 = useMemo(() => new DefaultChatTransport({ api: '/api/app/chat' }), [])
  const transport2 = useMemo(() => new DefaultChatTransport({ api: '/api/app/chat' }), [])
  const transport3 = useMemo(() => new DefaultChatTransport({ api: '/api/app/chat' }), [])

  const chat0 = useChat({ transport: transport0 })
  const chat1 = useChat({ transport: transport1 })
  const chat2 = useChat({ transport: transport2 })
  const chat3 = useChat({ transport: transport3 })

  const chatInstances = useMemo(() => [chat0, chat1, chat2, chat3], [chat0, chat1, chat2, chat3])

  // Map from modelId → slot index
  const modelSlotMap = useMemo(() => {
    const map = new Map<string, number>()
    selectedModels.forEach((id, i) => map.set(id, i))
    return map
  }, [selectedModels])

  // Derived flags
  const isAnyLoading = chatInstances
    .slice(0, selectedModels.length)
    .some((c) => c.status === 'streaming' || c.status === 'submitted')

  const supportsVision = selectedModels.every(
    (id) => AVAILABLE_MODELS.find((m) => m.id === id)?.supportsVision ?? false
  )

  // Subscription state
  const isFreeTier = entitlements?.tier === 'free'
  const weeklyUsed = isFreeTier
    ? (entitlements?.dailyUsage.ask ?? 0) + (entitlements?.dailyUsage.write ?? 0) + (entitlements?.dailyUsage.agent ?? 0)
    : 0
  const weeklyLimitReached = isFreeTier && weeklyUsed >= 15
  const premiumModelBlocked =
    isFreeTier &&
    selectedModels.some((id) => AVAILABLE_MODELS.find((m) => m.id === id)?.provider !== 'openrouter')
  const creditsExhausted =
    !isFreeTier &&
    entitlements != null &&
    entitlements.creditsTotal > 0 &&
    entitlements.creditsUsed >= entitlements.creditsTotal * 100
  const isSendBlocked = weeklyLimitReached || premiumModelBlocked || creditsExhausted

  // ── data loading ──────────────────────────────────────────────────────────

  const loadSubscription = useCallback(async () => {
    try {
      const res = await fetch('/api/app/subscription')
      if (res.ok) setEntitlements(await res.json())
    } catch { /* ignore */ }
  }, [])

  const loadChats = useCallback(async () => {
    try {
      const res = await fetch('/api/app/chats')
      if (res.ok) setChats(await res.json())
    } catch { /* ignore */ }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadChats(); loadSubscription() }, [loadChats, loadSubscription])

  // Refresh subscription only when streaming transitions to complete (not on every status change)
  useEffect(() => {
    const isStreaming = chatInstances.some((c) => c.status === 'streaming' || c.status === 'submitted')
    if (wasStreamingRef.current && !isStreaming && chat0.messages.length > 0) {
      loadSubscription()
    }
    wasStreamingRef.current = isStreaming
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat0.status, chat1.status, chat2.status, chat3.status])

  // Scroll to bottom when user sends a message
  useEffect(() => {
    if (shouldScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      shouldScrollRef.current = false
    }
  }, [chat0.messages])

  // Close model picker on outside click
  useEffect(() => {
    if (!showModelPicker) return
    function handleOutside(e: MouseEvent) {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node))
        setShowModelPicker(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showModelPicker])

  // ── helpers ───────────────────────────────────────────────────────────────

  // Returns the assistant message from a given slot for exchange exchIdx, or null
  function getResponseForExchange(slotIdx: number, exchIdx: number) {
    const msgs = chatInstances[slotIdx].messages
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

  // ── stable callbacks ──────────────────────────────────────────────────────

  const handleTabSelect = useCallback((exchIdx: number, tabIdx: number) => {
    setSelectedTabPerExchange((prev) => {
      const next = [...prev]
      next[exchIdx] = tabIdx
      return next
    })
  }, [])

  // ── chat management ───────────────────────────────────────────────────────

  async function createNewChat(): Promise<string | null> {
    const res = await fetch('/api/app/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModels[0] }),
    })
    if (res.ok) {
      const data = await res.json()
      setActiveChatId(data.id)
      setIsFirstMessage(true)
      setExchangeModels([])
      setSelectedTabPerExchange([])
      chatInstances.forEach((c) => c.setMessages([]))
      await loadChats()
      return data.id
    }
    return null
  }

  async function loadChat(chatId: string) {
    setActiveChatId(chatId)
    setIsFirstMessage(false)
    setExchangeModels([])
    setSelectedTabPerExchange([])
    chatInstances.forEach((c) => c.setMessages([]))
    try {
      const res = await fetch(`/api/app/chats?chatId=${chatId}&messages=true`)
      if (!res.ok) return
      const data = await res.json()
      type RawMsg = { id: string; role: 'user' | 'assistant'; parts: Array<{ type: string; text?: string }>; model?: string }
      const rawMessages: RawMsg[] = data.messages || []

      // Group into exchanges
      const exchanges: Array<{ userMsg: RawMsg; responses: Array<{ model: string; msg: RawMsg }> }> = []
      let cur: (typeof exchanges)[0] | null = null
      for (const msg of rawMessages) {
        if (msg.role === 'user') {
          if (cur) exchanges.push(cur)
          cur = { userMsg: msg, responses: [] }
        } else if (msg.role === 'assistant' && cur) {
          cur.responses.push({ model: msg.model || DEFAULT_MODEL_ID, msg })
        }
      }
      if (cur) exchanges.push(cur)

      // Collect unique models in order of first appearance
      const uniqueModels: string[] = []
      for (const ex of exchanges) {
        for (const { model } of ex.responses) {
          if (!uniqueModels.includes(model)) uniqueModels.push(model)
        }
      }

      if (uniqueModels.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chat0.setMessages(rawMessages as any)
        return
      }

      const slotModels = uniqueModels.slice(0, 4)
      setSelectedModels(slotModels)
      localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(slotModels))

      slotModels.forEach((modelId, slotIdx) => {
        const msgs: RawMsg[] = []
        for (const ex of exchanges) {
          msgs.push(ex.userMsg)
          const r = ex.responses.find((r) => r.model === modelId)
          if (r) msgs.push(r.msg)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chatInstances[slotIdx].setMessages(msgs as any)
      })

      setExchangeModels(exchanges.map((ex) => ex.responses.map((r) => r.model)))
      setSelectedTabPerExchange(exchanges.map(() => 0))
    } catch { /* already cleared */ }
  }

  async function deleteChat(chatId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/app/chats?chatId=${chatId}`, { method: 'DELETE' })
    if (activeChatId === chatId) {
      setActiveChatId(null)
      setExchangeModels([])
      setSelectedTabPerExchange([])
      chatInstances.forEach((c) => c.setMessages([]))
    }
    await loadChats()
  }

  function addImages(files: FileList | File[]) {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
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

  async function handleSend() {
    const text = input.trim()
    if ((!text && attachedImages.length === 0) || isAnyLoading || isSendBlocked) return

    const chatId = activeChatId || await createNewChat()
    if (!chatId) return

    const wasFirst = isFirstMessage
    setInput('')
    setAttachedImages([])
    setIsFirstMessage(false)
    shouldScrollRef.current = true
    setExchangeModels((prev) => [...prev, [...selectedModels]])
    setSelectedTabPerExchange((prev) => [...prev, 0])

    const parts: Array<{ type: string; text?: string; image?: string; mediaType?: string }> = []
    if (text) parts.push({ type: 'text', text })
    for (const img of attachedImages) {
      parts.push({ type: 'image', image: img.dataUrl, mediaType: img.mimeType })
    }

    // Kick off title generation immediately — don't block on model responses.
    // Falls back to a truncation of the user's text if the API is unavailable.
    if (wasFirst && text) {
      // Optimistic update so the sidebar shows something right away
      const optimisticTitle = text.slice(0, 50)
      setChats((prev) =>
        prev.map((c) => (c._id === chatId ? { ...c, title: optimisticTitle } : c))
      )
      generateTitle(text).then((aiTitle) => {
        const title = aiTitle || optimisticTitle
        fetch('/api/app/chats', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, title }),
        })
          .then(() => loadChats())
          .catch(() => {
            // Keep the optimistic title — the sidebar already shows it
          })
      })
    }

    // Send to all selected models. Only the primary (idx 0) persists the user message.
    void Promise.all(
      selectedModels.map((modelId, idx) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chatInstances[idx].sendMessage({ role: 'user', parts: parts as any }, {
          body: { modelId, chatId, skipUserMessage: idx !== 0 },
        })
      )
    ).then(() => loadChats())
  }

  function toggleModel(modelId: string) {
    if (isAnyLoading) return
    const isSelected = selectedModels.includes(modelId)
    if (isSelected) {
      if (selectedModels.length === 1) return
      const newModels = selectedModels.filter((id) => id !== modelId)
      setSelectedModels(newModels)
      localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(newModels))
    } else {
      if (selectedModels.length >= 4) return
      const newIdx = selectedModels.length
      chatInstances[newIdx].setMessages(chatInstances[0].messages)
      const newModels = [...selectedModels, modelId]
      setSelectedModels(newModels)
      localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(newModels))
    }
  }

  function stopAll() {
    chatInstances.slice(0, selectedModels.length).forEach((c) => c.stop())
  }

  // ── model display names (stable for same selectedModels) ──────────────────
  const modelNames = useMemo(
    () => selectedModels.map((id) => AVAILABLE_MODELS.find((m) => m.id === id)?.name ?? id),
    [selectedModels]
  )

  const activeChat = chats.find((c) => c._id === activeChatId)
  const modelPickerLabel = selectedModels.length === 1 ? modelNames[0] : `${selectedModels.length} models`
  const primaryMessages = chat0.messages
  const hasMessages = primaryMessages.some((m) => m.role === 'user')
  const latestExchIdx = exchangeModels.length - 1

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-52 h-full flex flex-col border-r border-[#e5e5e5] bg-[#f5f5f5]">
        <div className="flex h-16 items-center border-b border-[#e5e5e5] px-3">
          <button
            onClick={createNewChat}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-md text-sm bg-[#0a0a0a] text-[#fafafa] hover:bg-[#222] transition-colors"
          >
            <Plus size={13} />
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {chats.map((chat) => (
            <div
              key={chat._id}
              onClick={() => loadChat(chat._id)}
              className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${
                activeChatId === chat._id
                  ? 'bg-[#e8e8e8] text-[#0a0a0a]'
                  : 'text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
              }`}
            >
              <span className="truncate">{chat.title}</span>
              <button
                onClick={(e) => deleteChat(chat._id, e)}
                className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#e5e5e5] px-4">
          <h2 className="text-sm font-medium text-[#0a0a0a] truncate max-w-[60%]">
            {activeChat?.title || 'New conversation'}
          </h2>

          {/* Model picker */}
          <div ref={modelPickerRef} className="relative">
            <button
              onClick={() => !isAnyLoading && setShowModelPicker((v) => !v)}
              disabled={isAnyLoading}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-[#f0f0f0] transition-colors ${
                isAnyLoading ? 'text-[#aaa] cursor-not-allowed' : 'text-[#525252] hover:bg-[#e8e8e8]'
              }`}
            >
              {modelPickerLabel}
              <ChevronDown size={11} />
            </button>
            {showModelPicker && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-[#e5e5e5] rounded-lg shadow-lg z-10 py-1 max-h-72 overflow-y-auto">
                {AVAILABLE_MODELS.map((m) => {
                  const isSelected = selectedModels.includes(m.id)
                  const isDisabled = !isSelected && selectedModels.length >= 4
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleModel(m.id)}
                      disabled={isDisabled}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                        isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#f5f5f5]'
                      } ${isSelected ? 'text-[#0a0a0a] font-medium' : 'text-[#525252]'}`}
                    >
                      <span className="flex items-center gap-2">
                        {isSelected ? <Check size={10} /> : <span className="w-[10px] inline-block" />}
                        {m.name}
                      </span>
                      <span className="text-[#aaa] ml-2">{m.provider}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6">
            {!hasMessages && (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center max-w-xl">
                  <p className="text-3xl mb-3" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
                    chat
                  </p>
                  <p className="text-sm text-[#888] mb-6">Start a conversation with any AI model</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-[#525252]">
                    {CHAT_SUGGESTIONS.map((prompt) => (
                      <button
                        key={prompt}
                        className="text-left p-2.5 rounded-lg border border-[#e5e5e5] hover:bg-[#f5f5f5] transition-colors"
                        onClick={() => setInput(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Render one ExchangeBlock per user message in the primary stream */}
            {(() => {
              const blocks: React.ReactNode[] = []
              let exchIdx = 0

              for (const msg of primaryMessages) {
                if (msg.role !== 'user') continue
                const curExchIdx = exchIdx++
                const exchModelList = exchangeModels[curExchIdx] ?? []
                const selectedTab = selectedTabPerExchange[curExchIdx] ?? 0
                const selectedModelId = exchModelList[selectedTab] ?? selectedModels[0]
                const slotIdx = modelSlotMap.get(selectedModelId) ?? 0
                const isLatest = curExchIdx === latestExchIdx
                const slotInst = chatInstances[slotIdx]

                // Pre-compute response text so ExchangeBlock gets a primitive
                const responseMsg = getResponseForExchange(slotIdx, curExchIdx)
                const responseText = responseMsg ? getMessageText(responseMsg) : ''

                const instLoading = isLatest && (slotInst.status === 'streaming' || slotInst.status === 'submitted')
                const isStreaming = instLoading && responseText.length > 0
                const showThinking = instLoading && responseText.length === 0

                // Per-tab loading state (only meaningful for latest exchange)
                const tabLoadings: boolean[] = exchModelList.map((mId) => {
                  if (!isLatest) return false
                  const mSlot = modelSlotMap.get(mId) ?? 0
                  const mInst = chatInstances[mSlot]
                  const mLoading = mInst.status === 'streaming' || mInst.status === 'submitted'
                  const mResponse = getResponseForExchange(mSlot, curExchIdx)
                  return mLoading && !mResponse
                })

                // Tab display names: derived from exchModelList + modelNames map
                const tabNames: string[] = exchModelList.map(
                  (mId) => AVAILABLE_MODELS.find((m) => m.id === mId)?.name ?? mId
                )

                const instError = isLatest ? slotInst.error : null

                blocks.push(
                  <ExchangeBlock
                    key={msg.id}
                    userMsgId={msg.id}
                    userText={getMessageText(msg)}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    userImages={getMessageImages(msg as any)}
                    exchIdx={curExchIdx}
                    exchModelList={exchModelList}
                    tabNames={tabNames}
                    tabLoadings={tabLoadings}
                    selectedTab={selectedTab}
                    onTabSelect={handleTabSelect}
                    responseText={responseText}
                    isStreaming={isStreaming}
                    showThinking={showThinking}
                    errorMessage={errorLabel(instError)}
                  />
                )
              }

              return blocks
            })()}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="px-4 pb-4">
          {attachedImages.length > 0 && (
            <div className="mx-auto w-full max-w-4xl mb-2 flex flex-wrap gap-2">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative group">
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
            </div>
          )}

          <div className="mx-auto w-full max-w-4xl">
            {isSendBlocked && !isAnyLoading ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#fafafa] border border-[#e5e5e5] text-xs text-[#888]">
                <AlertCircle size={13} className="text-amber-500 shrink-0" />
                {weeklyLimitReached
                  ? 'Weekly limit reached. Upgrade to Pro for unlimited messages.'
                  : premiumModelBlocked
                  ? 'This model requires Pro. Switch to a free model or upgrade.'
                  : 'No credits remaining. Please top up your account.'}
              </div>
            ) : (
              <div className="flex items-end gap-2 bg-[#f0f0f0] rounded-2xl px-4 py-3">
                {supportsVision && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && addImages(e.target.files)}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 p-1 text-[#aaa] hover:text-[#525252] transition-colors"
                      title="Attach image"
                    >
                      <ImageIcon size={15} />
                    </button>
                  </>
                )}
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Message..."
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  className="flex-1 bg-transparent text-sm text-[#0a0a0a] placeholder-[#aaa] resize-none outline-none max-h-32"
                />
                {isAnyLoading ? (
                  <button
                    onClick={stopAll}
                    className="shrink-0 p-1.5 rounded-lg bg-[#0a0a0a] text-[#fafafa] hover:bg-[#333] transition-colors"
                    title="Stop generating"
                  >
                    <div className="w-3.5 h-3.5 bg-[#fafafa] rounded-sm" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() && attachedImages.length === 0}
                    className="shrink-0 p-1.5 rounded-lg bg-[#0a0a0a] text-[#fafafa] disabled:opacity-40 hover:bg-[#333] transition-colors"
                  >
                    <Send size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
