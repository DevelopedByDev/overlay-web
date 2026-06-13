import { DurableObject } from 'cloudflare:workers'

type Env = {
  CHAT_STREAMS: DurableObjectNamespace
  OVERLAY_NEXT_ORIGIN: string
  OVERLAY_APP_ORIGIN: string
  CHAT_STREAM_RELAY_SECRET: string
}

type StreamMetadata = {
  userId: string
  conversationId: string
  turnId: string
  variantIndex: number
}

type StreamDiagnostics = {
  modelId: string | null
  mode: string | null
}

type AuthorizedStream = StreamMetadata & {
  ok: true
}

type DurableObjectInput = {
  bodyText: string
  cookie: string
  idempotencyKey: string | null
  nextOrigin: string
  relaySecret: string
  requestId: string
  streamId: string
  userAgent: string
  metadata: StreamMetadata
  diagnostics: StreamDiagnostics
}

function buildActStreamIdempotencyKey(turnId: string, slotIndex: number): string {
  return `act:${turnId.trim()}:${Math.max(0, Math.floor(slotIndex))}`
}

type SessionRow = {
  stream_id: string
  user_id: string
  conversation_id: string
  turn_id: string
  variant_index: number
  status: 'active' | 'completed' | 'error'
  message_id: string | null
  partial_text: string
  frame_count: number
  created_at: number
  updated_at: number
  completed_at: number | null
  error_text: string | null
}

type FrameRow = {
  seq: number
  data: string
}

const STREAM_PATH_PREFIX = '/api/chat-stream/v1/streams'
const STREAM_TTL_MS = 60 * 60 * 1000
const encoder = new TextEncoder()

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

function relayError(params: {
  code: string
  error: string
  fallbackSafe: boolean
  phase: 'authorization' | 'configuration' | 'origin' | 'routing' | 'upstream' | 'validation'
  requestId: string
  status: number
  upstreamStatus?: number
}): Response {
  return json({
    code: params.code,
    error: params.error.slice(0, 500),
    fallbackSafe: params.fallbackSafe,
    phase: params.phase,
    requestId: params.requestId,
    upstreamStatus: params.upstreamStatus,
  }, {
    status: params.status,
    headers: { 'x-request-id': params.requestId },
  })
}

function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers)
  headers.set('x-request-id', requestId)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function requireEnv(env: Env): string | null {
  if (!env.OVERLAY_NEXT_ORIGIN?.trim()) return 'OVERLAY_NEXT_ORIGIN is not configured'
  if (!env.OVERLAY_APP_ORIGIN?.trim()) return 'OVERLAY_APP_ORIGIN is not configured'
  if (!env.CHAT_STREAM_RELAY_SECRET?.trim()) return 'CHAT_STREAM_RELAY_SECRET is not configured'
  return null
}

function isAllowedOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin')
  if (!origin) return true
  return origin === env.OVERLAY_APP_ORIGIN || origin === new URL(request.url).origin
}

