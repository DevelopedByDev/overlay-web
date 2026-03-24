import { DEFAULT_MODEL_ID, AVAILABLE_MODELS, getModel } from '@/lib/models'
import { convex } from '@/lib/convex'
import { getSession } from '@/lib/workos-auth'
import type { Id } from '../../convex/_generated/dataModel'

const GATEWAY_PROTOCOL_VERSION = 3
export const MAIN_AGENT_ID = 'main'

/** Bearer + userId from chat tool execution (no browser cookie on internal fetch). */
export type ComputerToolAuth = { userId: string; accessToken: string }

export interface ComputerConnectionInfo {
  gatewayToken: string
  hooksToken: string
  hetznerServerIp: string
}

export interface ComputerRuntimeState {
  chatSessionKey?: string
  chatRequestedModelId?: string
  chatRequestedModelRef?: string
  chatEffectiveProvider?: string
  chatEffectiveModel?: string
}

interface GatewaySessionListPayload {
  path?: string
  sessions?: GatewaySessionRow[]
}

interface GatewaySessionGetPayload {
  messages?: OpenClawTranscriptMessage[]
  items?: OpenClawTranscriptMessage[]
}

interface GatewaySessionsCreatePayload {
  key?: string
}

interface GatewaySessionsPatchPayload {
  ok?: boolean
  key?: string
  resolved?: {
    modelProvider?: string
    model?: string
  }
}

interface GatewaySessionsDeletePayload {
  ok?: boolean
  deleted?: boolean
}

interface GatewayErrorShape {
  message?: string
}

interface GatewayResponseFrame {
  type?: string
  id?: string
  ok?: boolean
  payload?: unknown
  error?: GatewayErrorShape
}

interface GatewayChatAcceptedPayload {
  runId?: string
  status?: string
}

interface GatewayChatFinalPayload extends GatewayChatAcceptedPayload {
  summary?: string
  result?: unknown
  message?: OpenClawTranscriptMessage
}

interface GatewayChatEventPayload {
  runId?: string
  state?: 'final' | 'aborted' | 'error'
  message?: OpenClawTranscriptMessage
  errorMessage?: string
}

interface GatewayEventFrame {
  type?: string
  event?: string
  payload?: GatewayChatEventPayload
}

export interface GatewaySessionRow {
  key?: string
  label?: string
  displayName?: string
  derivedTitle?: string
  lastMessagePreview?: string
  updatedAt?: number | null
  status?: string
  modelProvider?: string | null
  model?: string | null
  sessionId?: string
}

export interface GatewaySessionModelState {
  sessionKey: string
  provider?: string
  model?: string
}

export interface OpenClawTranscriptMessage {
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

export interface ComputerSessionItem {
  key: string
  title: string
  updatedAt: number | null
  status?: string
  modelProvider?: string | null
  model?: string | null
  sessionId?: string
}

export interface ComputerWorkspaceFileItem {
  name: string
  path: string
  missing: boolean
  size?: number
  updatedAtMs?: number
  content?: string
}

export interface AuthenticatedComputerContext {
  accessToken: string
  computerId: string
  connection: ComputerConnectionInfo
  computer: ComputerRuntimeState
  userId: string
}

export function buildLegacyComputerSessionKey(userId: string, computerId: string): string {
  return `hook:computer:v1:${userId}:${computerId}`
}

export function getComputerSessionKeyPrefix(computerId: string): string {
  return `agent:${MAIN_AGENT_ID}:dashboard:overlay:computer:${computerId}:`
}

export function buildComputerSessionKey(computerId: string): string {
  return `${getComputerSessionKeyPrefix(computerId)}${crypto.randomUUID()}`
}

export function isComputerOwnedSessionKey(
  sessionKey: string | undefined,
  params: { computerId: string; userId: string }
): boolean {
  if (!sessionKey) return false
  return (
    sessionKey.startsWith(getComputerSessionKeyPrefix(params.computerId)) ||
    sessionKey === buildLegacyComputerSessionKey(params.userId, params.computerId)
  )
}

export function extractTranscriptMessageText(message: OpenClawTranscriptMessage): string {
  return (
    message.content
      ?.filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text?.trim() || '')
      .filter(Boolean)
      .join('\n')
      .trim() || ''
  )
}

