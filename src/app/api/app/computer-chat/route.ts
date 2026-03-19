import { NextRequest, NextResponse } from 'next/server'
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai'
import { convex } from '@/lib/convex'
import { getSession } from '@/lib/workos-auth'
import { DEFAULT_MODEL_ID, getModel } from '@/lib/models'

export const maxDuration = 300

interface ComputerConnectionInfo {
  gatewayToken: string
  hetznerServerIp: string
}

interface OpenClawSSEChunk {
  choices?: Array<{
    delta?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
    finish_reason?: string | null
  }>
}

interface OpenClawChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
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

    const openClawMessages = serializeMessagesForOpenClaw(messages)
    const latestUserText = extractLatestUserText(openClawMessages)

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
    const modelCandidates = getComputerModelCandidates(selectedModelId)

    let upstreamResponse: Response | null = null
    const failures: string[] = []
    let succeededModelRef: string | null = null
    let canRetryWithModelFallbacks = true

    for (const candidate of modelCandidates) {
      try {
        const modelOverrideApplied = await applySessionModelOverrideBestEffort({
          ip: connection.hetznerServerIp,
          gatewayToken: connection.gatewayToken,
          sessionKey,
          model: candidate.ref,
        })
        canRetryWithModelFallbacks = modelOverrideApplied

        const response = await fetch(
          `http://${connection.hetznerServerIp}:18789/v1/chat/completions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${connection.gatewayToken}`,
              'Content-Type': 'application/json',
              'x-openclaw-agent-id': 'default',
              'x-openclaw-session-key': sessionKey,
            },
            body: JSON.stringify({
              model: 'openclaw:default',
              user: sessionKey,
              stream: true,
              messages: openClawMessages,
            }),
            signal: AbortSignal.timeout(240_000),
          }
        )

        if (!response.ok) {
          const responseText = await response.text()

          if (response.status === 404) {
            return NextResponse.json(
              {
                error:
                  'This computer was provisioned before Overlay streaming chat support. Delete and recreate it to enable in-page OpenClaw chat.',
              },
              { status: 404 }
            )
          }

          if (response.status === 401) {
            return NextResponse.json(
              { error: 'OpenClaw gateway authentication failed.' },
              { status: 401 }
            )
          }

          const failure = `${candidate.ref}: HTTP ${response.status} ${responseText}`
          failures.push(failure)
          if (response.status >= 500) {
            continue
          }

          return NextResponse.json(
            { error: `Gateway returned ${response.status}: ${responseText}` },
            { status: response.status }
          )
        }

        upstreamResponse = response
        succeededModelRef = modelOverrideApplied ? candidate.ref : null
        break
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push(`${candidate.ref}: ${message}`)
        if (!canRetryWithModelFallbacks) {
          break
        }
      }
    }

    if (!upstreamResponse || !upstreamResponse.body) {
      throw new Error(buildComputerChatFailureMessage(selectedModelId, failures))
    }

    const stream = createUIMessageStream<UIMessage>({
      originalMessages: messages,
      execute: async ({ writer }) => {
        const textId = crypto.randomUUID()
        let assistantText = ''

        try {
          writer.write({ type: 'text-start', id: textId })

          for await (const delta of streamOpenClawText(upstreamResponse.body!)) {
            if (!delta) continue
            assistantText += delta
            writer.write({ type: 'text-delta', id: textId, delta })
          }

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
              requestedModelRef: modelCandidates[0]?.ref ?? succeededModelRef ?? undefined,
              effectiveProvider: latestSessionModel?.provider,
              effectiveModel: latestSessionModel?.model,
            },
            { throwOnError: true, timeoutMs: 30_000 }
          )

          if (succeededModelRef && succeededModelRef !== modelCandidates[0]?.ref) {
            await convex.mutation(
              'computers:addChatError',
              {
                computerId,
                userId,
                accessToken,
                message: `Selected model was unavailable. OpenClaw replied using fallback model ${succeededModelRef}.`,
              },
              { throwOnError: true, timeoutMs: 30_000 }
            )
          }
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

function serializeMessagesForOpenClaw(messages: UIMessage[]): OpenClawChatMessage[] {
  return messages
    .map((message) => {
      const text = extractTextFromUiMessage(message)
      if (!text) {
        return null
      }

      if (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'system') {
        return null
      }

      return {
        role: message.role,
        content: text,
      } satisfies OpenClawChatMessage
    })
    .filter((message): message is OpenClawChatMessage => message !== null)
}

function extractTextFromUiMessage(message: UIMessage | undefined): string {
  if (!message?.parts) return ''
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim()
}

function extractLatestUserText(messages: OpenClawChatMessage[]): string {
  return [...messages]
    .reverse()
    .find((message) => message.role === 'user')
    ?.content.trim() ?? ''
}

async function* streamOpenClawText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''

      for (const event of events) {
        const parsed = parseOpenClawEvent(event)
        if (parsed === '[DONE]') {
          return
        }
        if (!parsed) {
          continue
        }
        yield extractStreamDelta(parsed)
      }
    }

    const tail = buffer.trim()
    if (tail) {
      const parsed = parseOpenClawEvent(tail)
      if (parsed && parsed !== '[DONE]') {
        yield extractStreamDelta(parsed)
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function parseOpenClawEvent(event: string): OpenClawSSEChunk | '[DONE]' | null {
  const dataLines = event
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())

  if (dataLines.length === 0) {
    return null
  }

  const payload = dataLines.join('\n')
  if (payload === '[DONE]') {
    return '[DONE]'
  }

  try {
    return JSON.parse(payload) as OpenClawSSEChunk
  } catch {
    return null
  }
}

function extractStreamDelta(chunk: OpenClawSSEChunk): string {
  const content = chunk.choices?.[0]?.delta?.content
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return ''
  }
  return content
    .map((part) => (part?.type === 'text' && typeof part.text === 'string' ? part.text : ''))
    .join('')
}

function getComputerSessionKey(userId: string, computerId: string): string {
  return `computer:v2:${userId}:${computerId}`
}

function resolveOpenClawModelRef(modelId: string): string | null {
  const model = getModel(modelId)
  if (!model) {
    return null
  }

  if (model.provider === 'openrouter') {
    return model.id
  }

  if (model.id.includes('/')) {
    return `vercel-ai-gateway/${model.id}`
  }

  return `vercel-ai-gateway/${model.provider}/${model.id}`
}

function getComputerModelCandidates(selectedModelId: string): Array<{ id: string; ref: string }> {
  const candidates = [selectedModelId, DEFAULT_MODEL_ID, 'openrouter/free']
  const seen = new Set<string>()
  const resolved: Array<{ id: string; ref: string }> = []

  for (const candidateId of candidates) {
    const ref = resolveOpenClawModelRef(candidateId)
    if (!ref || seen.has(ref)) {
      continue
    }
    seen.add(ref)
    resolved.push({ id: candidateId, ref })
  }

  return resolved
}

function buildComputerChatFailureMessage(selectedModelId: string, failures: string[]): string {
  const detail = failures.length > 0 ? failures.join(' | ') : 'no fallback details'
  return `OpenClaw could not reply to this request using the selected model "${selectedModelId}". Retried the configured fallback models, but all attempts failed. Details: ${detail}`
}

async function applySessionModelOverrideBestEffort(params: {
  ip: string
  gatewayToken: string
  sessionKey: string
  model: string
}): Promise<boolean> {
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
        model: params.model,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    return false
  }

  try {
    const body = (await response.json()) as ToolInvokeResponse<SessionStatusToolResult>
    return body.ok === true
  } catch {
    return false
  }
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'OpenClaw request timed out after 4 minutes.'
  }
  return error instanceof Error ? error.message : 'Computer chat request failed'
}
