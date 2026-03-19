import { NextRequest, NextResponse } from 'next/server'
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai'
import { convex } from '@/lib/convex'
import { getSession } from '@/lib/workos-auth'
import { DEFAULT_MODEL_ID, getModel } from '@/lib/models'

export const maxDuration = 300

interface ComputerConnectionInfo {
  gatewayToken: string
  hooksToken: string
  hetznerServerIp: string
}

interface ToolInvokeResponse<T> {
  ok?: boolean
  result?: T
  error?: {
    message?: string
  }
}

interface SessionStatusToolResult {
  content?: Array<{
    type?: string
    text?: string
  }>
  details?: {
    statusText?: string
  }
}

interface GatewaySessionModelState {
  sessionKey: string
  provider?: string
  model?: string
}

interface HookAgentResponse {
  ok?: boolean
  runId?: string
  error?: string
}

interface OpenClawTranscriptMessage {
  role?: string
  provider?: string
  model?: string
  content?: Array<{
    type?: string
    text?: string
  }>
  __openclaw?: {
    seq?: number
    id?: string
  }
}

interface SessionHistoryResponse {
  sessionKey?: string
  items?: OpenClawTranscriptMessage[]
  messages?: OpenClawTranscriptMessage[]
}

interface SessionHistoryEvent {
  event: string
  data: unknown
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messages, computerId, modelId }: {
      messages: UIMessage[]
      computerId?: string
      modelId?: string
    } = await request.json()

    if (!computerId) {
      return NextResponse.json({ error: 'Computer ID is required' }, { status: 400 })
    }

    const latestUserText = extractLatestUserText(messages)
    if (!latestUserText) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }

    const userId = session.user.id
    const accessToken = session.accessToken

    const connection = await convex.query<ComputerConnectionInfo>(
      'computers:getChatConnection',
      {
        computerId,
        userId,
        accessToken,
      },
      { throwOnError: true, timeoutMs: 30_000 }
    )

    if (!connection) {
      return NextResponse.json({ error: 'Computer is not ready' }, { status: 400 })
    }

    await convex.mutation(
      'computers:addChatMessage',
      {
        computerId,
        userId,
        accessToken,
        role: 'user',
        content: latestUserText,
      },
      { throwOnError: true, timeoutMs: 30_000 }
    )

    const sessionKey = getComputerSessionKey(userId, computerId)
    const selectedModelId = modelId?.trim() || DEFAULT_MODEL_ID
    const requestedModelRef =
      resolveOpenClawModelRef(selectedModelId) ?? resolveOpenClawModelRef(DEFAULT_MODEL_ID)
    const baselineHistory = await fetchSessionHistorySnapshot({
      ip: connection.hetznerServerIp,
      gatewayToken: connection.gatewayToken,
      sessionKey,
    })
    const baselineSeq = getHighestTranscriptSeq(baselineHistory.messages)
    const hookMessage = buildHookMessage({
      messages,
      latestUserText,
      sessionHasHistory: baselineHistory.messages.length > 0,
    })

    const stream = createUIMessageStream<UIMessage>({
      originalMessages: messages,
      execute: async ({ writer }) => {
        const textId = crypto.randomUUID()
        let assistantText = ''

        try {
          writer.write({ type: 'text-start', id: textId })

          await invokeOpenClawAgentHook({
            ip: connection.hetznerServerIp,
            hooksToken: connection.hooksToken,
            sessionKey,
            message: hookMessage,
            model: requestedModelRef,
          })

          assistantText = await streamAssistantReplyFromSession({
            ip: connection.hetznerServerIp,
            gatewayToken: connection.gatewayToken,
            sessionKey,
            baselineSeq,
            onText: (delta) => {
              if (!delta) return
              writer.write({ type: 'text-delta', id: textId, delta })
            },
          })

          writer.write({ type: 'text-end', id: textId })

          const finalText = assistantText.trim()
          if (!finalText) {
            throw new Error('OpenClaw returned an empty response.')
          }

          await convex.mutation(
            'computers:addChatMessage',
            {
              computerId,
              userId,
              accessToken,
              role: 'assistant',
              content: finalText,
            },
            { throwOnError: true, timeoutMs: 30_000 }
          )

          const latestHistory = await fetchSessionHistorySnapshot({
            ip: connection.hetznerServerIp,
            gatewayToken: connection.gatewayToken,
            sessionKey,
          }).catch(() => null)
          const latestAssistantMessage = latestHistory
            ? findAssistantMessageAfterSeq(latestHistory.messages, baselineSeq)
            : null
          const latestSessionModel = await readGatewaySessionModel({
            ip: connection.hetznerServerIp,
            gatewayToken: connection.gatewayToken,
            sessionKey,
          }).catch(() => null)

          await convex.mutation(
            'computers:setChatRuntimeState',
            {
              computerId,
              userId,
              accessToken,
              sessionKey: latestSessionModel?.sessionKey ?? sessionKey,
              requestedModelId: selectedModelId,
              requestedModelRef: requestedModelRef ?? undefined,
              effectiveProvider: latestAssistantMessage?.provider ?? latestSessionModel?.provider,
              effectiveModel: latestAssistantMessage?.model ?? latestSessionModel?.model,
            },
            { throwOnError: true, timeoutMs: 30_000 }
          )
        } catch (error) {
          const message = getErrorMessage(error)
          await convex.mutation(
            'computers:addChatError',
            {
              computerId,
              userId,
              accessToken,
              message: `Error: ${message}`,
            },
            { throwOnError: true, timeoutMs: 30_000 }
          )
          throw error
        }
      },
      onError: (error) => getErrorMessage(error),
    })

    return createUIMessageStreamResponse({ stream })
  } catch (error) {
    console.error('[Computer Chat API] Error:', error)
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

function extractTextFromUiMessage(message: UIMessage | undefined): string {
  if (!message?.parts) return ''
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim()
}

function extractLatestUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') {
      return extractTextFromUiMessage(messages[i])
    }
  }
  return ''
}