export function resolveOpenClawModelRef(modelId: string): string | null {
  const model = getModel(modelId)
  return model?.openClawRef ?? null
}

export function resolveOpenClawSessionModelCandidates(modelId: string): string[] {
  const candidates = new Set<string>()
  const model = getModel(modelId)
  const trimmedId = modelId.trim()
  if (trimmedId) {
    candidates.add(trimmedId)
  }
  const ref = model?.openClawRef?.trim()
  if (ref) {
    candidates.add(ref)
    const strippedGatewayPrefix = ref.replace(/^vercel-ai-gateway\//, '').trim()
    if (strippedGatewayPrefix) {
      candidates.add(strippedGatewayPrefix)
    }
  }
  return [...candidates]
}

export function resolveOverlayModelIdFromGatewayModel(
  provider?: string | null,
  model?: string | null
): string | null {
  const normalizedProvider = provider?.trim().toLowerCase()
  const normalizedModel = model?.trim().toLowerCase()
  if (!normalizedProvider || !normalizedModel) {
    return null
  }

  for (const entry of AVAILABLE_MODELS) {
    const ref = entry.openClawRef?.trim()
    if (!ref) continue
    const candidates = [
      ref,
      ref.replace(/^vercel-ai-gateway\//, ''),
    ].map((value) => value.trim().toLowerCase())
    if (candidates.includes(`${normalizedProvider}/${normalizedModel}`)) {
      return entry.id
    }
  }

  return null
}

export async function getAuthenticatedComputerContextWithToken(params: {
  computerId: string
  userId: string
  accessToken: string
}): Promise<AuthenticatedComputerContext> {
  const { computerId, userId, accessToken } = params
  const connection = await convex.query<ComputerConnectionInfo | null>(
    'computers:getChatConnection',
    {
      computerId: computerId as Id<'computers'>,
      userId,
      accessToken,
    },
    { throwOnError: true, timeoutMs: 30_000 },
  )
  if (!connection) {
    throw new Error('Computer is not ready')
  }

  const computer = await convex.query<ComputerRuntimeState | null>(
    'computers:get',
    {
      computerId: computerId as Id<'computers'>,
      userId,
      accessToken,
    },
    { throwOnError: true, timeoutMs: 30_000 },
  )

  return {
    accessToken,
    computerId,
    connection,
    computer: computer ?? {},
    userId,
  }
}

export async function getAuthenticatedComputerContext(
  computerId: string,
): Promise<AuthenticatedComputerContext> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return getAuthenticatedComputerContextWithToken({
    computerId,
    userId: session.user.id,
    accessToken: session.accessToken,
  })
}

export async function listComputerSessions(
  computerId: string,
  toolAuth?: ComputerToolAuth,
): Promise<{
  activeSessionKey: string | null
  storePath: string | null
  sessions: ComputerSessionItem[]
}> {
  const context = toolAuth
    ? await getAuthenticatedComputerContextWithToken({ computerId, ...toolAuth })
    : await getAuthenticatedComputerContext(computerId)
  const payload = await callGatewayRequest<GatewaySessionListPayload>({
    ip: context.connection.hetznerServerIp,
    gatewayToken: context.connection.gatewayToken,
    method: 'sessions.list',
    params: {
      agentId: MAIN_AGENT_ID,
      includeGlobal: false,
      includeUnknown: false,
      includeDerivedTitles: true,
      includeLastMessage: true,
      limit: 200,
    },
  })

  const allRows = Array.isArray(payload?.sessions) ? payload.sessions : []
  const sessionRows = allRows.filter((row) =>
    isComputerOwnedSessionKey(row.key?.trim(), {
      computerId,
      userId: context.userId,
    })
  )

  const activeSessionKey = context.computer.chatSessionKey?.trim() || null
  if (
    activeSessionKey &&
    !sessionRows.some((row) => row.key?.trim() === activeSessionKey)
  ) {
    const activeRow = allRows.find((row) => row.key?.trim() === activeSessionKey)
    if (activeRow) {
      sessionRows.unshift(activeRow)
    }
  }

  const sessions = sessionRows
    .map((row) => ({
      key: row.key?.trim() || '',
      title: getComputerSessionTitle(row),
      updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : null,
      status: row.status,
      modelProvider: row.modelProvider ?? null,
      model: row.model ?? null,
      sessionId: row.sessionId,
    }))
    .filter((row) => row.key)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))

  return {
    activeSessionKey,
    storePath: payload?.path?.trim() || null,
    sessions,
  }
}

