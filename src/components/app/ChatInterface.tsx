'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Send, Plus, Trash2, ChevronDown, Loader2, ImageIcon, FileText, X, AlertCircle, Check, FolderOpen, Video, Download } from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useSearchParams } from 'next/navigation'
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID, IMAGE_MODELS, VIDEO_MODELS, DEFAULT_IMAGE_MODEL_ID, DEFAULT_VIDEO_MODEL_ID, type GenerationMode } from '@/lib/models'
import { GenerationModeToggle } from './GenerationModeToggle'
import { dispatchChatTitleUpdated, sanitizeChatTitle } from '@/lib/chat-title'
import { useAsyncSessions } from '@/lib/async-sessions-store'
import { useNavigationProgress } from '@/lib/navigation-progress'
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

interface ChatOutput {
  _id: string
  type: 'image' | 'video'
  status: 'pending' | 'completed' | 'failed'
  prompt: string
  modelId: string
  url?: string
  createdAt: number
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

function getMessageImages(msg: { parts?: Array<{ type: string; url?: string; mediaType?: string }> }): string[] {
  if (!msg.parts) return []
  return msg.parts
    .filter((p) => p.type === 'file' && p.url && (p.mediaType?.startsWith('image/') ?? true))
    .map((p) => p.url!)
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

// ─── ExchangeBlock (memoized) ────────────────────────────────────────────────
// Model tab buttons live in the sticky header, NOT here.
// This component only renders: user message + assistant response + error.

interface ExchangeBlockProps {
  userMsgId: string
  userText: string
  userImages: string[]
  exchIdx: number
  slotIdx: number
  responseText: string
  isStreaming: boolean
  showThinking: boolean
  errorMessage: string | null
}

const ExchangeBlock = React.memo(
  function ExchangeBlock({
    userText, userImages, exchIdx, slotIdx, responseText, isStreaming, showThinking, errorMessage,
  }: ExchangeBlockProps) {
    return (
      <div className="flex flex-col gap-2 message-appear" data-exchange-idx={exchIdx}>
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

        {/* Assistant response */}
        {responseText ? (
          <div className="w-full px-1 py-1 text-sm leading-relaxed text-[#0a0a0a]">
            <MarkdownMessage key={slotIdx} text={responseText} isStreaming={isStreaming} />
          </div>
        ) : showThinking ? (
          <div className="px-1 py-2">
            <div className="w-5 h-5 rounded-full border-2 border-[#e0e0e0] border-t-[#525252] animate-spin" />
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
  (prev, next) =>
    prev.userMsgId === next.userMsgId &&
    prev.userText === next.userText &&
    prev.userImages.length === next.userImages.length &&
    prev.userImages.every((image, index) => image === next.userImages[index]) &&
    prev.exchIdx === next.exchIdx &&
    prev.slotIdx === next.slotIdx &&
    prev.responseText === next.responseText &&
    prev.isStreaming === next.isStreaming &&
    prev.showThinking === next.showThinking &&
    prev.errorMessage === next.errorMessage
)

// ─── error label ─────────────────────────────────────────────────────────────

function errorLabel(err: Error | null | undefined): string | null {
  if (!err) return null
  if (err.message?.includes('weekly_limit')) return 'Weekly limit reached — upgrade to Pro for unlimited messages.'
  if (err.message?.includes('premium_model')) return 'This model requires a Pro subscription.'
  if (err.message?.includes('insufficient_credits')) return 'No credits remaining.'
  if (err.message?.includes('supported image formats') || err.message?.includes('does not represent a valid image')) {
    return 'Unsupported image format. Use JPEG, PNG, GIF, or WebP.'
  }
  return 'Something went wrong. Please try again.'
}

// ─── constants ───────────────────────────────────────────────────────────────

const CHAT_SUGGESTIONS = [
  'Explain how transformers work in machine learning',
  'Write a Python script to rename files in a folder',
  'What are the key differences between REST and GraphQL?',
  'Help me draft a professional email declining a meeting',
]

const DEFAULT_CHAT_TITLE = 'New Chat'
const CHAT_MODEL_KEY = 'overlay_chat_model'
const CHAT_GEN_MODE_KEY = 'overlay_chat_generation_mode'
const SUPPORTED_INPUT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

interface GenerationResult {
  type: 'image' | 'video'
  status: 'generating' | 'completed' | 'failed'
  url?: string
  modelUsed?: string
  outputId?: string
  error?: string
}

interface RestoredOutputGroup {
  type: 'image' | 'video'
  prompt: string
  modelIds: string[]
  results: GenerationResult[]
  createdAt: number
}

function groupOutputsIntoExchanges(outputs: ChatOutput[]): RestoredOutputGroup[] {
  const sorted = outputs.slice().sort((a, b) => a.createdAt - b.createdAt)
  const groups: RestoredOutputGroup[] = []

  for (const output of sorted) {
    const prev = groups[groups.length - 1]
    const shouldMerge =
      prev &&
      prev.prompt === output.prompt &&
      prev.type === output.type &&
      Math.abs(output.createdAt - prev.createdAt) < 60_000

    const result: GenerationResult = {
      type: output.type,
      status:
        output.status === 'pending'
          ? 'generating'
          : output.status === 'completed'
          ? 'completed'
          : 'failed',
      url: output.url,
      modelUsed: output.modelId,
      outputId: output._id,
      error: output.status === 'failed' ? 'Generation failed' : undefined,
    }

    if (shouldMerge) {
      prev.modelIds.push(output.modelId)
      prev.results.push(result)
      continue
    }

    groups.push({
      type: output.type,
      prompt: output.prompt,
      modelIds: [output.modelId],
      results: [result],
      createdAt: output.createdAt,
    })
  }

  return groups
}

function buildMediaSummary(type: 'image' | 'video', prompt: string, modelIds: string[], completedCount: number, failedCount: number): string {
  const noun = type === 'image' ? (completedCount === 1 ? 'image' : 'images') : (completedCount === 1 ? 'video' : 'videos')
  const modelList = modelIds.join(', ')
  const failureSuffix = failedCount > 0 ? ` ${failedCount} generation${failedCount === 1 ? '' : 's'} failed.` : ''
  return `Generated ${completedCount} ${noun} for the prompt "${prompt}" using ${modelList}.${failureSuffix}`
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ChatInterface({ userId: _userId, hideSidebar, projectName }: { userId: string; hideSidebar?: boolean; projectName?: string }) {
  void _userId
  const searchParams = useSearchParams()
  const { startSession, completeSession, markRead, setActiveViewer, getUnread, sessions } = useAsyncSessions()
  const { begin, done } = useNavigationProgress()
  const activeChatIdRef = useRef<string | null>(null)
  const loadChatRequestRef = useRef(0)

  // Clear active viewer + ref when this tab unmounts so any in-flight .then() sees isActive=false
  useEffect(() => {
    return () => {
      activeChatIdRef.current = null
      setActiveViewer('chat', null)
    }
  }, [setActiveViewer])

  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [selectedModels, setSelectedModels] = useState<string[]>([DEFAULT_MODEL_ID])
  const [isSwitchingChat, setIsSwitchingChat] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(CHAT_MODEL_KEY)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) setSelectedModels(parsed.slice(0, 4))
    } catch {
      setSelectedModels([saved])
    }
    const savedMode = localStorage.getItem(CHAT_GEN_MODE_KEY) as GenerationMode | null
    if (savedMode && ['text', 'image', 'video'].includes(savedMode)) setGenerationMode(savedMode)
  }, [])

  const [exchangeModels, setExchangeModels] = useState<string[][]>([])
  const [selectedTabPerExchange, setSelectedTabPerExchange] = useState<number[]>([])
  // Which exchange the user is currently scrolled to (drives the sticky header tabs)
  const [visibleExchangeIdx, setVisibleExchangeIdx] = useState(0)

  // Tracks the title of the active chat independently of the sidebar `chats` list.
  // Needed for project chats which are excluded from the global chats:list query.
  const [activeChatTitle, setActiveChatTitle] = useState<string | null>(null)

  const [generationMode, setGenerationMode] = useState<GenerationMode>('text')
  const [generationChip, setGenerationChip] = useState<'image' | 'video' | null>(null)
  const [generationResults, setGenerationResults] = useState<Map<number, GenerationResult[]>>(new Map())
  const [exchangeGenTypes, setExchangeGenTypes] = useState<('text' | 'image' | 'video')[]>([])
  const [selectedImageModels, setSelectedImageModels] = useState<string[]>([DEFAULT_IMAGE_MODEL_ID])
  const [selectedVideoModels, setSelectedVideoModels] = useState<string[]>([DEFAULT_VIDEO_MODEL_ID])
  const lastGeneratedImageUrlRef = useRef<string | null>(null)

  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)
  const [input, setInput] = useState('')
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const shouldScrollRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modelPickerRef = useRef<HTMLDivElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const wasStreamingRef = useRef(false)
  // Stores the pending title so loadChats() never overwrites it before the PATCH lands
  const pendingTitleRef = useRef<{ chatId: string; title: string } | null>(null)

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

  const modelSlotMap = useMemo(() => {
    const map = new Map<string, number>()
    selectedModels.forEach((id, i) => map.set(id, i))
    return map
  }, [selectedModels])

  const isAnyLoading = chatInstances
    .slice(0, selectedModels.length)
    .some((c) => c.status === 'streaming' || c.status === 'submitted')

  const supportsVision = selectedModels.every(
    (id) => AVAILABLE_MODELS.find((m) => m.id === id)?.supportsVision ?? false
  )

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

  // Snapshot pendingTitleRef before the async fetch so a concurrent PATCH completing mid-flight
  // can't clear the ref before we've applied the override to the incoming server chats.
  const loadChats = useCallback(async () => {
    try {
      const pending = pendingTitleRef.current
      const res = await fetch('/api/app/chats')
      if (res.ok) {
        const serverChats: Chat[] = await res.json()
        setChats(
          pending
            ? serverChats.map((c) => (c._id === pending.chatId ? { ...c, title: pending.title } : c))
            : serverChats
        )
        // Clear the ref once the server has confirmed the title
        if (pending && serverChats.some((c) => c._id === pending.chatId && c.title === pending.title)) {
          if (pendingTitleRef.current?.chatId === pending.chatId) pendingTitleRef.current = null
        }
      }
    } catch { /* ignore */ }
  }, [])

  // Update title in local state + pendingTitleRef immediately, then broadcast.
  const applyChatTitleUpdate = useCallback((chatId: string, title: string) => {
    const nextTitle = sanitizeChatTitle(title, DEFAULT_CHAT_TITLE)
    pendingTitleRef.current = { chatId, title: nextTitle }
    setChats((prev) => {
      const exists = prev.some((c) => c._id === chatId)
      if (!exists) {
        // Chat not yet in local state (edge case: generateTitle resolved before createNewChat state settled)
        return [{ _id: chatId, title: nextTitle, model: DEFAULT_MODEL_ID, lastModified: Date.now() }, ...prev]
      }
      return prev.map((c) => (c._id === chatId ? { ...c, title: nextTitle } : c))
    })
    setActiveChatTitle((prev) => prev !== null ? nextTitle : prev)
    dispatchChatTitleUpdated({ chatId, title: nextTitle })
    return nextTitle
  }, [])

  // Called on the first message of a new chat. Immediately shows a fallback title,
  // then replaces it with the GPT OSS 20B-generated title once it arrives.
  const startFirstMessageRename = useCallback((chatId: string, text: string) => {
    const fallbackTitle = applyChatTitleUpdate(chatId, text)

    void generateTitle(text).then(async (aiTitle) => {
      const finalTitle = applyChatTitleUpdate(chatId, aiTitle || fallbackTitle)
      try {
        const res = await fetch('/api/app/chats', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, title: finalTitle }),
        })
        if (res.ok) void loadChats()
      } catch { /* keep local title */ }
    })
  }, [applyChatTitleUpdate, loadChats])

  useEffect(() => { loadChats(); loadSubscription() }, [loadChats, loadSubscription])

  // Auto-load a specific chat when embedded in project view
  const idParam = hideSidebar ? searchParams.get('id') : null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (idParam) void loadChat(idParam) }, [idParam])

  useEffect(() => {
    const isStreaming = chatInstances.some((c) => c.status === 'streaming' || c.status === 'submitted')
    if (wasStreamingRef.current && !isStreaming && chat0.messages.length > 0) {
      loadSubscription()
    }
    wasStreamingRef.current = isStreaming
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat0.status, chat1.status, chat2.status, chat3.status])

  useEffect(() => {
    if (shouldScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      shouldScrollRef.current = false
    }
  }, [chat0.messages])

  useEffect(() => {
    if (!showModelPicker) return
    function handleOutside(e: MouseEvent) {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node))
        setShowModelPicker(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showModelPicker])

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
    const el = textareaRef.current
    if (!el) return
    const maxHeight = 160
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [input])

  // ── scroll tracking — which exchange is currently in view ─────────────────

  function handleMessagesScroll() {
    const container = messagesScrollRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    // Use the 40% mark so the exchange is considered "visible" when its top half is in view
    const threshold = containerRect.top + containerRect.height * 0.4
    const exchEls = container.querySelectorAll<HTMLElement>('[data-exchange-idx]')
    let newIdx = 0
    for (const el of exchEls) {
      if (el.getBoundingClientRect().top <= threshold) {
        newIdx = parseInt(el.getAttribute('data-exchange-idx') || '0', 10)
      }
    }
    setVisibleExchangeIdx(newIdx)
  }

  // ── response lookup ────────────────────────────────────────────────────────

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

  // ── stable callbacks ───────────────────────────────────────────────────────

  const handleTabSelect = useCallback((exchIdx: number, tabIdx: number) => {
    setSelectedTabPerExchange((prev) => {
      const next = [...prev]
      next[exchIdx] = tabIdx
      return next
    })
  }, [])

  // ── chat management ────────────────────────────────────────────────────────

  function resetChatState() {
    setExchangeModels([])
    setSelectedTabPerExchange([])
    setVisibleExchangeIdx(0)
    setGenerationResults(new Map())
    setExchangeGenTypes([])
    lastGeneratedImageUrlRef.current = null
    setSelectedImageModels([DEFAULT_IMAGE_MODEL_ID])
    setSelectedVideoModels([DEFAULT_VIDEO_MODEL_ID])
    chatInstances.forEach((c) => c.setMessages([]))
  }

  async function createNewChat(): Promise<string | null> {
    const res = await fetch('/api/app/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModels[0] }),
    })
    if (res.ok) {
      const data = await res.json()
      // Add directly to state — no loadChats() here so there's no race with pendingTitleRef
      const newChat: Chat = { _id: data.id, title: DEFAULT_CHAT_TITLE, model: selectedModels[0], lastModified: Date.now() }
      setChats((prev) => [newChat, ...prev])
      activeChatIdRef.current = data.id
      setActiveViewer('chat', data.id)
      setActiveChatId(data.id)
      setActiveChatTitle(DEFAULT_CHAT_TITLE)
      setIsFirstMessage(true)
      resetChatState()
      return data.id
    }
    return null
  }

  async function loadChat(chatId: string) {
    const requestId = ++loadChatRequestRef.current
    const progressToken = begin('secondary')
    markRead(chatId)
    activeChatIdRef.current = chatId
    setActiveViewer('chat', chatId)
    setActiveChatId(chatId)
    const existingChat = chats.find((chat) => chat._id === chatId)
    if (existingChat) {
      setActiveChatTitle(existingChat.title)
      setIsFirstMessage(existingChat.title === DEFAULT_CHAT_TITLE)
    } else {
      setActiveChatTitle(null)
    }
    pendingTitleRef.current = null
    setIsSwitchingChat(true)
    try {
      const [messagesRes, outputsRes] = await Promise.all([
        fetch(`/api/app/chats?chatId=${chatId}&messages=true`),
        fetch(`/api/app/outputs?chatId=${chatId}`),
      ])
      if (requestId !== loadChatRequestRef.current) return
      if (!messagesRes.ok) return
      const data = await messagesRes.json()
      type RawMsg = { id: string; role: 'user' | 'assistant'; parts: Array<{ type: string; text?: string; url?: string; mediaType?: string }>; model?: string }
      let rawMessages: RawMsg[] = data.messages || []

      const outputs: ChatOutput[] = outputsRes.ok ? await outputsRes.json() : []
      const outputGroups = groupOutputsIntoExchanges(outputs)

      if (rawMessages.length === 0 && outputGroups.length > 0) {
        rawMessages = outputGroups.map((group, idx) => ({
          id: `restored-output-${idx}`,
          role: 'user',
          parts: [{ type: 'text', text: group.prompt }],
        }))
      }

      setIsFirstMessage(!rawMessages.some((msg) => msg.role === 'user'))

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

      const uniqueModels: string[] = []
      for (const ex of exchanges) {
        for (const { model } of ex.responses) {
          if (!uniqueModels.includes(model)) uniqueModels.push(model)
        }
      }

      resetChatState()

      if (uniqueModels.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chat0.setMessages(rawMessages as any)
      } else {
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
      }

      const restoredGenTypes: ('text' | 'image' | 'video')[] = exchanges.map(() => 'text')
      const restoredResults = new Map<number, GenerationResult[]>()
      const restoredExchangeModels = exchanges.map((ex) => ex.responses.map((r) => r.model))

      let nextOutputGroupIdx = 0
      for (let idx = 0; idx < exchanges.length; idx++) {
        const userPrompt = getMessageText(exchanges[idx].userMsg).trim()
        const matchIdx = outputGroups.findIndex((group, groupIdx) => (
          groupIdx >= nextOutputGroupIdx && group.prompt.trim() === userPrompt
        ))
        if (matchIdx === -1) continue

        const group = outputGroups[matchIdx]
        nextOutputGroupIdx = matchIdx + 1
        restoredGenTypes[idx] = group.type
        restoredResults.set(idx, group.results)
        restoredExchangeModels[idx] = group.modelIds
      }

      setExchangeModels(restoredExchangeModels)
      setSelectedTabPerExchange(exchanges.map(() => 0))
      setExchangeGenTypes(restoredGenTypes)
      setGenerationResults(restoredResults)

      if (!existingChat) {
        try {
          const metaRes = await fetch(`/api/app/chats?chatId=${chatId}`)
          if (requestId !== loadChatRequestRef.current) return
          if (metaRes.ok) {
            const meta = await metaRes.json() as { title?: string }
            if (meta.title) setActiveChatTitle(meta.title)
          }
        } catch {
          // keep the current title fallback if metadata lookup fails
        }
      }
    } catch { /* already cleared */ }
    finally {
      if (requestId === loadChatRequestRef.current) setIsSwitchingChat(false)
      done(progressToken)
    }
  }

  async function deleteChat(chatId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/app/chats?chatId=${chatId}`, { method: 'DELETE' })
    if (activeChatId === chatId) {
      setActiveChatId(null)
      pendingTitleRef.current = null
      resetChatState()
    }
    await loadChats()
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

  async function handleSend() {
    const text = input.trim()
    if ((!text && attachedImages.length === 0) || isAnyLoading) return

    // ── Image / Video generation path ──────────────────────────────────────
    if (effectiveGenType === 'image' || effectiveGenType === 'video') {
      if (isSendBlocked) return
      const chatId = activeChatId || await createNewChat()
      if (!chatId) return

      setInput('')
      setGenerationChip(null)
      const wasFirst = isFirstMessage
      setIsFirstMessage(false)
      shouldScrollRef.current = true

      // Inject a placeholder user message into the primary chat slot so the exchange renders
      const exchIdx = exchangeModels.length
      const activeModels = effectiveGenType === 'image' ? selectedImageModels : selectedVideoModels
      setExchangeModels((prev) => [...prev, [...activeModels]])
      setSelectedTabPerExchange((prev) => [...prev, 0])
      setExchangeGenTypes((prev) => [...prev, effectiveGenType])
      setGenerationResults((prev) => {
        const next = new Map(prev)
        next.set(exchIdx, activeModels.map(() => ({ type: effectiveGenType as 'image' | 'video', status: 'generating' as const })))
        return next
      })

      const mediaUserMessage = {
        id: `gen-${Date.now()}`,
        role: 'user',
        parts: [{ type: 'text', text }],
      }
      chatInstances.slice(0, selectedModels.length).forEach((chat) => {
        chat.setMessages((prev) => [
          ...prev,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mediaUserMessage as any,
        ])
      })
      void fetch('/api/app/chats/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          role: 'user',
          content: text,
          parts: [{ type: 'text', text }],
        }),
      })

      if (wasFirst && text) startFirstMessageRename(chatId, text)

      if (effectiveGenType === 'image') {
        const imageUrl = lastGeneratedImageUrlRef.current
        const generationTasks = activeModels.map((modelId, mIdx) =>
          fetch('/api/app/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text, modelId, chatId, imageUrl }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Generation failed' }))
                setGenerationResults((prev) => { const n = new Map(prev); const arr = [...(n.get(exchIdx) ?? activeModels.map(() => ({ type: 'image' as const, status: 'generating' as const })))]; arr[mIdx] = { type: 'image', status: 'failed', error: (err as { message?: string }).message }; n.set(exchIdx, arr); return n })
                return { ok: false as const, modelId }
              }
              const data = await res.json() as { url?: string; modelUsed?: string; outputId?: string }
              if (data.url && mIdx === 0) lastGeneratedImageUrlRef.current = data.url
              setGenerationResults((prev) => { const n = new Map(prev); const arr = [...(n.get(exchIdx) ?? activeModels.map(() => ({ type: 'image' as const, status: 'generating' as const })))]; arr[mIdx] = { type: 'image', status: 'completed', url: data.url, modelUsed: data.modelUsed, outputId: data.outputId }; n.set(exchIdx, arr); return n })
              return { ok: true as const, modelId: data.modelUsed ?? modelId }
            })
            .catch((err) => {
              setGenerationResults((prev) => { const n = new Map(prev); const arr = [...(n.get(exchIdx) ?? activeModels.map(() => ({ type: 'image' as const, status: 'generating' as const })))]; arr[mIdx] = { type: 'image', status: 'failed', error: String(err) }; n.set(exchIdx, arr); return n })
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
          chatInstances.slice(0, selectedModels.length).forEach((chat) => {
            chat.setMessages((prev) => [
              ...prev,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              assistantMessage as any,
            ])
          })
          void fetch('/api/app/chats/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId,
              role: 'assistant',
              content: summary,
              parts: [{ type: 'text', text: summary }],
            }),
          })
        })
      } else {
        const generationTasks = activeModels.map((modelId, mIdx) =>
          fetch('/api/app/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text, modelId, chatId }),
          })
            .then(async (res) => {
              if (!res.ok) {
                setGenerationResults((prev) => { const n = new Map(prev); const arr = [...(n.get(exchIdx) ?? activeModels.map(() => ({ type: 'video' as const, status: 'generating' as const })))]; arr[mIdx] = { type: 'video', status: 'failed', error: 'Request failed' }; n.set(exchIdx, arr); return n })
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
                      setGenerationResults((prev) => { const n = new Map(prev); const arr = [...(n.get(exchIdx) ?? activeModels.map(() => ({ type: 'video' as const, status: 'generating' as const })))]; arr[mIdx] = { type: 'video', status: 'completed', url: evt.url, modelUsed: evt.modelUsed, outputId: evt.outputId }; n.set(exchIdx, arr); return n })
                      return { ok: true as const, modelId: evt.modelUsed ?? modelId }
                    } else if (evt.type === 'failed') {
                      setGenerationResults((prev) => { const n = new Map(prev); const arr = [...(n.get(exchIdx) ?? activeModels.map(() => ({ type: 'video' as const, status: 'generating' as const })))]; arr[mIdx] = { type: 'video', status: 'failed', error: evt.error }; n.set(exchIdx, arr); return n })
                      return { ok: false as const, modelId }
                    }
                  } catch { /* ignore */ }
                }
              }
              return { ok: false as const, modelId }
            })
            .catch((err) => {
              setGenerationResults((prev) => { const n = new Map(prev); const arr = [...(n.get(exchIdx) ?? activeModels.map(() => ({ type: 'video' as const, status: 'generating' as const })))]; arr[mIdx] = { type: 'video', status: 'failed', error: String(err) }; n.set(exchIdx, arr); return n })
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
          chatInstances.slice(0, selectedModels.length).forEach((chat) => {
            chat.setMessages((prev) => [
              ...prev,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              assistantMessage as any,
            ])
          })
          void fetch('/api/app/chats/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId,
              role: 'assistant',
              content: summary,
              parts: [{ type: 'text', text: summary }],
            }),
          })
        })
      }
      return
    }

    // ── Normal text chat path ─────────────────────────────────────────────
    if (attachedImages.length === 0 && !text) return
    if (isSendBlocked) return

    // Capture before any await — isFirstMessage is true for the first message of a new/fresh chat
    const wasFirst = isFirstMessage
    const chatId = activeChatId || await createNewChat()
    if (!chatId) return

    setInput('')
    setAttachedImages([])
    setAttachmentError(null)
    setIsFirstMessage(false)
    shouldScrollRef.current = true
    setExchangeModels((prev) => [...prev, [...selectedModels]])
    setSelectedTabPerExchange((prev) => [...prev, 0])
    setExchangeGenTypes((prev) => [...prev, 'text'])

    const parts: Array<{ type: string; text?: string; url?: string; mediaType?: string }> = []
    if (text) parts.push({ type: 'text', text })
    for (const img of attachedImages) {
      parts.push({ type: 'file', url: img.dataUrl, mediaType: img.mimeType })
    }
    const persistedContent = text || (parts.some((part) => part.type === 'file') ? '[Image attachment]' : '')

    // Title generation: show truncated text immediately, replace with GPT OSS 20B-generated title once it arrives.
    // pendingTitleRef guards against loadChats() overwriting the title mid-flight.
    if (wasFirst && text) {
      startFirstMessageRename(chatId, text)
    }

    const msgCountBeforeSend = chat0.messages.length
    startSession(chatId, 'chat', activeChatTitle ?? '', msgCountBeforeSend)
    activeChatIdRef.current = chatId

    let persistedUserMessage = false
    try {
      const persistRes = await fetch('/api/app/chats/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          role: 'user',
          content: persistedContent,
          parts,
          model: selectedModels[0],
        }),
      })
      persistedUserMessage = persistRes.ok
      if (!persistRes.ok) {
        console.error('[ChatInterface] Failed to persist user message', await persistRes.text())
      }
    } catch (err) {
      console.error('[ChatInterface] Failed to persist user message', err)
    }

    void Promise.all(
      selectedModels.map((modelId, idx) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chatInstances[idx].sendMessage({ role: 'user', parts: parts as any }, {
          body: { modelId, chatId, skipUserMessage: persistedUserMessage || idx !== 0 },
        })
      )
    ).then(() => {
      completeSession(chatId, activeChatIdRef.current === chatId)
      loadChats()
    })
  }

  function handleModeChange(mode: GenerationMode) {
    setGenerationMode(mode)
    setGenerationChip(null)
    localStorage.setItem(CHAT_GEN_MODE_KEY, mode)
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

  // ── derived values for header ─────────────────────────────────────────────

  const activeChat = chats.find((c) => c._id === activeChatId)
  const modelPickerLabel = generationMode === 'image'
    ? (selectedImageModels.length === 1 ? (IMAGE_MODELS.find((m) => m.id === selectedImageModels[0])?.name ?? 'Select model') : `${selectedImageModels.length} models`)
    : generationMode === 'video'
    ? (selectedVideoModels.length === 1 ? (VIDEO_MODELS.find((m) => m.id === selectedVideoModels[0])?.name ?? 'Select model') : `${selectedVideoModels.length} models`)
    : selectedModels.length === 1
    ? (AVAILABLE_MODELS.find((m) => m.id === selectedModels[0])?.name ?? 'Select model')
    : `${selectedModels.length} models`

  // Tabs shown in the header for the exchange currently in view
  const headerTabModels = exchangeModels[visibleExchangeIdx] ?? []
  const showHeaderTabs = headerTabModels.length > 1
  const headerSelectedTab = selectedTabPerExchange[visibleExchangeIdx] ?? 0

  const primaryMessages = chat0.messages
  const hasMessages = primaryMessages.some((m) => m.role === 'user')
  const hasHistory = hasMessages || generationResults.size > 0
  const latestExchIdx = exchangeModels.length - 1

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full">
      {/* Sidebar — hidden when embedded in a project */}
      {!hideSidebar && (
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
            {chats.map((chat) => {
              const isStreaming = sessions[chat._id]?.status === 'streaming'
              const unread = getUnread(chat._id)
              return (
                <div
                  key={chat._id}
                  onClick={() => loadChat(chat._id)}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${
                    activeChatId === chat._id
                      ? 'bg-[#e8e8e8] text-[#0a0a0a]'
                      : 'text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
                  }`}
                >
                  <span className="truncate flex-1">{chat.title}</span>
                  {isStreaming && !unread && (
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#525252] animate-pulse ml-1" />
                  )}
                  {unread > 0 && (
                    <span className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#0a0a0a] text-[#fafafa] text-[9px] font-medium ml-1">
                      {unread}
                    </span>
                  )}
                  <button
                    onClick={(e) => deleteChat(chat._id, e)}
                    className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main area */}
      <div
        className="flex-1 flex flex-col h-full overflow-hidden relative"
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
          const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
          if (files.length > 0) addImages(files)
        }}
      >
        {isDragging && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#fafafa]/90 border-2 border-dashed border-[#0a0a0a] rounded-lg m-2 pointer-events-none">
            <div className="text-center">
              <ImageIcon size={28} className="mx-auto mb-2 text-[#525252]" />
              <p className="text-sm font-medium text-[#0a0a0a]">Drop images here</p>
            </div>
          </div>
        )}
        {/* Sticky header */}
        <div className="flex h-16 items-center justify-between border-b border-[#e5e5e5] px-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0 max-w-[40%]">
            <h2 className="text-sm font-medium text-[#0a0a0a] truncate">
              {activeChatTitle ?? activeChat?.title ?? 'New conversation'}
            </h2>
            {isSwitchingChat && (
              <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#e0e0e0] border-t-[#525252] animate-spin" />
            )}
            {projectName && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[#f0f0f0] text-[#525252] border border-[#e8e8e8] shrink-0 whitespace-nowrap">
                <FolderOpen size={9} />
                {projectName}
              </span>
            )}
          </div>

          {/* Model tabs for the visible exchange — center of header */}
          {showHeaderTabs && (
            <div className="flex items-center gap-1.5 flex-1 justify-center px-4">
              {headerTabModels.map((mId, tabIdx) => {
                const mSlot = modelSlotMap.get(mId) ?? 0
                const mInst = chatInstances[mSlot]
                const isLatestVisible = visibleExchangeIdx === latestExchIdx
                const mLoading = isLatestVisible &&
                  (mInst.status === 'streaming' || mInst.status === 'submitted') &&
                  !getResponseForExchange(mSlot, visibleExchangeIdx)
                const isActive = tabIdx === headerSelectedTab
                const mName = AVAILABLE_MODELS.find((m) => m.id === mId)?.name ?? mId
                return (
                  <button
                    key={mId}
                    onClick={() => !isAnyLoading && handleTabSelect(visibleExchangeIdx, tabIdx)}
                    disabled={isAnyLoading}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
                      isAnyLoading ? 'cursor-not-allowed opacity-60' : ''
                    } ${
                      isActive
                        ? 'bg-[#0a0a0a] text-[#fafafa]'
                        : 'bg-[#f0f0f0] text-[#525252] hover:bg-[#e8e8e8]'
                    }`}
                  >
                    {mLoading && <Loader2 size={9} className="animate-spin" />}
                    {mName}
                  </button>
                )
              })}
            </div>
          )}

          {/* Model picker + Generation mode toggle */}
          <div className="flex items-center gap-2">
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
                  {generationMode === 'image' ? (
                    IMAGE_MODELS.map((m) => {
                        const isSel = selectedImageModels.includes(m.id)
                        const isDisabled = !isSel && selectedImageModels.length >= 4
                        return (
                          <button key={m.id}
                            disabled={isDisabled}
                            onClick={() => setSelectedImageModels((prev) => prev.includes(m.id) ? (prev.length > 1 ? prev.filter((x) => x !== m.id) : prev) : [...prev, m.id].slice(0, 4))}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                              isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#f5f5f5]'
                            } ${isSel ? 'text-[#0a0a0a] font-medium' : 'text-[#525252]'}`}>
                            <span className="flex items-center gap-2">
                              {isSel ? <Check size={10} /> : <span className="w-[10px] inline-block" />}
                              {m.name}
                            </span>
                            <span className="text-[#aaa] ml-2">{m.provider}</span>
                          </button>
                        )
                      })
                  ) : generationMode === 'video' ? (
                    VIDEO_MODELS.map((m) => {
                        const isSel = selectedVideoModels.includes(m.id)
                        const isDisabled = !isSel && selectedVideoModels.length >= 4
                        return (
                          <button key={m.id}
                            disabled={isDisabled}
                            onClick={() => setSelectedVideoModels((prev) => prev.includes(m.id) ? (prev.length > 1 ? prev.filter((x) => x !== m.id) : prev) : [...prev, m.id].slice(0, 4))}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                              isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#f5f5f5]'
                            } ${isSel ? 'text-[#0a0a0a] font-medium' : 'text-[#525252]'}`}>
                            <span className="flex items-center gap-2">
                              {isSel ? <Check size={10} /> : <span className="w-[10px] inline-block" />}
                              {m.name}
                            </span>
                            <span className="text-[#aaa] ml-2">{m.provider}</span>
                          </button>
                        )
                      })
                  ) : (
                    AVAILABLE_MODELS.map((m) => {
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
                    })
                  )}
                </div>
              )}
            </div>
            <GenerationModeToggle mode={generationMode} onChange={handleModeChange} disabled={isAnyLoading} />
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesScrollRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          onScroll={handleMessagesScroll}
        >
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6">
            {!hasHistory && (
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

            {(() => {
              const blocks: React.ReactNode[] = []
              let exchIdx = 0

              for (const msg of primaryMessages) {
                if (msg.role !== 'user') continue
                const curExchIdx = exchIdx++
                const genResults = generationResults.get(curExchIdx)
                const genType = exchangeGenTypes[curExchIdx]

                if (genType === 'image' || genType === 'video') {
                  const exchModelList = exchangeModels[curExchIdx] ?? []
                  const selectedTab = selectedTabPerExchange[curExchIdx] ?? 0
                  const selectedResult = genResults?.[selectedTab] ?? genResults?.[0]

                  blocks.push(
                    <div key={msg.id} className="flex flex-col gap-2 message-appear" data-exchange-idx={curExchIdx}>
                      <div className="flex justify-end">
                        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-[#0a0a0a] px-4 py-2.5 text-sm leading-relaxed text-[#fafafa]">
                          <span className="whitespace-pre-wrap">{getMessageText(msg)}</span>
                        </div>
                      </div>
                      {selectedResult?.status === 'generating' && (
                        <div className="px-1 py-3 flex items-center gap-2 text-xs text-[#888]">
                          <div className="w-4 h-4 rounded-full border-2 border-[#e0e0e0] border-t-[#525252] animate-spin" />
                          {genType === 'image' ? 'Generating image…' : 'Generating video (this may take a few minutes)…'}
                        </div>
                      )}
                      {selectedResult && (selectedResult.status === 'completed' || selectedResult.status === 'failed') && (
                        <div className="flex flex-col gap-2 px-1">
                          {exchModelList.length > 1 && (
                            <div className="flex flex-wrap gap-2">
                              {exchModelList.map((modelId, tabIdx) => {
                                const isActive = tabIdx === selectedTab
                                const modelName =
                                  IMAGE_MODELS.find((m) => m.id === modelId)?.name ||
                                  VIDEO_MODELS.find((m) => m.id === modelId)?.name ||
                                  modelId
                                return (
                                  <button
                                    key={`${modelId}-${tabIdx}`}
                                    onClick={() => handleTabSelect(curExchIdx, tabIdx)}
                                    className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                                      isActive ? 'bg-[#0a0a0a] text-[#fafafa]' : 'bg-[#f0f0f0] text-[#525252] hover:bg-[#e8e8e8]'
                                    }`}
                                  >
                                    {modelName}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                          <div className="flex flex-col gap-1">
                            {selectedResult.status === 'completed' && selectedResult.url && (
                              <div className="relative group w-fit">
                                {genType === 'image' ? (
                                  <img src={selectedResult.url} alt="Generated image" className="rounded-xl max-w-xs max-h-80 object-contain border border-[#e5e5e5]" />
                                ) : (
                                  <video src={selectedResult.url} controls className="rounded-xl max-w-sm border border-[#e5e5e5]" />
                                )}
                                <a href={selectedResult.url} download={genType === 'image' ? 'generated.png' : 'generated.mp4'}
                                  className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" title="Download">
                                  <Download size={13} className="text-[#0a0a0a]" />
                                </a>
                              </div>
                            )}
                            {selectedResult.status === 'failed' && (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">
                                <AlertCircle size={12} />
                                {selectedResult.error ?? 'Failed'}
                              </div>
                            )}
                            {selectedResult.modelUsed && <p className="text-xs text-[#aaa]">Generated with {selectedResult.modelUsed}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                  continue
                }

                const exchModelList = exchangeModels[curExchIdx] ?? []
                const selectedTab = selectedTabPerExchange[curExchIdx] ?? 0
                const selectedModelId = exchModelList[selectedTab] ?? selectedModels[0]
                const slotIdx = modelSlotMap.get(selectedModelId) ?? 0
                const isLatest = curExchIdx === latestExchIdx
                const slotInst = chatInstances[slotIdx]

                const responseMsg = getResponseForExchange(slotIdx, curExchIdx)
                const responseText = responseMsg ? getMessageText(responseMsg) : ''

                const instLoading = isLatest && (slotInst.status === 'streaming' || slotInst.status === 'submitted')
                const isStreaming = instLoading && responseText.length > 0
                const showThinking = instLoading && responseText.length === 0
                const instError = isLatest ? slotInst.error : null

                blocks.push(
                  <ExchangeBlock
                    key={msg.id}
                    userMsgId={msg.id}
                    userText={getMessageText(msg)}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    userImages={getMessageImages(msg as any)}
                    exchIdx={curExchIdx}
                    slotIdx={slotIdx}
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
            {attachmentError && (
              <div className="mb-2 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                <AlertCircle size={13} className="shrink-0" />
                {attachmentError}
              </div>
            )}
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
              <div className="flex items-center gap-2 bg-[#f0f0f0] rounded-2xl px-4 py-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && addImages(e.target.files)}
                />
                <div ref={attachMenuRef} className="relative shrink-0">
                  <button
                    onClick={() => setShowAttachMenu((v) => !v)}
                    className="flex items-center justify-center w-6 h-6 rounded-full text-[#aaa] hover:text-[#525252] hover:bg-[#e0e0e0] transition-colors"
                    title="Attach"
                  >
                    <Plus size={14} />
                  </button>
                  {showAttachMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white border border-[#e5e5e5] rounded-xl shadow-lg py-1 w-52 z-20">
                      <button
                        onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false) }}
                        disabled={!supportsVision}
                        className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors ${
                          supportsVision
                            ? 'text-[#525252] hover:bg-[#f5f5f5]'
                            : 'text-[#bbb] cursor-not-allowed'
                        }`}
                      >
                        <ImageIcon size={13} />
                        <span>Attach Images</span>
                        {!supportsVision && <span className="ml-auto text-[10px] text-[#ccc]">vision required</span>}
                      </button>
                      <div className="border-t border-[#f0f0f0] my-1" />
                      <button
                        onClick={() => { setGenerationChip('image'); setShowAttachMenu(false) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors"
                      >
                        <ImageIcon size={13} className="text-purple-500" />
                        <span>Generate Image</span>
                      </button>
                      <button
                        onClick={() => { setGenerationChip('video'); setShowAttachMenu(false) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors"
                      >
                        <Video size={13} className="text-blue-500" />
                        <span>Generate Video</span>
                      </button>
                      <div className="border-t border-[#f0f0f0] my-1" />
                      <button
                        disabled
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[#bbb] cursor-not-allowed"
                      >
                        <FileText size={13} />
                        <span>Documents</span>
                        <span className="ml-auto text-[10px] text-[#ccc]">soon</span>
                      </button>
                    </div>
                  )}
                </div>
                {generationChip && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#0a0a0a] text-[#fafafa] shrink-0">
                    {generationChip === 'image' ? <ImageIcon size={10} /> : <Video size={10} />}
                    {generationChip === 'image' ? 'Image' : 'Video'}
                    <button onClick={() => setGenerationChip(null)} className="ml-0.5 hover:opacity-70">
                      <X size={9} />
                    </button>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={handlePaste}
                  placeholder={effectiveGenType === 'image' ? 'Describe the image to generate…' : effectiveGenType === 'video' ? 'Describe the video to generate…' : 'Message...'}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  className="flex-1 resize-none bg-transparent py-1.5 text-sm leading-6 text-[#0a0a0a] outline-none placeholder-[#aaa]"
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
