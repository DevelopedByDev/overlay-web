'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Send, Plus, Trash2, ChevronDown, Loader2 } from 'lucide-react'
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

function getMessageText(msg: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!msg.parts) return ''
  return msg.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text || '')
    .join('')
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
      return data.title || null
    }
  } catch {
    // ignore
  }
  return null
}

export default function ChatInterface({ userId: _userId }: { userId: string }) {
  void _userId
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [input, setInput] = useState('')
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/app/chat' }), [])

  const { messages, sendMessage, status, setMessages, stop } = useChat({ transport })

  const isLoading = status === 'streaming' || status === 'submitted'

  const loadChats = useCallback(async () => {
    try {
      const res = await fetch('/api/app/chats')
      if (res.ok) setChats(await res.json())
    } catch {
      // ignore
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadChats() }, [loadChats])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function createNewChat(): Promise<string | null> {
    const res = await fetch('/api/app/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel }),
    })
    if (res.ok) {
      const data = await res.json()
      setActiveChatId(data.id)
      setIsFirstMessage(true)
      setMessages([])
      await loadChats()
      return data.id
    }

    return null
  }

  async function loadChat(chatId: string) {
    setActiveChatId(chatId)
    setIsFirstMessage(false)
    try {
      const res = await fetch(`/api/app/chats?chatId=${chatId}&messages=true`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch {
      setMessages([])
    }
  }

  async function deleteChat(chatId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/app/chats?chatId=${chatId}`, { method: 'DELETE' })
    if (activeChatId === chatId) {
      setActiveChatId(null)
      setMessages([])
    }
    await loadChats()
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    const chatId = activeChatId || await createNewChat()
    if (!chatId) return
    const wasFirst = isFirstMessage
    setInput('')
    setIsFirstMessage(false)
    await sendMessage(
      { role: 'user', parts: [{ type: 'text', text }] },
      { body: { modelId: selectedModel, chatId } }
    )
    loadChats()

    // Asynchronously generate a title from the first message
    if (wasFirst) {
      generateTitle(text).then((title) => {
        if (title) {
          fetch('/api/app/chats', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, title }),
          }).then(() => loadChats())
        }
      })
    }
  }

  const activeChat = chats.find((c) => c._id === activeChatId)
  const currentModel = AVAILABLE_MODELS.find((m) => m.id === selectedModel)
  const lastMessage = messages[messages.length - 1]
  const showLoadingIndicator =
    isLoading &&
    !(
      lastMessage?.role === 'assistant' &&
      getMessageText(lastMessage).trim().length > 0
    )

  return (
    <div className="flex h-full">
      {/* Chat history sidebar */}
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

      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#e5e5e5] px-4">
          <h2 className="text-sm font-medium text-[#0a0a0a] truncate max-w-[50%]">
            {activeChat?.title || 'New conversation'}
          </h2>
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
                {AVAILABLE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setShowModelPicker(false) }}
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-4">
            {messages.length === 0 && (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl mb-2" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
                    chat
                  </p>
                  <p className="text-sm text-[#888]">Start a conversation with any AI model</p>
                </div>
              </div>
            )}
            {messages.map((msg) => {
              const text = getMessageText(msg)
              return (
                <div
                  key={msg.id}
                  className={`flex message-appear ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="w-full px-1 py-1 text-sm leading-relaxed text-[#0a0a0a]">
                      <MarkdownMessage text={text} isStreaming={isLoading && msg.id === lastMessage?.id} />
                    </div>
                  ) : (
                    <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-[#0a0a0a] px-4 py-2.5 text-sm leading-relaxed text-[#fafafa]">
                      <span className="whitespace-pre-wrap">{text}</span>
                    </div>
                  )}
                </div>
              )
            })}
            {showLoadingIndicator && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-1 py-1 text-xs italic text-[#888]">
                  <Loader2 size={12} className="animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="px-4 pb-4">
          <div className="mx-auto w-full max-w-4xl">
            <div className="flex items-end gap-2 bg-[#f0f0f0] rounded-2xl px-4 py-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
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
                  disabled={!input.trim()}
                  className="shrink-0 p-1.5 rounded-lg bg-[#0a0a0a] text-[#fafafa] disabled:opacity-40 hover:bg-[#333] transition-colors"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