export async function getComputerSessionMessages(
  params: {
    computerId: string
    sessionKey: string
  },
  toolAuth?: ComputerToolAuth,
): Promise<{ sessionKey: string; messages: OpenClawTranscriptMessage[] }> {
  const context = toolAuth
    ? await getAuthenticatedComputerContextWithToken({ computerId: params.computerId, ...toolAuth })
    : await getAuthenticatedComputerContext(params.computerId)
  const payload = await callGatewayRequest<GatewaySessionGetPayload>({
    ip: context.connection.hetznerServerIp,
    gatewayToken: context.connection.gatewayToken,
    method: 'sessions.get',
    params: {
      key: params.sessionKey,
      limit: 400,
    },
  })

  const messages = Array.isArray(payload?.messages)
    ? payload.messages
    : Array.isArray(payload?.items)
      ? payload.items
      : []

  return {
    sessionKey: params.sessionKey,
    messages,
  }
}

export async function createComputerSession(
  params: {
    computerId: string
    modelId?: string
  },
  toolAuth?: ComputerToolAuth,
): Promise<{
  sessionKey: string
  requestedModelId: string
  requestedModelRef: string | null
  effectiveProvider: string | null
  effectiveModel: string | null
}> {
  const context = toolAuth
    ? await getAuthenticatedComputerContextWithToken({ computerId: params.computerId, ...toolAuth })
    : await getAuthenticatedComputerContext(params.computerId)
  const requestedModelId =
    params.modelId?.trim() ||
    context.computer.chatRequestedModelId?.trim() ||
    DEFAULT_MODEL_ID
  const requestedModelRef =
    resolveOpenClawModelRef(requestedModelId) ?? resolveOpenClawModelRef(DEFAULT_MODEL_ID)
  const createdKey = buildComputerSessionKey(params.computerId)

  const created = await callGatewayRequest<GatewaySessionsCreatePayload>({
    ip: context.connection.hetznerServerIp,
    gatewayToken: context.connection.gatewayToken,
    method: 'sessions.create',
    params: {
      agentId: MAIN_AGENT_ID,
      key: createdKey,
      label: 'New Chat',
    },
  })

  const sessionKey = created?.key?.trim() || createdKey
  const appliedSessionModel = await applyPreferredModel({
    ip: context.connection.hetznerServerIp,
    gatewayToken: context.connection.gatewayToken,
    sessionKey,
    modelId: requestedModelId,
    modelRef: requestedModelRef,
  }).catch(() => null)

  const latestSessionModel =
    appliedSessionModel ||
    (await readGatewaySessionModel({
      ip: context.connection.hetznerServerIp,
      gatewayToken: context.connection.gatewayToken,
      sessionKey,
    }).catch(() => null))

  await convex.mutation(
    'computers:setChatRuntimeState',
    {
      computerId: params.computerId,
      userId: context.userId,
      accessToken: context.accessToken,
      sessionKey: latestSessionModel?.sessionKey ?? sessionKey,
      requestedModelId,
      requestedModelRef: requestedModelRef ?? undefined,
      effectiveProvider: latestSessionModel?.provider,
      effectiveModel: latestSessionModel?.model,
    },
    { throwOnError: true, timeoutMs: 30_000 }
  )

  return {
    sessionKey: latestSessionModel?.sessionKey ?? sessionKey,
    requestedModelId,
    requestedModelRef,
    effectiveProvider: latestSessionModel?.provider ?? null,
    effectiveModel: latestSessionModel?.model ?? null,
  }
}

