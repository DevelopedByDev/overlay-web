'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DefaultChatTransport } from 'ai'
import { useChat } from '@ai-sdk/react'
import { AlertCircle, ChevronDown, Loader2, Send } from 'lucide-react'
import { convex } from '@/lib/convex'
import { MarkdownMessage } from '@/components/app/MarkdownMessage'
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '@/lib/models'

type ComputerStatus =
  | 'pending_payment'
  | 'provisioning'
  | 'ready'
  | 'error'
  | 'past_due'
  | 'deleted'

interface Computer {
  _id: string
  name: string
  status: ComputerStatus
  provisioningStep?: string
  errorMessage?: string
  hetznerServerIp?: string
  pastDueAt?: number
  chatSessionKey?: string
  chatRequestedModelId?: string
  chatRequestedModelRef?: string
  chatEffectiveModel?: string
  chatEffectiveProvider?: string
  chatModelResolvedAt?: number
}

interface LogEvent {
  _id: string
  type: string
  message: string
  createdAt: number
}

interface PersistedChatMessage {
  _id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  isError?: boolean
}

const COMPUTER_MODEL_KEY = 'overlay_agent_model'

function stepIndex(step?: string): number {
  if (!step) return 0
  const map: Record<string, number> = {
    creating_server: 1,
    server_created: 2,
    openclaw_starting: 3,
  }
  return map[step] ?? 0
}

function getMessageText(msg: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!msg.parts) return ''
  return msg.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text || '')
    .join('')
}