function buildHookMessage(params: {
  messages: UIMessage[]
  latestUserText: string
  sessionHasHistory: boolean
}): string {
  if (params.sessionHasHistory) {
    return params.latestUserText
  }

  const transcript = params.messages
    .map((message) => {
      const text = extractTextFromUiMessage(message)
      if (!text) {
        return null
      }

      if (message.role === 'user') {
        return `User: ${text}`
      }
      if (message.role === 'assistant') {
        return `Assistant: ${text}`
      }
      if (message.role === 'system') {
        return `System: ${text}`
      }
      return null
    })
    .filter((line): line is string => Boolean(line))
    .join('\n\n')
    .trim()

  if (!transcript || transcript === `User: ${params.latestUserText}`) {
    return params.latestUserText
  }

  return [
    'Use the following transcript as prior conversation context and continue naturally.',
    'Respond only to the latest user message.',
    '',
    transcript,
  ].join('\n')
}

async function fetchSessionHistorySnapshot(params: {
  ip: string
  gatewayToken: string
  sessionKey: string
}): Promise<{ sessionKey: string; messages: OpenClawTranscriptMessage[] }> {
  const response = await fetch(
    `http://${params.ip}:18789/sessions/${encodeURIComponent(params.sessionKey)}/history`,
    {
      headers: {
        Authorization: `Bearer ${params.gatewayToken}`,
      },
      signal: AbortSignal.timeout(30_000),
    }
  )

  if (response.status === 404) {
    return { sessionKey: params.sessionKey, messages: [] }
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load OpenClaw session history: ${response.status} ${await response.text()}`
    )
  }

  const body = (await response.json()) as SessionHistoryResponse
  return {
    sessionKey: body.sessionKey?.trim() || params.sessionKey,
    messages: normalizeTranscriptMessages(body),
  }
}

async function invokeOpenClawAgentHook(params: {
  ip: string
  hooksToken: string
  sessionKey: string
  message: string
  model?: string | null
}) {
  const response = await fetch(`http://${params.ip}:18789/hooks/agent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.hooksToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      message: params.message,
      name: 'Overlay Computer Chat',
      sessionKey: params.sessionKey,
      wakeMode: 'now',
      deliver: false,
      timeoutSeconds: 240,
      ...(params.model ? { model: params.model } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (response.status === 404) {
    throw new Error(
      'This computer was provisioned before Overlay webhook chat support. Delete and recreate it to enable in-page OpenClaw chat.'
    )
  }

  if (response.status === 401) {
    throw new Error('OpenClaw webhook authentication failed.')
  }

  const responseText = await response.text()
  let parsedBody: HookAgentResponse | null = null

  try {
    parsedBody = JSON.parse(responseText) as HookAgentResponse
  } catch {
    parsedBody = null
  }

  const recreateError =
    parsedBody?.error?.includes('hooks.allowRequestSessionKey') ||
    parsedBody?.error?.includes('sessionKey must start with one of')

  if (!response.ok) {
    if (recreateError) {
      throw new Error(
        'This computer was provisioned before Overlay webhook session support. Delete and recreate it to enable model-aware in-page OpenClaw chat.'
      )
    }
    throw new Error(parsedBody?.error || `Webhook returned ${response.status}: ${responseText}`)
  }

  if (parsedBody?.ok !== true) {
    throw new Error(parsedBody?.error || 'OpenClaw rejected the webhook request.')
  }
}

async function streamAssistantReplyFromSession(params: {
  ip: string
  gatewayToken: string
  sessionKey: string
  baselineSeq: number
  onText: (delta: string) => void
}): Promise<string> {
  const deadline = Date.now() + 240_000

  while (Date.now() < deadline) {
    const remainingMs = Math.max(1_000, deadline - Date.now())
    const response = await fetch(
      `http://${params.ip}:18789/sessions/${encodeURIComponent(params.sessionKey)}/history`,
      {
        headers: {
          Authorization: `Bearer ${params.gatewayToken}`,
          Accept: 'text/event-stream',
        },
        signal: AbortSignal.timeout(remainingMs),
      }
    )

    if (response.status === 404) {
      await sleep(500)
      continue
    }

    if (!response.ok) {
      throw new Error(
        `Failed to stream OpenClaw session history: ${response.status} ${await response.text()}`
      )
    }

    if (!response.body) {
      throw new Error('OpenClaw session history stream was empty.')
    }

    const text = await waitForAssistantMessageFromHistoryStream({
      stream: response.body,
      baselineSeq: params.baselineSeq,
      onText: params.onText,
    })

    if (text) {
      return text
    }
  }

  throw new Error('OpenClaw accepted the webhook request but did not append an assistant reply.')
}

async function waitForAssistantMessageFromHistoryStream(params: {
  stream: ReadableStream<Uint8Array>
  baselineSeq: number
  onText: (delta: string) => void
}): Promise<string | null> {
  const reader = params.stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let emittedText = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        return emittedText || null
      }

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''

      for (const event of events) {
        const parsed = parseSessionHistoryEvent(event)
        if (!parsed) {
          continue
        }

        const assistantMessage = findAssistantMessageAfterSeq(parsed.data, params.baselineSeq)
        if (!assistantMessage) {
          continue
        }

        const nextText = extractTranscriptMessageText(assistantMessage)
        if (!nextText) {
          continue
        }

        const delta = nextText.startsWith(emittedText) ? nextText.slice(emittedText.length) : nextText
        if (delta) {
          params.onText(delta)
        }
        emittedText = nextText
        return emittedText
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function parseSessionHistoryEvent(rawEvent: string): SessionHistoryEvent | null {
  const lines = rawEvent.split('\n')
  const eventName = lines
    .find((line) => line.startsWith('event:'))
    ?.slice(6)
    .trim()
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n')

  if (!eventName || !data) {
    return null
  }

  try {
    return {
      event: eventName,
      data: JSON.parse(data),
    }
  } catch {
    return null
  }
}

function normalizeTranscriptMessages(payload: SessionHistoryResponse): OpenClawTranscriptMessage[] {
  const messages = payload.messages ?? payload.items ?? []
  return Array.isArray(messages) ? messages : []
}

function getHighestTranscriptSeq(messages: OpenClawTranscriptMessage[]): number {
  return messages.reduce((highest, message) => {
    const seq = typeof message.__openclaw?.seq === 'number' ? message.__openclaw.seq : 0
    return seq > highest ? seq : highest
  }, 0)
}

function findAssistantMessageAfterSeq(
  payload: unknown,
  baselineSeq: number
): OpenClawTranscriptMessage | null {
  const candidates: OpenClawTranscriptMessage[] = []

  if (payload && typeof payload === 'object') {
    const maybePayload = payload as {
      message?: OpenClawTranscriptMessage
      messages?: OpenClawTranscriptMessage[]
      items?: OpenClawTranscriptMessage[]
    }

    if (maybePayload.message) {
      candidates.push(maybePayload.message)
    }
    if (Array.isArray(maybePayload.messages)) {
      candidates.push(...maybePayload.messages)
    }
    if (Array.isArray(maybePayload.items)) {
      candidates.push(...maybePayload.items)
    }
  }

  let latestAssistant: OpenClawTranscriptMessage | null = null
  let latestSeq = baselineSeq

  for (const message of candidates) {
    if (message.role !== 'assistant') {
      continue
    }
    const seq = typeof message.__openclaw?.seq === 'number' ? message.__openclaw.seq : 0
    if (seq <= baselineSeq || seq < latestSeq) {
      continue
    }
    latestAssistant = message
    latestSeq = seq
  }

  return latestAssistant
}

function extractTranscriptMessageText(message: OpenClawTranscriptMessage | null | undefined): string {
  if (!message || !Array.isArray(message.content)) {
    return ''
  }

  return message.content
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text || '')
    .join('')
    .trim()
}

function getComputerSessionKey(userId: string, computerId: string): string {
  return `hook:computer:v1:${userId}:${computerId}`
}

function resolveOpenClawModelRef(modelId: string): string | null {
  const model = getModel(modelId)
  return model?.openClawRef ?? null
}

async function readGatewaySessionModel(params: {
  ip: string
  gatewayToken: string
  sessionKey: string
}): Promise<GatewaySessionModelState | null> {
  return await invokeSessionStatusTool({
    ip: params.ip,
    gatewayToken: params.gatewayToken,
    sessionKey: params.sessionKey,
  })
}

async function invokeSessionStatusTool(params: {
  ip: string
  gatewayToken: string
  sessionKey: string
  model?: string
}): Promise<GatewaySessionModelState | null> {
  const response = await fetch(`http://${params.ip}:18789/tools/invoke`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.gatewayToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tool: 'session_status',
      sessionKey: params.sessionKey,
      args: {
        sessionKey: params.sessionKey,
        ...(params.model ? { model: params.model } : {}),
      },
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    return null
  }

  try {
    const body = (await response.json()) as ToolInvokeResponse<SessionStatusToolResult>
    if (body.ok !== true) {
      return null
    }

    const statusText =
      body.result?.details?.statusText ||
      body.result?.content
        ?.filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text || '')
        .join('\n') ||
      ''

    const parsed = parseModelFromStatusText(statusText)
    return {
      sessionKey: params.sessionKey,
      provider: parsed?.provider,
      model: parsed?.model,
    }
  } catch {
    return null
  }
}

function parseModelFromStatusText(statusText: string): { provider?: string; model?: string } | null {
  const modelLine = statusText
    .split('\n')
    .find((line) => line.trim().startsWith('🧠 Model:'))

  if (!modelLine) {
    return null
  }

  const rawLabel = modelLine.replace(/^🧠 Model:\s*/, '').split(' · ')[0]?.trim()
  if (!rawLabel) {
    return null
  }

  const slashIndex = rawLabel.indexOf('/')
  if (slashIndex === -1) {
    return { model: rawLabel }
  }

  return {
    provider: rawLabel.slice(0, slashIndex).trim() || undefined,
    model: rawLabel.slice(slashIndex + 1).trim() || undefined,
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'OpenClaw request timed out after 4 minutes.'
  }
  return error instanceof Error ? error.message : 'Computer chat request failed'
}
