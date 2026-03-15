'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Plus, Trash2 } from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import ReactMarkdown from 'react-markdown'

interface Agent {
  _id: string
  title: string
  lastModified: number
}

function getMessageText(msg: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!msg.parts) return ''
  return msg.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text || '')
    .join('')
}

const SUGGESTIONS = [
  'Connect Slack and summarize my unread messages',
  'Search my connected apps for the latest customer feedback',
  'Find the last email from a vendor and summarize it',
  'Connect a tool I need and then use it to finish my task',
]

export default function AgentChat() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/app/agent' }),
  })
  const isLoading = status === 'streaming' || status === 'submitted'
  const lastMessage = messages[messages.length - 1]
  const showLoadingIndicator =
    isLoading &&
    !(
      lastMessage?.role === 'assistant' &&
      getMessageText(lastMessage).trim().length > 0
    )

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/app/agents')
      if (res.ok) setAgents(await res.json())
    } catch {
      // ignore
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAgents() }, [loadAgents])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function createNewAgent(): Promise<string | null> {
    const res = await fetch('/api/app/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Agent' }),
    })
    if (res.ok) {
      const data = await res.json()
      setActiveAgentId(data.id)
      setMessages([])
      await loadAgents()
      return data.id
    }
    return null
  }

  async function loadAgent(agentId: string) {
    setActiveAgentId(agentId)
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
      setMessages([])
    }
    await loadAgents()
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    const agentId = activeAgentId || await createNewAgent()
    if (!agentId) return
    setInput('')
    await sendMessage(
      { role: 'user', parts: [{ type: 'text', text }] },
      { body: { agentId } }
    )
    loadAgents()
  }

  return (
    <div className="flex h-full">
      {/* Agent history sidebar */}
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

      {/* Main agent area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-4">
            {messages.length === 0 && (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center max-w-xl">
                  <p className="text-3xl mb-3" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
                    agent
                  </p>
                  <p className="text-sm text-[#888] mb-6">
                    A simple AI agent
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

              return (
                <div key={msg.id}>
                  {msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[75%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm bg-[#0a0a0a] text-[#fafafa]">
                        <span className="whitespace-pre-wrap">{text}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {toolParts.map((part, i) => {
                        const tp = part as { type: string; toolInvocation?: { toolName: string; state: string } }
                        return (
                          <div key={i} className="flex justify-center">
                            <div className="flex items-center gap-2 text-xs text-[#888] bg-[#f5f5f5] rounded-lg px-3 py-2">
                              <span className="text-[#aaa]">⚙</span>
                              <span className="font-medium">{tp.toolInvocation?.toolName}</span>
                              {tp.toolInvocation?.state === 'result' && <span className="text-[#aaa]">- done</span>}
                            </div>
                          </div>
                        )
                      })}
                      {text && (
                        <div className="flex justify-center">
                          <div className="max-w-[85%] px-1 py-1 text-sm leading-relaxed text-[#0a0a0a]">
                            <div className="markdown-content">
                              <ReactMarkdown>{text}</ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {showLoadingIndicator && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 text-xs text-[#888]">
                  <Loader2 size={12} className="animate-spin" />
                  Agent is working...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="mx-auto w-full max-w-4xl">
            <div className="flex items-end gap-2 bg-[#f0f0f0] rounded-2xl px-4 py-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the agent to do something..."
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                className="flex-1 bg-transparent text-sm text-[#0a0a0a] placeholder-[#aaa] resize-none outline-none max-h-32"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 p-1.5 rounded-lg bg-[#0a0a0a] text-[#fafafa] disabled:opacity-40 hover:bg-[#333] transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