export async function updateComputerSession(
  params: {
    computerId: string
    sessionKey: string
    modelId?: string
    label?: string
  },
  toolAuth?: ComputerToolAuth,
): Promise<{
  sessionKey: string
  requestedModelId: string
  requestedModelRef: string | null
  effectiveProvider: string | null
  effectiveModel: string | null
}> {
  const context = toolAuth
    ? await getAuthenticatedComputerContextWithToken({ computerId: params.computerId, ...toolAuth })
    : await getAuthenticatedComputerContext(params.computerId)
  const selectedModelId =
    params.modelId?.trim() ||
    context.computer.chatRequestedModelId?.trim() ||
    DEFAULT_MODEL_ID
  const requestedModelRef =
    resolveOpenClawModelRef(selectedModelId) ?? resolveOpenClawModelRef(DEFAULT_MODEL_ID)

  if (typeof params.label === 'string') {
    await callGatewayRequest<GatewaySessionsPatchPayload>({
      ip: context.connection.hetznerServerIp,
      gatewayToken: context.connection.gatewayToken,
      method: 'sessions.patch',
      params: {
        key: params.sessionKey,
        label: params.label.trim() || null,
      },
    })
  }

  const appliedSessionModel = params.modelId
    ? await applyPreferredModel({
        ip: context.connection.hetznerServerIp,
        gatewayToken: context.connection.gatewayToken,
        sessionKey: params.sessionKey,
        modelId: selectedModelId,
        modelRef: requestedModelRef,
      }).catch(() => null)
    : null

  const latestSessionModel =
    appliedSessionModel ||
    (await readGatewaySessionModel({
      ip: context.connection.hetznerServerIp,
      gatewayToken: context.connection.gatewayToken,
      sessionKey: params.sessionKey,
    }).catch(() => null))

  const resolvedModelId =
    params.modelId?.trim() ||
    context.computer.chatRequestedModelId?.trim() ||
    resolveOverlayModelIdFromGatewayModel(
      latestSessionModel?.provider,
      latestSessionModel?.model
    ) ||
    DEFAULT_MODEL_ID
  const resolvedModelRef =
    resolveOpenClawModelRef(resolvedModelId) ??
    requestedModelRef ??
    context.computer.chatRequestedModelRef ??
    null

  await convex.mutation(
    'computers:setChatRuntimeState',
    {
      computerId: params.computerId,
      userId: context.userId,
      accessToken: context.accessToken,
      sessionKey: latestSessionModel?.sessionKey ?? params.sessionKey,
      requestedModelId: resolvedModelId,
      requestedModelRef: resolvedModelRef ?? undefined,
      effectiveProvider: latestSessionModel?.provider,
      effectiveModel: latestSessionModel?.model,
    },
    { throwOnError: true, timeoutMs: 30_000 }
  )

  return {
    sessionKey: latestSessionModel?.sessionKey ?? params.sessionKey,
    requestedModelId: resolvedModelId,
    requestedModelRef: resolvedModelRef,
    effectiveProvider: latestSessionModel?.provider ?? null,
    effectiveModel: latestSessionModel?.model ?? null,
  }
}