function normalizeVariantIndex(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function parseStreamMetadata(body: Record<string, unknown>): Omit<StreamMetadata, 'userId'> | null {
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : ''
  const turnId = typeof body.turnId === 'string' ? body.turnId.trim() : ''
  if (!conversationId || !turnId) return null
  return {
    conversationId,
    turnId,
    variantIndex: normalizeVariantIndex(body.variantIndex ?? body.multiModelSlotIndex),
  }
}

function parseStreamDiagnostics(body: Record<string, unknown>): StreamDiagnostics {
  return {
    modelId: typeof body.modelId === 'string' ? body.modelId.slice(0, 160) : null,
    mode: typeof body.mode === 'string' ? body.mode.slice(0, 64) : null,
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const slice = bytes.subarray(index, index + 0x8000)
    binary += String.fromCharCode(...slice)
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function authorizeStream(
  env: Env,
  cookie: string,
  metadata: Omit<StreamMetadata, 'userId'>,
  requestId: string,
): Promise<AuthorizedStream | Response> {
  const response = await fetch(new URL('/api/v1/conversations/stream-auth', env.OVERLAY_NEXT_ORIGIN), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
      'x-overlay-chat-stream-relay': 'cloudflare',
      'x-overlay-chat-stream-secret': env.CHAT_STREAM_RELAY_SECRET,
    },
    body: JSON.stringify(metadata),
  })
  if (!response.ok) {
    console.warn('[chat-stream-worker] authorization rejected', {
      requestId,
      status: response.status,
      conversationId: metadata.conversationId,
      turnId: metadata.turnId,
      variantIndex: metadata.variantIndex,
    })
    return relayError({
      code: 'relay_authorization_failed',
      error: 'Chat stream authorization failed',
      fallbackSafe: true,
      phase: 'authorization',
      requestId,
      status: response.status,
    })
  }
  const data = await response.json() as Partial<AuthorizedStream>
  if (!data.ok || !data.userId) {
    return relayError({
      code: 'relay_authorization_invalid',
      error: 'Chat stream authorization returned an invalid response',
      fallbackSafe: true,
      phase: 'authorization',
      requestId,
      status: 401,
    })
  }
  return {
    ok: true,
    userId: data.userId,
    conversationId: metadata.conversationId,
    turnId: metadata.turnId,
    variantIndex: metadata.variantIndex,
  }
}

async function routeToStreamObject(
  request: Request,
  env: Env,
  action: 'start' | 'resume' | 'stop',
): Promise<Response> {
  const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID()
  const envError = requireEnv(env)
  if (envError) {
    console.error('[chat-stream-worker] configuration error', { requestId, error: envError })
    return relayError({
      code: 'relay_configuration_error',
      error: envError,
      fallbackSafe: true,
      phase: 'configuration',
      requestId,
      status: 503,
    })
  }
  if (!isAllowedOrigin(request, env)) {
    console.warn('[chat-stream-worker] origin rejected', {
      requestId,
      origin: request.headers.get('Origin'),
    })
    return relayError({
      code: 'relay_invalid_origin',
      error: 'Invalid chat stream origin',
      fallbackSafe: true,
      phase: 'origin',
      requestId,
      status: 403,
    })
  }

  const bodyText = await request.text()
  let body: Record<string, unknown>
  try {
    body = JSON.parse(bodyText) as Record<string, unknown>
  } catch {
    console.warn('[chat-stream-worker] request validation failed', {
      requestId,
      reason: 'invalid_json',
    })
    return relayError({
      code: 'relay_invalid_json',
      error: 'Invalid JSON body',
      fallbackSafe: true,
      phase: 'validation',
      requestId,
      status: 400,
    })
  }

  const metadata = parseStreamMetadata(body)
  if (!metadata) {
    console.warn('[chat-stream-worker] request validation failed', {
      requestId,
      reason: 'missing_persisted_conversation',
      hasConversationId: typeof body.conversationId === 'string' && Boolean(body.conversationId.trim()),
      hasConversationClientId:
        typeof body.conversationClientId === 'string' && Boolean(body.conversationClientId.trim()),
      hasTurnId: typeof body.turnId === 'string' && Boolean(body.turnId.trim()),
    })
    return relayError({
      code: 'relay_persisted_conversation_required',
      error: 'A persisted conversationId and turnId are required for resumable streaming',
      fallbackSafe: true,
      phase: 'validation',
      requestId,
      status: 400,
    })
  }
  const diagnostics = parseStreamDiagnostics(body)

  const cookie = request.headers.get('Cookie') ?? ''
  const authorized = await authorizeStream(env, cookie, metadata, requestId)
  if (authorized instanceof Response) return authorized

  const streamName = await sha256Hex(
    `${authorized.userId}:${authorized.conversationId}:${authorized.turnId}:${authorized.variantIndex}`,
  )
  const stub = env.CHAT_STREAMS.getByName(streamName)
  const userAgent = request.headers.get('user-agent') ?? ''
  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim()
    || buildActStreamIdempotencyKey(authorized.turnId, authorized.variantIndex)
  console.info('[chat-stream-worker] routing request', {
    action,
    requestId,
    stream: streamName.slice(0, 12),
    conversationId: authorized.conversationId,
    turnId: authorized.turnId,
    variantIndex: authorized.variantIndex,
    modelId: diagnostics.modelId,
    mode: diagnostics.mode,
  })
  const response = await stub.fetch(`https://chat-stream.internal/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bodyText,
      cookie,
      idempotencyKey,
      nextOrigin: env.OVERLAY_NEXT_ORIGIN,
      relaySecret: env.CHAT_STREAM_RELAY_SECRET,
      requestId,
      streamId: streamName,
      userAgent,
      metadata: authorized,
      diagnostics,
    } satisfies DurableObjectInput),
  })
  return withRequestId(response, requestId)
}

const worker: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === `${STREAM_PATH_PREFIX}/health`) {
      const envError = requireEnv(env)
      return json({ ok: !envError, error: envError ?? undefined }, { status: envError ? 503 : 200 })
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405 })
    }

    if (url.pathname === `${STREAM_PATH_PREFIX}/start`) {
      return routeToStreamObject(request, env, 'start')
    }
    if (url.pathname === `${STREAM_PATH_PREFIX}/resume`) {
      return routeToStreamObject(request, env, 'resume')
    }
    if (url.pathname === `${STREAM_PATH_PREFIX}/stop`) {
      return routeToStreamObject(request, env, 'stop')
    }

    return json({ error: 'Not found' }, { status: 404 })
  },
}

export default worker

class Client {
  constructor(
    readonly controller: ReadableStreamDefaultController<Uint8Array>,
  ) {}

  enqueue(chunk: Uint8Array): boolean {
    try {
      this.controller.enqueue(chunk)
      return true
    } catch {
      return false
    }
  }

  close(): void {
    try {
      this.controller.close()
    } catch {
      // Already closed.
    }
  }
}

export class ChatStreamDurableObject extends DurableObject<Env> {
  private clients = new Set<Client>()
  private upstreamAbortController: AbortController | null = null
  private upstreamRunning = false
  private stopped = false
  private streamTextDecoder = new TextDecoder()
  private eventBuffer = ''
  private upstreamSetCookie: string | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          stream_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          variant_index INTEGER NOT NULL,
          status TEXT NOT NULL,
          message_id TEXT,
          partial_text TEXT NOT NULL DEFAULT '',
          frame_count INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          completed_at INTEGER,
          error_text TEXT
        );
        CREATE TABLE IF NOT EXISTS frames (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `)
    })
  }

  async fetch(request: Request): Promise<Response> {
    const input = await request.json() as DurableObjectInput
    const url = new URL(request.url)
    if (url.pathname === '/start') return this.handleStart(input)
    if (url.pathname === '/resume') return this.handleResume(input)
    if (url.pathname === '/stop') return this.handleStop(input)
    return json({ error: 'Not found' }, { status: 404 })
  }

  private getSession(): SessionRow | null {
    const rows = this.ctx.storage.sql.exec<SessionRow>('SELECT * FROM sessions LIMIT 1').toArray()
    return rows[0] ?? null
  }

  private createSession(input: DurableObjectInput): SessionRow {
    const now = Date.now()
    this.ctx.storage.sql.exec(
      `INSERT INTO sessions (
        stream_id, user_id, conversation_id, turn_id, variant_index, status,
        partial_text, frame_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'active', '', 0, ?, ?)`,
      input.streamId,
      input.metadata.userId,
      input.metadata.conversationId,
      input.metadata.turnId,
      input.metadata.variantIndex,
      now,
      now,
    )
    return this.getSession()!
  }

  private verifyInputOwner(input: DurableObjectInput, session: SessionRow): boolean {
    return (
      input.metadata.userId === session.user_id &&
      input.metadata.conversationId === session.conversation_id &&
      input.metadata.turnId === session.turn_id &&
      input.metadata.variantIndex === session.variant_index
    )
  }

  private sseHeaders(): Headers {
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'x-vercel-ai-ui-message-stream': 'v1',
    })
    if (this.upstreamSetCookie) {
      headers.set('Set-Cookie', this.upstreamSetCookie)
    }
    return headers
  }

  private async handleStart(input: DurableObjectInput): Promise<Response> {
    let session = this.getSession()
    const created = !session
    if (!session) {
      session = this.createSession(input)
    }
    if (!this.verifyInputOwner(input, session)) {
      console.warn('[chat-stream-worker] stream owner mismatch', {
        requestId: input.requestId,
        stream: session.stream_id.slice(0, 12),
      })
      return relayError({
        code: 'relay_stream_owner_mismatch',
        error: 'Chat stream owner mismatch',
        fallbackSafe: false,
        phase: 'routing',
        requestId: input.requestId,
        status: 403,
      })
    }

    if (created) {
      console.info('[chat-stream-worker] upstream starting', {
        requestId: input.requestId,
        stream: session.stream_id.slice(0, 12),
        conversationId: input.metadata.conversationId,
        turnId: input.metadata.turnId,
        variantIndex: input.metadata.variantIndex,
        modelId: input.diagnostics.modelId,
        mode: input.diagnostics.mode,
      })
      try {
        await this.startUpstream(input)
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        this.markError(reason)
        console.warn('[chat-stream-worker] start failed', {
          requestId: input.requestId,
          stream: session.stream_id.slice(0, 12),
          phase: 'upstream',
          upstreamStatus: error instanceof RelayUpstreamError ? error.status : null,
          modelId: input.diagnostics.modelId,
          reason,
        })
        return relayError({
          code: 'relay_upstream_failed',
          error: reason,
          fallbackSafe: false,
          phase: 'upstream',
          requestId: input.requestId,
          status: 502,
          upstreamStatus: error instanceof RelayUpstreamError ? error.status : undefined,
        })
      }
    }

    console.info('[chat-stream-worker] start connected', {
      requestId: input.requestId,
      stream: session.stream_id.slice(0, 12),
      frameCount: session.frame_count,
      status: session.status,
      modelId: input.diagnostics.modelId,
    })
    return this.createReplayResponse()
  }

  private async handleResume(input: DurableObjectInput): Promise<Response> {
    const session = this.getSession()
    if (!session) return new Response(null, { status: 204 })
    if (!this.verifyInputOwner(input, session)) {
      return json({ error: 'Unauthorized stream' }, { status: 403 })
    }
    console.info('[chat-stream-worker] resume', {
      requestId: input.requestId,
      stream: session.stream_id.slice(0, 12),
      frameCount: session.frame_count,
      status: session.status,
    })
    return this.createReplayResponse()
  }

  private async handleStop(input: DurableObjectInput): Promise<Response> {
    const session = this.getSession()
    if (!session) return json({ ok: true, stopped: false })
    if (!this.verifyInputOwner(input, session)) {
      return json({ error: 'Unauthorized stream' }, { status: 403 })
    }

    this.stopped = true
    this.upstreamAbortController?.abort()
    const stopResponse = await fetch(new URL('/api/v1/conversations/stop', input.nextOrigin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': input.cookie,
        'x-overlay-chat-stream-relay': 'cloudflare',
        'x-overlay-chat-stream-secret': input.relaySecret,
      },
      body: JSON.stringify({
        conversationId: session.conversation_id,
        messageId: session.message_id ?? undefined,
        partialContent: session.partial_text,
        partialParts: session.partial_text ? [{ type: 'text', text: session.partial_text }] : undefined,
      }),
    })

    this.markCompleted()
    this.closeClients()
    console.info('[chat-stream-worker] stop', {
      requestId: input.requestId,
      stream: session.stream_id.slice(0, 12),
      stopStatus: stopResponse.status,
      frameCount: session.frame_count,
    })
    return json({ ok: stopResponse.ok, stopped: true }, { status: stopResponse.ok ? 200 : 502 })
  }

  private async startUpstream(input: DurableObjectInput): Promise<void> {
    let body: Record<string, unknown>
    try {
      body = JSON.parse(input.bodyText) as Record<string, unknown>
    } catch {
      throw new Error('Invalid upstream request body')
    }

    body.streamPersistenceMode = 'cloudflare-relay'
    const controller = new AbortController()
    this.upstreamAbortController = controller
    const upstreamHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cookie': input.cookie,
      'User-Agent': input.userAgent,
      'x-request-id': input.requestId,
      'x-overlay-chat-stream-relay': 'cloudflare',
      'x-overlay-chat-stream-secret': input.relaySecret,
    }
    const idempotencyKey = input.idempotencyKey?.trim()
      || buildActStreamIdempotencyKey(input.metadata.turnId, input.metadata.variantIndex)
    if (idempotencyKey) {
      upstreamHeaders['Idempotency-Key'] = idempotencyKey
    }

    const response = await fetch(new URL('/api/v1/conversations/act', input.nextOrigin), {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const responseText = (await response.text()).slice(0, 500)
      throw new RelayUpstreamError(
        responseText || `Upstream returned ${response.status}`,
        response.status,
      )
    }
    if (!response.body) {
      throw new Error('Upstream response body is empty')
    }

    const messageId = response.headers.get('x-overlay-generating-message-id')?.trim() || null
    this.upstreamSetCookie = response.headers.get('Set-Cookie')
    this.ctx.storage.sql.exec(
      'UPDATE sessions SET message_id = ?, updated_at = ?',
      messageId,
      Date.now(),
    )

    this.upstreamRunning = true
    console.info('[chat-stream-worker] upstream connected', {
      requestId: input.requestId,
      stream: input.streamId.slice(0, 12),
      upstreamStatus: response.status,
      messageIdPresent: Boolean(messageId),
      modelId: input.diagnostics.modelId,
    })
    this.ctx.waitUntil(this.drainUpstream(response.body, input))
  }

  private async drainUpstream(
    body: ReadableStream<Uint8Array>,
    input: DurableObjectInput,
  ): Promise<void> {
    const reader = body.getReader()
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (value && value.byteLength > 0) {
          this.persistAndBroadcast(value)
        }
      }
      if (!this.stopped) {
        this.markCompleted()
        const session = this.getSession()
        console.info('[chat-stream-worker] upstream completed', {
          requestId: input.requestId,
          stream: input.streamId.slice(0, 12),
          frameCount: session?.frame_count ?? null,
          modelId: input.diagnostics.modelId,
        })
      }
    } catch (error) {
      if (!this.stopped) {
        const reason = error instanceof Error ? error.message : String(error)
        this.markError(reason)
        console.warn('[chat-stream-worker] upstream stream failed', {
          requestId: input.requestId,
          stream: input.streamId.slice(0, 12),
          modelId: input.diagnostics.modelId,
          reason,
        })
      }
    } finally {
      this.upstreamRunning = false
      this.upstreamAbortController = null
      this.closeClients()
    }
  }

  private persistAndBroadcast(chunk: Uint8Array): void {
    const now = Date.now()
    this.ctx.storage.sql.exec(
      'INSERT INTO frames (data, created_at) VALUES (?, ?)',
      bytesToBase64(chunk),
      now,
    )
    this.accumulateText(chunk)
    this.ctx.storage.sql.exec(
      'UPDATE sessions SET frame_count = frame_count + 1, updated_at = ?',
      now,
    )

    for (const client of [...this.clients]) {
      if (!client.enqueue(chunk)) {
        this.clients.delete(client)
      }
    }
  }

  private accumulateText(chunk: Uint8Array): void {
    this.eventBuffer += this.streamTextDecoder.decode(chunk, { stream: true })
    const lines = this.eventBuffer.split(/\r?\n/)
    this.eventBuffer = lines.pop() ?? ''
    let appended = ''
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue
      const payload = line.startsWith('data:') ? line.slice(5).trim() : line
      if (!payload || payload === '[DONE]') continue
      try {
        const event = JSON.parse(payload) as { type?: string; delta?: unknown; text?: unknown }
        if (event.type === 'text-delta' && typeof event.delta === 'string') {
          appended += event.delta
        } else if (event.type === 'text-delta' && typeof event.text === 'string') {
          appended += event.text
        }
      } catch {
        // Ignore partial and non-JSON stream protocol lines.
      }
    }
    if (appended) {
      this.ctx.storage.sql.exec(
        'UPDATE sessions SET partial_text = partial_text || ?, updated_at = ?',
        appended,
        Date.now(),
      )
    }
  }

  private createReplayResponse(): Response {
    let attachedClient: Client | null = null
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        void this.attachClient(controller)
          .then((client) => {
            attachedClient = client
            if (cancelled && client) {
              this.clients.delete(client)
            }
          })
          .catch(() => {
            try {
              controller.close()
            } catch {
              // Already closed.
            }
          })
      },
      cancel: () => {
        cancelled = true
        if (attachedClient) this.clients.delete(attachedClient)
      },
    })
    return new Response(body, { headers: this.sseHeaders() })
  }

  private async attachClient(controller: ReadableStreamDefaultController<Uint8Array>): Promise<Client | null> {
    const client = new Client(controller)
    let replayedSeq = 0
    let replayedFrames = 0
    while (true) {
      const rows = this.ctx.storage.sql.exec<FrameRow>(
        'SELECT seq, data FROM frames WHERE seq > ? ORDER BY seq ASC',
        replayedSeq,
      ).toArray()
      for (const row of rows) {
        replayedSeq = row.seq
        replayedFrames += 1
        if (!client.enqueue(base64ToBytes(row.data))) {
          return null
        }
      }
      const latest = this.ctx.storage.sql.exec<{ seq: number | null }>(
        'SELECT MAX(seq) AS seq FROM frames',
      ).one().seq ?? 0
      if (replayedSeq >= latest) break
    }

    const session = this.getSession()
    const attached = session?.status === 'active' && this.upstreamRunning
    console.info('[chat-stream-worker] client replay', {
      stream: session?.stream_id.slice(0, 12) ?? null,
      status: session?.status ?? null,
      frameCount: session?.frame_count ?? null,
      replayedFrames,
      upstreamRunning: this.upstreamRunning,
      attached,
    })
    if (attached) {
      this.clients.add(client)
      return client
    } else {
      client.close()
      return null
    }
  }

  private markCompleted(): void {
    const now = Date.now()
    this.ctx.storage.sql.exec(
      `UPDATE sessions
       SET status = 'completed', updated_at = ?, completed_at = ?
       WHERE status = 'active'`,
      now,
      now,
    )
    void this.ctx.storage.setAlarm(now + STREAM_TTL_MS)
  }

  private markError(errorText: string): void {
    const now = Date.now()
    this.ctx.storage.sql.exec(
      `UPDATE sessions
       SET status = 'error', error_text = ?, updated_at = ?, completed_at = ?
       WHERE status = 'active'`,
      errorText.slice(0, 500),
      now,
      now,
    )
    void this.ctx.storage.setAlarm(now + STREAM_TTL_MS)
  }

  private closeClients(): void {
    for (const client of this.clients) {
      client.close()
    }
    this.clients.clear()
  }

  async alarm(): Promise<void> {
    const session = this.getSession()
    if (!session || session.status === 'active') return
    const completedAt = session.completed_at ?? session.updated_at
    if (Date.now() - completedAt < STREAM_TTL_MS) {
      this.ctx.storage.setAlarm(completedAt + STREAM_TTL_MS)
      return
    }
    this.ctx.storage.sql.exec('DELETE FROM frames')
    this.ctx.storage.sql.exec('DELETE FROM sessions')
  }
}

class RelayUpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'RelayUpstreamError'
  }
}
