import {
  DefaultChatTransport,
  type ChatTransport,
  type HttpChatTransportInitOptions,
  type UIMessage,
  type UIMessageChunk,
} from 'ai'

type ChatBody = object | undefined

type CloudflareChatTransportOptions<UI_MESSAGE extends UIMessage> =
  HttpChatTransportInitOptions<UI_MESSAGE> & {
    relayApi: string
  }

function normalizeRelayApi(value: string): string {
  return value.replace(/\/+$/, '')
}

export function getCloudflareChatStreamRelayApi(): string | null {
  const configured = process.env.NEXT_PUBLIC_CHAT_STREAM_RELAY_URL?.trim()
  return configured ? normalizeRelayApi(configured) : null
}

function streamLogFields(body: ChatBody): Record<string, unknown> {
  const record = body as Record<string, unknown> | undefined
  return {
    conversationId: typeof record?.conversationId === 'string' ? record.conversationId : undefined,
    turnId: typeof record?.turnId === 'string' ? record.turnId : undefined,
    mode: typeof record?.mode === 'string' ? record.mode : undefined,
    automationMode: typeof record?.automationMode === 'boolean' ? record.automationMode : undefined,
    variantIndex: typeof record?.multiModelSlotIndex === 'number'
      ? record.multiModelSlotIndex
      : typeof record?.variantIndex === 'number'
        ? record.variantIndex
        : undefined,
  }
}

function logStreamCompletion(
  stream: ReadableStream<UIMessageChunk>,
  path: 'cloudflare' | 'convex-fallback',
  body: ChatBody,
): ReadableStream<UIMessageChunk> {
  return stream.pipeThrough(new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform(chunk, controller) {
      controller.enqueue(chunk)
    },
    flush() {
      console.info(`[chat-stream] path=${path} complete`, streamLogFields(body))
    },
  }))
}

export function createPersistentChatTransport<UI_MESSAGE extends UIMessage>(
  options: HttpChatTransportInitOptions<UI_MESSAGE>,
): ChatTransport<UI_MESSAGE> {
  const relayApi = getCloudflareChatStreamRelayApi()
  if (!relayApi) return new DefaultChatTransport(options)
  return new CloudflareChatTransport({ ...options, relayApi })
}

class CloudflareChatTransport<UI_MESSAGE extends UIMessage>
  extends DefaultChatTransport<UI_MESSAGE>
  implements ChatTransport<UI_MESSAGE>
{
  private readonly fallbackTransport: DefaultChatTransport<UI_MESSAGE>
  private readonly relayTransport: DefaultChatTransport<UI_MESSAGE>
  private readonly relayApi: string

  constructor(options: CloudflareChatTransportOptions<UI_MESSAGE>) {
    const { relayApi, prepareSendMessagesRequest, api = '/api/app/conversations/act', ...rest } = options
    super({ api, ...rest })
    this.relayApi = normalizeRelayApi(relayApi)
    this.fallbackTransport = new DefaultChatTransport({
      api,
      prepareSendMessagesRequest,
      ...rest,
    })
    this.relayTransport = new DefaultChatTransport({
      api: `${this.relayApi}/start`,
      prepareSendMessagesRequest: async (request) => {
        const prepared = await prepareSendMessagesRequest?.({
          ...request,
          api,
        })
        const preparedBody = prepared?.body ?? {
          ...request.body,
          id: request.id,
          messages: request.messages,
          trigger: request.trigger,
          messageId: request.messageId,
        }
        return {
          api: `${this.relayApi}/start`,
          credentials: prepared?.credentials ?? request.credentials ?? 'same-origin',
          headers: prepared?.headers ?? request.headers,
          body: {
            ...preparedBody,
            streamPersistenceMode: 'cloudflare-relay',
          },
        }
      },
      ...rest,
    })
  }

  async sendMessages(
    options: Parameters<ChatTransport<UI_MESSAGE>['sendMessages']>[0],
  ): Promise<ReadableStream<UIMessageChunk>> {
    console.info('[chat-stream] path=cloudflare start', streamLogFields(options.body))
    try {
      const stream = await this.relayTransport.sendMessages(options)
      console.info('[chat-stream] path=cloudflare connected', streamLogFields(options.body))
      return logStreamCompletion(stream, 'cloudflare', options.body)
    } catch (error) {
      console.warn('[chat-stream] path=convex-fallback fallback', {
        ...streamLogFields(options.body),
        reason: error instanceof Error ? error.message : String(error),
      })
      const fallbackStream = await this.fallbackTransport.sendMessages(options)
      return logStreamCompletion(fallbackStream, 'convex-fallback', options.body)
    }
  }

  async reconnectToStream(
    options: Parameters<ChatTransport<UI_MESSAGE>['reconnectToStream']>[0],
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    console.info('[chat-stream] path=cloudflare resume', streamLogFields(options.body))
    const response = await fetch(`${this.relayApi}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        ...(options.body ?? {}),
        id: options.chatId,
      }),
    })

    if (response.status === 204) {
      console.info('[chat-stream] path=cloudflare resume-empty', streamLogFields(options.body))
      return null
    }

    if (!response.ok) {
      throw new Error((await response.text()) || 'Failed to resume chat stream.')
    }

    if (!response.body) {
      throw new Error('The response body is empty.')
    }

    return logStreamCompletion(this.processResponseStream(response.body), 'cloudflare', options.body)
  }
}