export async function deleteComputerSession(
  params: {
    computerId: string
    sessionKey: string
  },
  toolAuth?: ComputerToolAuth,
): Promise<{
  deleted: boolean
  deletedSessionKey: string
  sessionKey: string | null
  requestedModelId: string | null
  requestedModelRef: string | null
  effectiveProvider: string | null
  effectiveModel: string | null
}> {
  const context = toolAuth
    ? await getAuthenticatedComputerContextWithToken({ computerId: params.computerId, ...toolAuth })
    : await getAuthenticatedComputerContext(params.computerId)
  const deletedSessionKey = params.sessionKey.trim()

  const deleted = await callGatewayRequest<GatewaySessionsDeletePayload>({
    ip: context.connection.hetznerServerIp,
    gatewayToken: context.connection.gatewayToken,
    method: 'sessions.delete',
    params: {
      key: deletedSessionKey,
      deleteTranscript: true,
    },
  })

  const isActiveSession = context.computer.chatSessionKey?.trim() === deletedSessionKey
  if (!deleted?.deleted) {
    return {
      deleted: false,
      deletedSessionKey,
      sessionKey: context.computer.chatSessionKey?.trim() || null,
      requestedModelId: context.computer.chatRequestedModelId?.trim() || null,
      requestedModelRef: context.computer.chatRequestedModelRef?.trim() || null,
      effectiveProvider: context.computer.chatEffectiveProvider?.trim() || null,
      effectiveModel: context.computer.chatEffectiveModel?.trim() || null,
    }
  }

  if (!isActiveSession) {
    return {
      deleted: true,
      deletedSessionKey,
      sessionKey: context.computer.chatSessionKey?.trim() || null,
      requestedModelId: context.computer.chatRequestedModelId?.trim() || null,
      requestedModelRef: context.computer.chatRequestedModelRef?.trim() || null,
      effectiveProvider: context.computer.chatEffectiveProvider?.trim() || null,
      effectiveModel: context.computer.chatEffectiveModel?.trim() || null,
    }
  }

  const remainingSessions = await listComputerSessions(params.computerId, toolAuth)
  const nextSession = remainingSessions.sessions[0]

  if (nextSession) {
    const runtime = await updateComputerSession(
      {
        computerId: params.computerId,
        sessionKey: nextSession.key,
      },
      toolAuth,
    )

    return {
      deleted: true,
      deletedSessionKey,
      sessionKey: runtime.sessionKey,
      requestedModelId: runtime.requestedModelId,
      requestedModelRef: runtime.requestedModelRef,
      effectiveProvider: runtime.effectiveProvider,
      effectiveModel: runtime.effectiveModel,
    }
  }

  const runtime = await createComputerSession(
    {
      computerId: params.computerId,
      modelId: context.computer.chatRequestedModelId?.trim() || DEFAULT_MODEL_ID,
    },
    toolAuth,
  )

  return {
    deleted: true,
    deletedSessionKey,
    sessionKey: runtime.sessionKey,
    requestedModelId: runtime.requestedModelId,
    requestedModelRef: runtime.requestedModelRef,
    effectiveProvider: runtime.effectiveProvider,
    effectiveModel: runtime.effectiveModel,
  }
}

export async function listComputerWorkspaceFiles(
  computerId: string,
  toolAuth?: ComputerToolAuth,
): Promise<{ workspace: string; files: ComputerWorkspaceFileItem[] }> {
  const context = toolAuth
    ? await getAuthenticatedComputerContextWithToken({ computerId, ...toolAuth })
    : await getAuthenticatedComputerContext(computerId)
  const payload = await callGatewayRequest<{
    workspace?: string
    files?: ComputerWorkspaceFileItem[]
  }>({
    ip: context.connection.hetznerServerIp,
    gatewayToken: context.connection.gatewayToken,
    method: 'agents.files.list',
    params: {
      agentId: MAIN_AGENT_ID,
    },
  })

  return {
    workspace: payload?.workspace?.trim() || '~/.openclaw/workspace',
    files: Array.isArray(payload?.files) ? payload.files : [],
  }
}

export async function getComputerWorkspaceFile(
  params: {
    computerId: string
    name: string
  },
  toolAuth?: ComputerToolAuth,
): Promise<{ workspace: string; file: ComputerWorkspaceFileItem }> {
  const context = toolAuth
    ? await getAuthenticatedComputerContextWithToken({ computerId: params.computerId, ...toolAuth })
    : await getAuthenticatedComputerContext(params.computerId)
  const payload = await callGatewayRequest<{
    workspace?: string
    file?: ComputerWorkspaceFileItem
  }>({
    ip: context.connection.hetznerServerIp,
    gatewayToken: context.connection.gatewayToken,
    method: 'agents.files.get',
    params: {
      agentId: MAIN_AGENT_ID,
      name: params.name,
    },
  })

  return {
    workspace: payload?.workspace?.trim() || '~/.openclaw/workspace',
    file: payload?.file ?? {
      name: params.name,
      path: params.name,
      missing: true,
      content: '',
    },
  }
}

