'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Send, Plus, Trash2, ChevronDown, ImageIcon, X, AlertCircle, FolderOpen } from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useSearchParams } from 'next/navigation'
import { AVAILABLE_MODELS } from '@/lib/models'
import { sanitizeChatTitle, dispatchChatTitleUpdated } from '@/lib/chat-title'
import { MarkdownMessage } from './MarkdownMessage'

interface Agent {
  _id: string
  title: string
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
}

function getMessageText(msg: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!msg.parts) return ''
  return msg.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text || '')
    .join('')
}

function getMessageImages(msg: { parts?: Array<{ type: string; image?: string }> }): string[] {
  if (!msg.parts) return []
  return msg.parts
    .filter((p) => p.type === 'image' && p.image)
    .map((p) => p.image!)
}

const SUGGESTIONS = [
  'Connect Slack and summarize my unread messages',
  'Search my connected apps for the latest customer feedback',
  'Find the last email from a vendor and summarize it',
  'Connect a tool I need and then use it to finish my task',
]

const AGENT_MODELS = AVAILABLE_MODELS
const DEFAULT_AGENT_MODEL = 'claude-sonnet-4-6'
const AGENT_MODEL_KEY = 'overlay_agent_model'

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

const DEFAULT_AGENT_TITLE = 'New Agent'