function ProvisioningView({ step, logs }: { step?: string; logs: LogEvent[] }) {
  const current = stepIndex(step)
  const labels = ['Paid', 'Server', 'Docker', 'Ready']
  const messages: Record<string, string> = {
    creating_server: 'Creating server on Hetzner... (1-2 min)',
    server_created: 'Pulling OpenClaw image and writing gateway config...',
    openclaw_starting: 'Starting OpenClaw gateway and waiting for healthz...',
  }
  const terminalRef = useRef<HTMLDivElement>(null)

  const lines = logs
    .filter((event) => event.type === 'provisioning_log' || event.type === 'provision_log')
    .flatMap((event) => event.message.split('\n'))

  useEffect(() => {
    if (!terminalRef.current) return
    terminalRef.current.scrollTop = terminalRef.current.scrollHeight
  }, [lines.length])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col items-center gap-6 px-8 pb-6 pt-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-0">
            {labels.map((label, index) => {
              const done = index < current
              const active = index === current
              return (
                <div key={label} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`h-3 w-3 rounded-full border-2 transition-all ${
                        done
                          ? 'border-[#0a0a0a] bg-[#0a0a0a]'
                          : active
                            ? 'border-[#0a0a0a] bg-white ring-2 ring-[#0a0a0a]/20'
                            : 'border-[#ddd] bg-white'
                      }`}
                    />
                    <span
                      className={`text-[10px] ${
                        done || active ? 'font-medium text-[#0a0a0a]' : 'text-[#bbb]'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {index < labels.length - 1 && (
                    <div
                      className={`mx-1 mb-4 h-px flex-1 ${
                        index < current ? 'bg-[#0a0a0a]' : 'bg-[#e5e5e5]'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>

          <div className="space-y-1 text-center">
            <p className="text-sm text-[#525252]">
              {step ? messages[step] ?? 'Setting up your computer...' : 'Waiting for server creation...'}
            </p>
            <p className="text-xs text-[#aaa]">This usually takes 10-15 minutes in total</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-6 pb-6">
        <div
          ref={terminalRef}
          className="h-full overflow-y-auto rounded-xl bg-[#0a0a0a] p-4 font-mono text-xs leading-relaxed"
        >
          {lines.length === 0 ? (
            <span className="text-[#444]">Waiting for VPS setup logs...</span>
          ) : (
            lines.map((line, index) => (
              <div key={index} className="whitespace-pre text-[#4ade80]">
                {line || '\u00a0'}
              </div>
            ))
          )}
          <div className="ml-0.5 inline-block h-3.5 w-2 animate-pulse bg-[#4ade80] align-text-bottom" />
        </div>
      </div>
    </div>
  )
}

function mapPersistedMessages(messages: PersistedChatMessage[]) {
  return messages
    .filter((message) => !message.isError)
    .map((message) => ({
      id: message._id,
      role: message.role,
      parts: [
        {
          type: 'text' as const,
          text: message.content,
        },
      ],
    }))
}

export default function ComputerDetailClient({
  computerId,
  userId,
  accessToken,
}: {
  computerId: string
  userId: string
  accessToken: string
}) {
  const searchParams = useSearchParams()
  const justPaid = searchParams.get('paid') === '1'
  const [now] = useState(Date.now)
  const [computer, setComputer] = useState<Computer | null | undefined>(undefined)
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_MODEL_ID
    return localStorage.getItem(COMPUTER_MODEL_KEY) || DEFAULT_MODEL_ID
  })
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [hydratedTranscript, setHydratedTranscript] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/app/computer-chat',
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            messages,
            computerId,
            modelId: selectedModel,
          },
        }),
      }),
    [computerId, selectedModel]
  )

  const { messages, sendMessage, setMessages, status, stop, error } = useChat({ transport })
  const isLoading = status === 'streaming' || status === 'submitted'
  const lastMessage = messages[messages.length - 1]
  const showLoadingIndicator =
    isLoading &&
    !(
      lastMessage?.role === 'assistant' &&
      getMessageText(lastMessage).trim().length > 0
    )

  const fetchComputer = useCallback(async () => {
    const result = await convex.query<Computer>('computers:get', {
      computerId,
      userId,
      accessToken,
    })
    setComputer(result)
  }, [accessToken, computerId, userId])

  const fetchLogs = useCallback(async () => {
    const result = await convex.query<LogEvent[]>('computers:listEvents', {
      computerId,
      userId,
      accessToken,
    })
    if (result) setLogs(result)
  }, [accessToken, computerId, userId])

  const hydrateMessages = useCallback(async () => {
    const result = await convex.query<PersistedChatMessage[]>('computers:listChatMessages', {
      computerId,
      userId,
      accessToken,
    })
    if (result) {
      setMessages(mapPersistedMessages(result))
    }
    setHydratedTranscript(true)
  }, [accessToken, computerId, setMessages, userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchComputer()
  }, [fetchComputer])

  useEffect(() => {
    if (computer === undefined) return

    const intervalMs =
      computer?.status === 'provisioning' || computer?.status === 'pending_payment' ? 4000 : 20000

    const intervalId = window.setInterval(() => {
      void fetchComputer()
    }, intervalMs)

    return () => window.clearInterval(intervalId)
  }, [computer, fetchComputer])

  useEffect(() => {
    if (computer?.status !== 'provisioning') return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLogs()
    const intervalId = window.setInterval(() => {
      void fetchLogs()
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [computer?.status, fetchLogs])

  useEffect(() => {
    if (computer?.status !== 'ready' || hydratedTranscript) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hydrateMessages()
  }, [computer?.status, hydrateMessages, hydratedTranscript])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const daysLeft = useMemo(() => {
    if (!computer?.pastDueAt) return null
    return Math.max(0, 7 - Math.floor((now - computer.pastDueAt) / (1000 * 60 * 60 * 24)))
  }, [computer?.pastDueAt, now])

  const errorMessage = error ? error.message : null
  const currentModel = AVAILABLE_MODELS.find((model) => model.id === selectedModel)
  const effectiveModelLabel =
    computer?.chatEffectiveProvider && computer?.chatEffectiveModel
      ? `${computer.chatEffectiveProvider}/${computer.chatEffectiveModel}`
      : computer?.chatRequestedModelRef || null
  const [input, setInput] = useState('')

  const submitMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    await sendMessage(
      {
        role: 'user',
        parts: [{ type: 'text', text }],
      },
      {
        body: {
          computerId,
          modelId: selectedModel,
        },
      }
    )
    await fetchComputer()
  }, [computerId, fetchComputer, input, isLoading, selectedModel, sendMessage])

  if (computer === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[#aaa]" />
      </div>
    )
  }

  if (computer === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#aaa]">Computer not found.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#e5e5e5] px-4">
        <h2 className="min-w-0 truncate text-sm font-medium text-[#0a0a0a]">{computer.name}</h2>

        {computer.status === 'ready' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-[#888]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#27ae60]" />
              Online{computer.hetznerServerIp ? ` · ${computer.hetznerServerIp}` : ''}
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="relative">
                <button
                  onClick={() => setShowModelPicker((current) => !current)}
                  className="flex items-center gap-1.5 rounded-md bg-[#f0f0f0] px-2.5 py-1 text-xs text-[#525252] transition-colors hover:bg-[#e8e8e8]"
                >
                  {currentModel?.name || 'Select model'}
                  <ChevronDown size={11} />
                </button>
                {showModelPicker && (
                  <div className="absolute right-0 top-full z-10 mt-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-[#e5e5e5] bg-white py-1 shadow-lg">
                    {AVAILABLE_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id)
                          localStorage.setItem(COMPUTER_MODEL_KEY, model.id)
                          setShowModelPicker(false)
                        }}
                        className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-[#f5f5f5] ${
                          model.id === selectedModel ? 'font-medium text-[#0a0a0a]' : 'text-[#525252]'
                        }`}
                      >
                        <span>{model.name}</span>
                        <span className="ml-2 text-[#aaa]">{model.provider}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {effectiveModelLabel && (
                <div className="text-[10px] text-[#9a9a9a]">
                  Actual: {effectiveModelLabel}
                </div>
              )}
            </div>
          </div>
        )}

        {computer.status === 'provisioning' && (
          <div className="flex items-center gap-2 text-xs text-[#f5a623]">
            <Loader2 size={11} className="animate-spin" />
            Setting up...
          </div>
        )}

        {computer.status === 'pending_payment' && (
          <div className="text-xs text-[#f5a623]">
            {justPaid ? 'Payment received - provisioning soon...' : 'Awaiting payment'}
          </div>
        )}
      </div>

      {(computer.status === 'pending_payment' || computer.status === 'provisioning') &&
        (computer.status === 'pending_payment' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <Loader2 size={24} className="animate-spin text-[#aaa]" />
            <p className="text-sm text-[#525252]">
              {justPaid
                ? 'Payment confirmed. Your server will start provisioning in a moment...'
                : 'Awaiting payment confirmation...'}
            </p>
            <p className="text-xs text-[#aaa]">This page will update automatically</p>
          </div>
        ) : (
          <ProvisioningView step={computer.provisioningStep} logs={logs} />
        ))}

      {computer.status === 'ready' && (
        <div className="flex min-h-0 flex-1 flex-col bg-[#fbfbfb]">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
              {messages.length === 0 && !isLoading && (
                <div className="rounded-2xl border border-dashed border-[#ddd] bg-white px-5 py-6 text-center">
                  <p className="text-sm text-[#444]">Your computer is ready.</p>
                  <p className="mt-1 text-xs text-[#888]">
                    Ask OpenClaw to inspect the machine, run setup steps, or help with tasks on the VPS.
                  </p>
                </div>
              )}

              {messages.map((message) => {
                const text = getMessageText(message)
                const isAssistantStreaming = isLoading && message.id === lastMessage?.id && message.role === 'assistant'

                return (
                  <div
                    key={message.id}
                    className={`flex message-appear ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'user' ? (
                      <div className="max-w-[75%] space-y-2">
                        {text && (
                          <div className="rounded-2xl rounded-br-sm bg-[#0a0a0a] px-4 py-2.5 text-sm text-[#fafafa]">
                            <span className="whitespace-pre-wrap">{text}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full space-y-2">
                        {text && (
                          <div className="w-full px-1 py-1 text-sm leading-relaxed text-[#0a0a0a]">
                            <MarkdownMessage text={text} isStreaming={isAssistantStreaming} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {showLoadingIndicator && (
                <div className="px-1 py-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#e0e0e0] border-t-[#525252]" />
                </div>
              )}

              {errorMessage && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                    <AlertCircle size={12} />
                    {errorMessage}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="mx-auto w-full max-w-4xl">
              <div className="flex items-end gap-2 rounded-2xl bg-[#f0f0f0] px-4 py-3">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask the computer to do something..."
                  rows={1}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void submitMessage()
                    }
                  }}
                  className="max-h-32 flex-1 resize-none bg-transparent text-sm text-[#0a0a0a] outline-none placeholder:text-[#aaa]"
                />
                {isLoading ? (
                  <button
                    onClick={() => stop()}
                    className="shrink-0 rounded-lg bg-[#0a0a0a] p-1.5 text-[#fafafa] transition-colors hover:bg-[#333]"
                    title="Stop generating"
                  >
                    <div className="h-3.5 w-3.5 rounded-sm bg-[#fafafa]" />
                  </button>
                ) : (
                  <button
                    onClick={() => void submitMessage()}
                    disabled={!input.trim()}
                    className="shrink-0 rounded-lg bg-[#0a0a0a] p-1.5 text-[#fafafa] transition-colors hover:bg-[#333] disabled:opacity-40"
                  >
                    <Send size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {computer.status === 'past_due' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <AlertCircle size={32} className="text-[#e74c3c]" strokeWidth={1.5} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#0a0a0a]">Payment failed</p>
            <p className="text-xs text-[#888]">
              {daysLeft !== null
                ? `Your computer will be deleted in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`
                : 'Your computer will be deleted soon.'}
            </p>
          </div>
          <a
            href="https://billing.stripe.com/p/login/test_00g00000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#0a0a0a] underline underline-offset-2"
          >
            Update payment method ↗
          </a>
        </div>
      )}

      {computer.status === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <AlertCircle size={32} className="text-[#e74c3c]" strokeWidth={1.5} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#0a0a0a]">Setup failed</p>
            <p className="text-xs text-[#888]">
              {computer.errorMessage ?? 'An unexpected error occurred.'}
            </p>
          </div>
          <p className="text-xs text-[#aaa]">Please contact support or delete and recreate.</p>
        </div>
      )}

      {computer.status === 'deleted' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-[#aaa]">This computer has been deleted.</p>
        </div>
      )}
    </div>
  )
}