export async function setComputerWorkspaceFile(
  params: {
    computerId: string
    name: string
    content: string
  },
  toolAuth?: ComputerToolAuth,
): Promise<{ workspace: string; file: ComputerWorkspaceFileItem }> {
  const context = toolAuth
    ? await getAuthenticatedComputerContextWithToken({ computerId: params.computerId, ...toolAuth })
    : await getAuthenticatedComputerContext(params.computerId)
  const payload = await callGatewayRequest<{
    workspace?: string
    file?: ComputerWorkspaceFileItem
  }>({
    ip: context.connection.hetznerServerIp,
    gatewayToken: context.connection.gatewayToken,
    method: 'agents.files.set',
    params: {
      agentId: MAIN_AGENT_ID,
      name: params.name,
      content: params.content,
    },
  })

  return {
    workspace: payload?.workspace?.trim() || '~/.openclaw/workspace',
    file: payload?.file ?? {
      name: params.name,
      path: params.name,
      missing: false,
      content: params.content,
    },
  }
}

export async function readGatewaySessionModel(params: {
  ip: string
  gatewayToken: string
  sessionKey: string
}): Promise<GatewaySessionModelState | null> {
  const payload = await callGatewayRequest<GatewaySessionListPayload>({
    ip: params.ip,
    gatewayToken: params.gatewayToken,
    method: 'sessions.list',
    params: {
      includeGlobal: false,
      includeUnknown: false,
      limit: 300,
    },
  })

  const exact = payload?.sessions?.find((session) => session.key?.trim() === params.sessionKey) ?? null
  const sessionRow =
    exact ??
    payload?.sessions?.find((session) => {
      const key = session.key?.trim().toLowerCase()
      return key?.endsWith(`:${params.sessionKey.toLowerCase()}`) ?? false
    }) ??
    null

  if (!sessionRow) {
    return null
  }

  return {
    sessionKey: sessionRow.key?.trim() || params.sessionKey,
    provider: sessionRow.modelProvider?.trim() || undefined,
    model: sessionRow.model?.trim() || undefined,
  }
}

export async function callComputerGatewayMethod<T>(
  params: {
    computerId: string
    method: string
    params?: unknown
  },
  toolAuth?: ComputerToolAuth,
): Promise<T> {
  const context = toolAuth
    ? await getAuthenticatedComputerContextWithToken({ computerId: params.computerId, ...toolAuth })
    : await getAuthenticatedComputerContext(params.computerId)
  return await callGatewayRequest<T>({
    ip: context.connection.hetznerServerIp,
    gatewayToken: context.connection.gatewayToken,
    method: params.method,
    params: params.params,
  })
}

export async function runComputerGatewayCommand(
  params: {
    computerId: string
    sessionKey: string
    message: string
  },
  toolAuth?: ComputerToolAuth,
): Promise<string> {
  const context = toolAuth
    ? await getAuthenticatedComputerContextWithToken({ computerId: params.computerId, ...toolAuth })
    : await getAuthenticatedComputerContext(params.computerId)
  const ws = await openGatewaySocket(context.connection.hetznerServerIp)

  try {
    await connectGatewaySocket(ws, context.connection.gatewayToken)
    return await runGatewayChatStream(ws, {
      message: params.message,
      sessionKey: params.sessionKey,
    })
  } finally {
    ws.close()
  }
}