export default function AgentChat({ hideSidebar, projectName }: { hideSidebar?: boolean; projectName?: string } = {}) {
  const searchParams = useSearchParams()
  const [agents, setAgents] = useState<Agent[]>([])
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_AGENT_MODEL)

  useEffect(() => {
    const saved = localStorage.getItem(AGENT_MODEL_KEY)
    if (saved) setSelectedModel(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [input, setInput] = useState('')
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingTitleRef = useRef<{ agentId: string; title: string } | null>(null)

  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/app/agent' }), [])
  const { messages, sendMessage, status, setMessages, stop, error } = useChat({ transport })
  const isLoading = status === 'streaming' || status === 'submitted'
  const lastMessage = messages[messages.length - 1]
  const showLoadingIndicator =
    isLoading &&
    !(
      lastMessage?.role === 'assistant' &&
      getMessageText(lastMessage).trim().length > 0
    )

  const currentModelInfo = AGENT_MODELS.find((m) => m.id === selectedModel)
  const supportsVision = currentModelInfo?.supportsVision ?? false

  const isFreeTier = entitlements?.tier === 'free'
  const weeklyUsed = isFreeTier
    ? (entitlements?.dailyUsage.ask ?? 0) + (entitlements?.dailyUsage.write ?? 0) + (entitlements?.dailyUsage.agent ?? 0)
    : 0
  const weeklyLimitReached = isFreeTier && weeklyUsed >= 15
  const premiumModelBlocked = isFreeTier && currentModelInfo?.provider !== 'openrouter'
  const creditsExhausted =
    !isFreeTier &&
    entitlements != null &&
    entitlements.creditsTotal > 0 &&
    entitlements.creditsUsed >= entitlements.creditsTotal * 100

  const isSendBlocked = weeklyLimitReached || (premiumModelBlocked && isFreeTier) || creditsExhausted

  const loadSubscription = useCallback(async () => {
    try {
      const res = await fetch('/api/app/subscription')
      if (res.ok) setEntitlements(await res.json())
    } catch {
      // ignore
    }
  }, [])

  const loadAgents = useCallback(async () => {
    try {
      const pending = pendingTitleRef.current  // snapshot before await
      const res = await fetch('/api/app/agents')
      if (res.ok) {
        const serverAgents: Agent[] = await res.json()
        setAgents(
          pending
            ? serverAgents.map((a) => (a._id === pending.agentId ? { ...a, title: pending.title } : a))
            : serverAgents
        )
        if (pending && serverAgents.some((a) => a._id === pending.agentId && a.title === pending.title)) {
          if (pendingTitleRef.current?.agentId === pending.agentId) pendingTitleRef.current = null
        }
      }
    } catch { /* ignore */ }
  }, [])

  const applyAgentTitleUpdate = useCallback((agentId: string, title: string) => {
    const nextTitle = sanitizeChatTitle(title, DEFAULT_AGENT_TITLE)
    pendingTitleRef.current = { agentId, title: nextTitle }
    setAgents((prev) => {
      const exists = prev.some((a) => a._id === agentId)
      if (!exists) {
        return [{ _id: agentId, title: nextTitle, lastModified: Date.now() }, ...prev]
      }
      return prev.map((a) => (a._id === agentId ? { ...a, title: nextTitle } : a))
    })
    dispatchChatTitleUpdated({ chatId: agentId, title: nextTitle })
    return nextTitle
  }, [])

  const startFirstMessageRename = useCallback((agentId: string, text: string) => {
    const fallbackTitle = applyAgentTitleUpdate(agentId, text)

    void generateTitle(text).then(async (aiTitle) => {
      const finalTitle = applyAgentTitleUpdate(agentId, aiTitle || fallbackTitle)
      try {
        const res = await fetch('/api/app/agents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, title: finalTitle }),
        })
        if (res.ok) void loadAgents()
      } catch { /* keep local title */ }
    })
  }, [applyAgentTitleUpdate, loadAgents])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAgents(); loadSubscription() }, [loadAgents, loadSubscription])

  // Auto-load a specific agent when embedded in project view
  const idParam = hideSidebar ? searchParams.get('id') : null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (idParam) void loadAgent(idParam) }, [idParam])

  useEffect(() => {
    if (status === 'ready' && messages.length > 0) {
      loadSubscription()
    }
  }, [status, messages.length, loadSubscription])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const maxHeight = 160
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [input])

  async function createNewAgent(): Promise<string | null> {
    const res = await fetch('/api/app/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: DEFAULT_AGENT_TITLE }),
    })
    if (res.ok) {
      const data = await res.json()
      // Add directly to state — no loadAgents() here to avoid racing with pendingTitleRef
      setAgents((prev) => [{ _id: data.id, title: DEFAULT_AGENT_TITLE, lastModified: Date.now() }, ...prev])
      setActiveAgentId(data.id)
      setIsFirstMessage(true)
      setMessages([])
      return data.id
    }
    return null
  }

  async function loadAgent(agentId: string) {
    setActiveAgentId(agentId)
    setIsFirstMessage(false)
    try {
      const res = await fetch(`/api/app/agents?agentId=${agentId}&messages=true`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch {
      setMessages([])
    }
  }

  async function deleteAgent(agentId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/app/agents?agentId=${agentId}`, { method: 'DELETE' })
    if (activeAgentId === agentId) {
      setActiveAgentId(null)
      pendingTitleRef.current = null
      setMessages([])
    }
    await loadAgents()
  }

  function addImages(files: FileList | File[]) {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
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
    if ((!text && attachedImages.length === 0) || isLoading || isSendBlocked) return

    // Capture before any await — isFirstMessage is true for the first message of a new/fresh agent
    const wasFirst = isFirstMessage
    const agentId = activeAgentId || await createNewAgent()
    if (!agentId) return

    setInput('')
    setAttachedImages([])
    setIsFirstMessage(false)

    const parts: Array<{ type: string; text?: string; image?: string; mediaType?: string }> = []
    if (text) parts.push({ type: 'text', text })
    for (const img of attachedImages) {
      parts.push({ type: 'image', image: img.dataUrl, mediaType: img.mimeType })
    }

    // Title generation: show truncated text immediately, replace with GPT OSS 20B title async.
    if (wasFirst && text) {
      startFirstMessageRename(agentId, text)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void sendMessage({ role: 'user', parts: parts as any }, { body: { agentId, modelId: selectedModel } })
      .then(() => loadAgents())
  }

  const activeAgent = agents.find((a) => a._id === activeAgentId)
  const currentModel = AGENT_MODELS.find((m) => m.id === selectedModel)

  const errorMessage = error
    ? (error.message?.includes('weekly_limit') ? 'Weekly limit reached — upgrade to Pro for unlimited messages.'
        : error.message?.includes('premium_model') ? 'This model requires a Pro subscription.'
        : error.message?.includes('insufficient_credits') ? 'No credits remaining.'
        : 'Something went wrong. Please try again.')
    : null

  return (
    <div className="flex h-full">
      {/* Agent history sidebar — hidden when embedded in a project */}
      {!hideSidebar && (
        <div className="w-52 h-full flex flex-col border-r border-[#e5e5e5] bg-[#f5f5f5]">
          <div className="flex h-16 items-center border-b border-[#e5e5e5] px-3">
            <button
              onClick={createNewAgent}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-md text-sm bg-[#0a0a0a] text-[#fafafa] hover:bg-[#222] transition-colors"
            >
              <Plus size={13} />
              New agent
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {agents.map((agent) => (
              <div
                key={agent._id}
                onClick={() => loadAgent(agent._id)}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${
                  activeAgentId === agent._id
                    ? 'bg-[#e8e8e8] text-[#0a0a0a]'
                    : 'text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
                }`}
              >
                <span className="truncate">{agent.title}</span>
                <button
                  onClick={(e) => deleteAgent(agent._id, e)}
                  className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main agent area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#e5e5e5] px-4">
          <div className="flex items-center gap-2 min-w-0 max-w-[50%]">
            <h2 className="text-sm font-medium text-[#0a0a0a] truncate">
              {activeAgent?.title || 'New conversation'}
            </h2>
            {projectName && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[#f0f0f0] text-[#525252] border border-[#e8e8e8] shrink-0 whitespace-nowrap">
                <FolderOpen size={9} />
                {projectName}
              </span>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-[#f0f0f0] text-[#525252] hover:bg-[#e8e8e8] transition-colors"
            >
              {currentModel?.name || 'Select model'}
              <ChevronDown size={11} />
            </button>
            {showModelPicker && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-[#e5e5e5] rounded-lg shadow-lg z-10 py-1 max-h-72 overflow-y-auto">
                {AGENT_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.id)
                      localStorage.setItem(AGENT_MODEL_KEY, m.id)
                      setShowModelPicker(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#f5f5f5] flex items-center justify-between ${
                      m.id === selectedModel ? 'text-[#0a0a0a] font-medium' : 'text-[#525252]'
                    }`}
                  >
                    <span>{m.name}</span>
                    <span className="text-[#aaa] ml-2">{m.provider}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-4">
            {messages.length === 0 && (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center max-w-xl">
                  <p className="text-3xl mb-3" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
                    agent
                  </p>
                  <p className="text-sm text-[#888] mb-6">
                    Let AI do the work for you
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-[#525252]">
                    {SUGGESTIONS.map((prompt) => (
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

            {messages.map((msg) => {
              const text = getMessageText(msg)
              const toolParts = msg.parts?.filter((p) => p.type === 'tool-invocation') || []
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const images = getMessageImages(msg as any)

              return (
                <div key={msg.id} className={`flex message-appear ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="max-w-[75%] space-y-2">
                      {images.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {images.map((src, i) => (
                            <img
                              key={i}
                              src={src}
                              alt="attached"
                              className="max-w-[200px] max-h-[200px] rounded-xl object-cover"
                            />
                          ))}
                        </div>
                      )}
                      {text && (
                        <div className="rounded-2xl rounded-br-sm px-4 py-2.5 text-sm bg-[#0a0a0a] text-[#fafafa]">
                          <span className="whitespace-pre-wrap">{text}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full space-y-2">
                      {toolParts.map((part, i) => {
                        const tp = part as { type: string; toolInvocation?: { toolName: string; state: string } }
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs text-[#888] bg-[#f5f5f5] rounded-lg px-3 py-2 w-fit">
                            <span className="text-[#aaa]">⚙</span>
                            <span className="font-medium">{tp.toolInvocation?.toolName}</span>
                            {tp.toolInvocation?.state === 'result' && <span className="text-[#aaa]">- done</span>}
                          </div>
                        )
                      })}
                      {text && (
                        <div className="w-full px-1 py-1 text-sm leading-relaxed text-[#0a0a0a]">
                          <MarkdownMessage text={text} isStreaming={isLoading && msg.id === lastMessage?.id} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {showLoadingIndicator && (
              <div className="px-1 py-2">
                <div className="w-5 h-5 rounded-full border-2 border-[#e0e0e0] border-t-[#525252] animate-spin" />
              </div>
            )}
            {errorMessage && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">
                  <AlertCircle size={12} />
                  {errorMessage}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="px-4 pb-4">
          {/* Image previews */}
          {attachedImages.length > 0 && (
            <div className="mx-auto w-full max-w-4xl mb-2 flex flex-wrap gap-2">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative group">
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="w-16 h-16 object-cover rounded-lg border border-[#e5e5e5]"
                  />
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
            {isSendBlocked && !isLoading ? (
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
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Ask the agent to do something..."
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  className="flex-1 resize-none bg-transparent py-1.5 text-sm leading-6 text-[#0a0a0a] outline-none placeholder-[#aaa]"
                />
                {isLoading ? (
                  <button
                    onClick={() => stop()}
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