export async function applyPreferredModel(params: {
  ip: string
  gatewayToken: string
  sessionKey: string
  modelId: string
  modelRef: string | null
}): Promise<GatewaySessionModelState | null> {
  const candidates = resolveOpenClawSessionModelCandidates(params.modelId)
  let lastError: Error | null = null

  for (const candidate of candidates) {
    try {
      const payload = await callGatewayRequest<GatewaySessionsPatchPayload>({
        ip: params.ip,
        gatewayToken: params.gatewayToken,
        method: 'sessions.patch',
        params: {
          key: params.sessionKey,
          model: candidate,
        },
      })

      return {
        sessionKey: payload?.key?.trim() || params.sessionKey,
        provider: payload?.resolved?.modelProvider?.trim() || undefined,
        model: payload?.resolved?.model?.trim() || undefined,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(getErrorMessage(error))
    }
  }

  if (lastError) {
    throw lastError
  }

  return null
}

async function callGatewayRequest<T>(params: {
  ip: string
  gatewayToken: string
  method: string
  params?: unknown
}): Promise<T> {
  const ws = await openGatewaySocket(params.ip)
  try {
    await connectGatewaySocket(ws, params.gatewayToken)
    const response = await waitForGatewayResponse(ws, {
      requestId: crypto.randomUUID(),
      method: params.method,
      params: params.params,
    })
    if (response.ok === false) {
      throw new Error(response.error?.message || `OpenClaw ${params.method} failed`)
    }
    return (response.payload ?? {}) as T
  } finally {
    ws.close()
  }
}

async function runGatewayChatStream(
  ws: WebSocket,
  params: {
    message: string
    sessionKey: string
  }
): Promise<string> {
  const requestId = crypto.randomUUID()
  const idempotencyKey = crypto.randomUUID()
  let assistantText = ''
  let runId: string | null = null
  let accepted = false

  return await new Promise<string>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('OpenClaw request timed out after 4 minutes.'))
    }, 240_000)

    const cleanup = () => {
      clearTimeout(timeoutId)
      ws.removeEventListener('message', handleMessage)
      ws.removeEventListener('error', handleError)
      ws.removeEventListener('close', handleClose)
    }

    const handleError = () => {
      cleanup()
      reject(new Error('OpenClaw gateway websocket errored during the run.'))
    }

    const handleClose = () => {
      cleanup()
      reject(new Error('OpenClaw gateway websocket closed before the run completed.'))
    }

    const fail = (error: Error) => {
      cleanup()
      reject(error)
    }

    const finish = (value: string) => {
      cleanup()
      resolve(value)
    }

    const handleMessage = (event: MessageEvent) => {
      const frame = parseGatewayFrame(event.data)
      if (!frame) {
        return
      }

      if (isGatewayEventFrame(frame) && frame.event === 'chat') {
        const payload = frame.payload
        if (!accepted || !runId || payload?.runId !== runId) {
          return
        }

        if (payload.state === 'error') {
          fail(new Error(payload.errorMessage || 'OpenClaw chat run failed.'))
          return
        }

        if (payload.state === 'final' || payload.state === 'aborted') {
          const finalText = extractTranscriptMessageText(payload.message ?? {})
          if (finalText && !assistantText) {
            assistantText = finalText
          }
          finish(assistantText.trim() || finalText.trim())
        }
        return
      }

      if (!isGatewayResponseFrame(frame) || frame.id !== requestId) {
        return
      }

      if (!accepted) {
        if (!frame.ok) {
          fail(buildGatewayResponseError(frame, 'OpenClaw rejected the chat request.'))
          return
        }

        const payload =
          frame.payload && typeof frame.payload === 'object'
            ? (frame.payload as GatewayChatAcceptedPayload)
            : null
        const nextRunId = payload?.runId?.trim()
        if (!nextRunId) {
          fail(new Error('OpenClaw did not return a run ID for this chat request.'))
          return
        }

        runId = nextRunId
        accepted = true
        return
      }

      if (!frame.ok) {
        fail(buildGatewayResponseError(frame, 'OpenClaw run failed.'))
        return
      }

      const payload =
        frame.payload && typeof frame.payload === 'object'
          ? (frame.payload as GatewayChatFinalPayload)
          : null
      const finalText =
        extractTranscriptMessageText(payload?.message ?? {}) ||
        extractGatewayResultText(payload?.result)

      if (payload?.status === 'error') {
        fail(new Error(payload.summary || finalText || 'OpenClaw run failed.'))
        return
      }

      if (finalText && !assistantText) {
        assistantText = finalText
      }

      finish(assistantText.trim() || finalText.trim())
    }

    ws.addEventListener('message', handleMessage)
    ws.addEventListener('error', handleError)
    ws.addEventListener('close', handleClose)
    ws.send(
      JSON.stringify({
        type: 'req',
        id: requestId,
        method: 'chat.send',
        params: {
          message: params.message,
          sessionKey: params.sessionKey,
          deliver: false,
          timeoutMs: 240_000,
          idempotencyKey,
        },
      })
    )
  })
}

async function openGatewaySocket(ip: string): Promise<WebSocket> {
  const ws = new WebSocket(`ws://${ip}:18789`)
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out opening OpenClaw gateway websocket.'))
    }, 30_000)

    const cleanup = () => {
      clearTimeout(timeoutId)
      ws.removeEventListener('open', handleOpen)
      ws.removeEventListener('error', handleError)
    }

    const handleOpen = () => {
      cleanup()
      resolve()
    }

    const handleError = () => {
      cleanup()
      reject(new Error('Failed to open OpenClaw gateway websocket.'))
    }

    ws.addEventListener('open', handleOpen, { once: true })
    ws.addEventListener('error', handleError, { once: true })
  })
  return ws
}

async function connectGatewaySocket(ws: WebSocket, gatewayToken: string): Promise<void> {
  const response = await waitForGatewayResponse(ws, {
    requestId: crypto.randomUUID(),
    method: 'connect',
    params: {
      minProtocol: GATEWAY_PROTOCOL_VERSION,
      maxProtocol: GATEWAY_PROTOCOL_VERSION,
      client: {
        id: 'gateway-client',
        version: '1.0.0',
        platform: 'overlay-nextjs',
        mode: 'backend',
      },
      role: 'operator',
      scopes: ['operator.admin', 'operator.read', 'operator.write'],
      auth: {
        token: gatewayToken,
      },
    },
  })

  const payload =
    response.payload && typeof response.payload === 'object'
      ? (response.payload as { type?: string })
      : null

  if (payload?.type !== 'hello-ok') {
    throw new Error('OpenClaw gateway websocket handshake failed.')
  }
}

async function waitForGatewayResponse(
  ws: WebSocket,
  params: {
    method: string
    requestId: string
    params?: unknown
  }
): Promise<GatewayResponseFrame> {
  return await new Promise<GatewayResponseFrame>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for OpenClaw websocket response to ${params.method}.`))
    }, 30_000)

    const cleanup = () => {
      clearTimeout(timeoutId)
      ws.removeEventListener('message', handleMessage)
      ws.removeEventListener('error', handleError)
      ws.removeEventListener('close', handleClose)
    }

    const handleError = () => {
      cleanup()
      reject(new Error(`OpenClaw websocket errored during ${params.method}.`))
    }

    const handleClose = () => {
      cleanup()
      reject(new Error(`OpenClaw websocket closed during ${params.method}.`))
    }

    const handleMessage = (event: MessageEvent) => {
      const frame = parseGatewayFrame(event.data)
      if (!frame || !isGatewayResponseFrame(frame) || frame.id !== params.requestId) {
        return
      }
      cleanup()
      if (frame.ok === false) {
        reject(new Error(frame.error?.message || `OpenClaw ${params.method} failed.`))
        return
      }
      resolve(frame)
    }

    ws.addEventListener('message', handleMessage)
    ws.addEventListener('error', handleError)
    ws.addEventListener('close', handleClose)
    ws.send(
      JSON.stringify({
        type: 'req',
        id: params.requestId,
        method: params.method,
        params: params.params ?? {},
      })
    )
  })
}

function parseGatewayFrame(value: unknown): GatewayResponseFrame | GatewayEventFrame | null {
  if (typeof value !== 'string') {
    return null
  }

  try {
    const parsed = JSON.parse(value) as GatewayResponseFrame | GatewayEventFrame
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function getComputerSessionTitle(row: GatewaySessionRow): string {
  return (
    row.label?.trim() ||
    row.displayName?.trim() ||
    row.derivedTitle?.trim() ||
    row.lastMessagePreview?.trim() ||
    'New Chat'
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'OpenClaw request timed out after 4 minutes.'
  }
  return error instanceof Error ? error.message : 'Computer request failed'
}

function buildGatewayResponseError(frame: GatewayResponseFrame, fallbackMessage: string): Error {
  return new Error(frame.error?.message || fallbackMessage)
}

function extractGatewayResultText(result: unknown): string {
  if (typeof result === 'string') {
    return result.trim()
  }

  if (result && typeof result === 'object') {
    const value = result as {
      text?: unknown
      content?: unknown
      summary?: unknown
      message?: unknown
    }

    for (const candidate of [value.text, value.content, value.summary, value.message]) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim()
      }
    }
  }

  return ''
}

function isGatewayResponseFrame(frame: GatewayResponseFrame | GatewayEventFrame): frame is GatewayResponseFrame {
  return frame.type === 'res'
}

function isGatewayEventFrame(frame: GatewayResponseFrame | GatewayEventFrame): frame is GatewayEventFrame {
  return frame.type === 'event'
}
