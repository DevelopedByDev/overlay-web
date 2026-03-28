import { DEFAULT_MODEL_ID, AVAILABLE_MODELS, getModel } from '@/lib/models'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import {
  attachDevelopmentGatewayDeviceIdentity,
  buildGatewayConnectDevice,
  type GatewayDeviceIdentity,
} from '@/lib/openclaw-gateway-device'
import { getSession } from '@/lib/workos-auth'
import type { Id } from '../../convex/_generated/dataModel'

const GATEWAY_PROTOCOL_VERSION = 3
export const MAIN_AGENT_ID = 'main'
const DEFAULT_COMPUTER_WORKSPACE_PATH = '~/.openclaw/workspace'
const COMPUTER_WORKSPACE_BOOTSTRAP_FILE_NAMES = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
] as const
const COMPUTER_WORKSPACE_PRIMARY_MEMORY_FILE_NAME = 'MEMORY.md'
const COMPUTER_WORKSPACE_FALLBACK_FILE_NAMES = [
  ...COMPUTER_WORKSPACE_BOOTSTRAP_FILE_NAMES,
  COMPUTER_WORKSPACE_PRIMARY_MEMORY_FILE_NAME,
] as const

/** Auth override for non-browser execution paths. */
export type ComputerToolAuth = {
  userId: string
  accessToken?: string
  serverSecret?: string
}

export interface ComputerConnectionInfo {
  gatewayToken: string
  hooksToken: string
  hetznerServerIp: string
  gatewayDeviceIdentity?: GatewayDeviceIdentity
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
  code?: string
  message?: string
  details?: unknown
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
  payload?: unknown
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
  accessToken?: string
  serverSecret?: string
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

function requireComputerOwnedSessionKey(
  sessionKey: string | undefined,
  params: { computerId: string; userId: string },
): string {
  const normalized = sessionKey?.trim()
  if (!normalized || !isComputerOwnedSessionKey(normalized, params)) {
    throw new Error('Session does not belong to this computer')
  }
  return normalized
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
  accessToken?: string
  serverSecret?: string
}): Promise<AuthenticatedComputerContext> {
  const { computerId, userId, accessToken, serverSecret } = params
  const baseConnection = await convex.query<ComputerConnectionInfo | null>(
    'computers:getChatConnection',
    {
      computerId: computerId as Id<'computers'>,
      userId,
      accessToken,
      serverSecret,
    },
    { throwOnError: true, timeoutMs: 30_000 },
  )
  if (!baseConnection) {
    throw new Error('Computer is not ready')
  }

  const connection = await attachDevelopmentGatewayDeviceIdentity({
    computerId,
    connection: baseConnection,
  })

  const computer = await convex.query<ComputerRuntimeState | null>(
    'computers:get',
    {
      computerId: computerId as Id<'computers'>,
      userId,
      accessToken,
      serverSecret,
    },
    { throwOnError: true, timeoutMs: 30_000 },
  )

  return {
    accessToken,
    computerId,
    connection,
    computer: computer ?? {},
    serverSecret,
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

  const userId = session.user.id
  const accessToken = session.accessToken
  const serverSecret = getInternalApiSecret()

  const baseConnection = await convex.query<ComputerConnectionInfo | null>(
    'computers:getChatConnection',
    {
      computerId: computerId as Id<'computers'>,
      userId,
      serverSecret,
    },
    { throwOnError: true, timeoutMs: 30_000 },
  )
  if (!baseConnection) {
    throw new Error('Computer is not ready')
  }

  const connection = await attachDevelopmentGatewayDeviceIdentity({
    computerId,
    connection: baseConnection,
  })

  const computer = await convex.query<ComputerRuntimeState | null>(
    'computers:get',
    {
      computerId: computerId as Id<'computers'>,
      userId,
      serverSecret,
    },
    { throwOnError: true, timeoutMs: 30_000 },
  )

  return {
    accessToken,
    computerId,
    connection,
    computer: computer ?? {},
    serverSecret,
    userId,
  }
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
  let payload: GatewaySessionListPayload | null = null

  try {
    payload = await callGatewayRequest<GatewaySessionListPayload>({
      ip: context.connection.hetznerServerIp,
      gatewayToken: context.connection.gatewayToken,
      gatewayDeviceIdentity: context.connection.gatewayDeviceIdentity,
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
  } catch (error) {
    if (!shouldIgnoreGatewaySessionReadError(error)) {
      throw error
    }

    const fallbackActiveSessionKey =
      context.computer.chatSessionKey?.trim() ||
      buildLegacyComputerSessionKey(context.userId, computerId)

    return {
      activeSessionKey: fallbackActiveSessionKey,
      storePath: null,
      sessions: fallbackActiveSessionKey
        ? [
            {
              key: fallbackActiveSessionKey,
              title: 'New Chat',
              updatedAt: null,
              status: 'unavailable',
              modelProvider: context.computer.chatEffectiveProvider?.trim() || null,
              model: context.computer.chatEffectiveModel?.trim() || null,
            },
          ]
        : [],
    }
  }

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
  const sessionKey = requireComputerOwnedSessionKey(params.sessionKey, {
    computerId: params.computerId,
    userId: context.userId,
  })
  let payload: GatewaySessionGetPayload | null = null

  try {
    payload = await callGatewayRequest<GatewaySessionGetPayload>({
      ip: context.connection.hetznerServerIp,
      gatewayToken: context.connection.gatewayToken,
      gatewayDeviceIdentity: context.connection.gatewayDeviceIdentity,
      method: 'sessions.get',
      params: {
        key: sessionKey,
        limit: 400,
      },
    })
  } catch (error) {
    if (!shouldIgnoreGatewaySessionReadError(error)) {
      throw error
    }

    return {
      sessionKey,
      messages: [],
    }
  }

  const messages = Array.isArray(payload?.messages)
    ? payload.messages
    : Array.isArray(payload?.items)
      ? payload.items
      : []

  return {
    sessionKey,
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

  let sessionKey: string
  try {
    const created = await callGatewayRequest<GatewaySessionsCreatePayload>({
      ip: context.connection.hetznerServerIp,
      gatewayToken: context.connection.gatewayToken,
      gatewayDeviceIdentity: context.connection.gatewayDeviceIdentity,
      method: 'sessions.create',
      params: {
        agentId: MAIN_AGENT_ID,
        key: createdKey,
        label: 'New Chat',
      },
    })
    sessionKey = created?.key?.trim() || createdKey
  } catch (error) {
    if (!shouldIgnoreGatewaySessionMutationError(error)) {
      throw error
    }
    sessionKey = createdKey
  }
  const appliedSessionModel = await applyPreferredModel({
    ip: context.connection.hetznerServerIp,
    gatewayToken: context.connection.gatewayToken,
    gatewayDeviceIdentity: context.connection.gatewayDeviceIdentity,
    sessionKey,
    modelId: requestedModelId,
    modelRef: requestedModelRef,
  }).catch(() => null)

  const latestSessionModel =
    appliedSessionModel ||
    (await readGatewaySessionModel({
      ip: context.connection.hetznerServerIp,
      gatewayToken: context.connection.gatewayToken,
      gatewayDeviceIdentity: context.connection.gatewayDeviceIdentity,
      sessionKey,
    }).catch(() => null))

  await convex.mutation(
    'computers:setChatRuntimeState',
    {
      computerId: params.computerId,
      userId: context.userId,
      accessToken: context.accessToken,
      serverSecret: context.serverSecret,
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
  const sessionKey = requireComputerOwnedSessionKey(params.sessionKey, {
    computerId: params.computerId,
    userId: context.userId,
  })
  const selectedModelId =
    params.modelId?.trim() ||
    context.computer.chatRequestedModelId?.trim() ||
    DEFAULT_MODEL_ID
  const requestedModelRef =
    resolveOpenClawModelRef(selectedModelId) ?? resolveOpenClawModelRef(DEFAULT_MODEL_ID)

  if (typeof params.label === 'string') {
    try {
      await callGatewayRequest<GatewaySessionsPatchPayload>({
        ip: context.connection.hetznerServerIp,
        gatewayToken: context.connection.gatewayToken,
        gatewayDeviceIdentity: context.connection.gatewayDeviceIdentity,
        method: 'sessions.patch',
        params: {
          key: sessionKey,
          label: params.label.trim() || null,
        },
      })
    } catch (error) {
      if (!shouldIgnoreGatewaySessionMutationError(error)) {
        throw error
      }
    }
  }

  const appliedSessionModel = params.modelId
    ? await applyPreferredModel({
        ip: context.connection.hetznerServerIp,
        gatewayToken: context.connection.gatewayToken,
        gatewayDeviceIdentity: context.connection.gatewayDeviceIdentity,
        sessionKey,
        modelId: selectedModelId,
        modelRef: requestedModelRef,
      }).catch(() => null)
    : null

  const latestSessionModel =
    appliedSessionModel ||
    (await readGatewaySessionModel({
      ip: context.connection.hetznerServerIp,
      gatewayToken: context.connection.gatewayToken,
      gatewayDeviceIdentity: context.connection.gatewayDeviceIdentity,
      sessionKey,
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
      serverSecret: context.serverSecret,
      sessionKey: latestSessionModel?.sessionKey ?? sessionKey,
      requestedModelId: resolvedModelId,
      requestedModelRef: resolvedModelRef ?? undefined,
      effectiveProvider: latestSessionModel?.provider,
      effectiveModel: latestSessionModel?.model,
    },
    { throwOnError: true, timeoutMs: 30_000 }
  )

  return {
    sessionKey: latestSessionModel?.sessionKey ?? sessionKey,
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
  const deletedSessionKey = requireComputerOwnedSessionKey(params.sessionKey, {
    computerId: params.computerId,
    userId: context.userId,
  })

  const deleted = await callGatewayRequest<GatewaySessionsDeletePayload>({
    ip: context.connection.hetznerServerIp,
    gatewayToken: context.connection.gatewayToken,
    gatewayDeviceIdentity: context.connection.gatewayDeviceIdentity,
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
): Promise<{ workspace: string; files: ComputerWorkspaceFileItem[]; unavailableReason?: string | null }> {
  const context = toolAuth
    ? await getAuthenticatedComputerContextWithToken({ computerId, ...toolAuth })
    : await getAuthenticatedComputerContext(computerId)
  let payload: {
    workspace?: string
    files?: ComputerWorkspaceFileItem[]
  } | null = null
  let unavailableReason: string | null = null

  try {
    payload = await callGatewayRequest<{
      workspace?: string
      files?: ComputerWorkspaceFileItem[]
    }>({
      ip: context.connection.hetznerServerIp,
      gatewayToken: context.connection.gatewayToken,
      gatewayDeviceIdentity: context.connection.gatewayDeviceIdentity,
      method: 'agents.files.list',
      params: {
        agentId: MAIN_AGENT_ID,
      },
    })
  } catch (error) {
    if (!shouldIgnoreGatewaySessionReadError(error)) {
      throw error
    }
    if (
      getErrorMessage(error).toLowerCase().includes('missing scope: operator.read') ||
      isGatewayReachabilityError(error)
    ) {
      return {
        workspace: DEFAULT_COMPUTER_WORKSPACE_PATH,
        files: buildStaticComputerWorkspaceFallbackFiles(DEFAULT_COMPUTER_WORKSPACE_PATH),
        unavailableReason: isGatewayReachabilityError(error)
          ? getGatewayReadUnavailableReason(error, 'workspace files')
          : null,
      }
    }
    unavailableReason = getGatewayReadUnavailableReason(error, 'workspace files')
  }

  return {
    workspace: payload?.workspace?.trim() || DEFAULT_COMPUTER_WORKSPACE_PATH,
    files: Array.isArray(payload?.files) ? payload.files : [],
    unavailableReason,
  }
}

export async function getComputerWorkspaceFile(
  params: {
    computerId: string
    name: string
  },
  toolAuth?: ComputerToolAuth,
): Promise<{ workspace: string; file: ComputerWorkspaceFileItem; unavailableReason?: string | null }> {
  const context = toolAuth
    ? await getAuthenticatedComputerContextWithToken({ computerId: params.computerId, ...toolAuth })
    : await getAuthenticatedComputerContext(params.computerId)
  let payload: {
    workspace?: string
    file?: ComputerWorkspaceFileItem
  } | null = null
  let unavailableReason: string | null = null

  try {
    payload = await callGatewayRequest<{
      workspace?: string
      file?: ComputerWorkspaceFileItem
    }>({
      ip: context.connection.hetznerServerIp,
      gatewayToken: context.connection.gatewayToken,
      gatewayDeviceIdentity: context.connection.gatewayDeviceIdentity,
      method: 'agents.files.get',
      params: {
        agentId: MAIN_AGENT_ID,
        name: params.name,
      },
    })
  } catch (error) {
    if (!shouldIgnoreGatewaySessionReadError(error)) {
      throw error
    }
    const fallbackFile = buildStaticComputerWorkspaceFallbackFile(
      params.name,
      DEFAULT_COMPUTER_WORKSPACE_PATH,
    )
    if (fallbackFile) {
      return {
        workspace: DEFAULT_COMPUTER_WORKSPACE_PATH,
        file: fallbackFile,
        unavailableReason: getErrorMessage(error).toLowerCase().includes('missing scope: operator.read')
          ? null
          : getGatewayReadUnavailableReason(error, 'workspace file contents'),
      }
    }
    unavailableReason = getGatewayReadUnavailableReason(error, 'workspace file contents')
  }

  return {
    workspace: payload?.workspace?.trim() || DEFAULT_COMPUTER_WORKSPACE_PATH,
    file: payload?.file ?? {
      name: params.name,
      path: params.name,
      missing: true,
      content: '',
    },
    unavailableReason,
  }
}

export async function reconfigureComputerGatewayAccess(
  computerId: string,
  toolAuth?: ComputerToolAuth,
): Promise<{ ok: boolean; message: string }> {
  const context = toolAuth
    ? await getAuthenticatedComputerContextWithToken({ computerId, ...toolAuth })
    : await getAuthenticatedComputerContext(computerId)

  try {
    const result = await convex.action<{ queued?: boolean; status?: string }>(
      'computers:repairComputerInstance',
      {
        computerId,
        userId: context.userId,
        accessToken: context.accessToken,
      },
      { throwOnError: true, timeoutMs: 30_000 }
    )

    if (result?.queued) {
      return {
        ok: true,
        message: 'A fresh computer instance is being provisioned. This will take a few minutes — workspace files and all sessions will be fully available once it completes.',
      }
    }

    return {
      ok: false,
      message: 'Unable to queue a reprovision for this computer. Please try again.',
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'Unable to reprovision this computer. Please try again.',
    }
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
    gatewayDeviceIdentity: context.connection.gatewayDeviceIdentity,
    method: 'agents.files.set',
    params: {
      agentId: MAIN_AGENT_ID,
      name: params.name,
      content: params.content,
    },
  })

  return {
    workspace: payload?.workspace?.trim() || DEFAULT_COMPUTER_WORKSPACE_PATH,
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
  gatewayDeviceIdentity?: GatewayDeviceIdentity
  sessionKey: string
}): Promise<GatewaySessionModelState | null> {
  const payload = await callGatewayRequest<GatewaySessionListPayload>({
    ip: params.ip,
    gatewayToken: params.gatewayToken,
    gatewayDeviceIdentity: params.gatewayDeviceIdentity,
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
    gatewayDeviceIdentity: context.connection.gatewayDeviceIdentity,
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
  const sessionKey = requireComputerOwnedSessionKey(params.sessionKey, {
    computerId: params.computerId,
    userId: context.userId,
  })
  const ws = await openGatewaySocket(context.connection.hetznerServerIp)

  try {
    await connectGatewaySocket(
      ws,
      context.connection.gatewayToken,
      context.connection.gatewayDeviceIdentity
    )
    return await runGatewayChatStream(ws, {
      message: params.message,
      sessionKey,
    })
  } finally {
    ws.close()
  }
}

export async function applyPreferredModel(params: {
  ip: string
  gatewayToken: string
  gatewayDeviceIdentity?: GatewayDeviceIdentity
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
        gatewayDeviceIdentity: params.gatewayDeviceIdentity,
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
      if (shouldIgnoreGatewayModelPatchError(lastError)) {
        console.warn('[Computer OpenClaw] Ignoring model sync failure:', {
          sessionKey: params.sessionKey,
          modelId: params.modelId,
          attemptedModel: candidate,
          modelRef: params.modelRef,
          error: getErrorMessage(lastError),
        })
        return null
      }
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
  gatewayDeviceIdentity?: GatewayDeviceIdentity
  method: string
  params?: unknown
}): Promise<T> {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()
  debugGateway('rpc:start', {
    ip: params.ip,
    method: params.method,
    requestId,
  })

  const ws = await openGatewaySocket(params.ip)
  try {
    await connectGatewaySocket(ws, params.gatewayToken, params.gatewayDeviceIdentity)
    const response = await waitForGatewayResponse(ws, {
      requestId,
      method: params.method,
      params: params.params,
    })
    if (response.ok === false) {
      throw buildGatewayResponseError(response, `OpenClaw ${params.method} failed`)
    }
    debugGateway('rpc:success', {
      ip: params.ip,
      method: params.method,
      requestId,
      durationMs: Date.now() - startedAt,
    })
    return (response.payload ?? {}) as T
  } catch (error) {
    console.error('[Computer OpenClaw][Gateway] rpc:failure', {
      ip: params.ip,
      method: params.method,
      requestId,
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
      detail: extractErrorDetail(error),
    })
    throw error
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
        const payload =
          frame.payload && typeof frame.payload === 'object'
            ? (frame.payload as GatewayChatEventPayload)
            : null
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
  const startedAt = Date.now()
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
      debugGateway('socket:open', {
        ip,
        durationMs: Date.now() - startedAt,
      })
      resolve()
    }

    const handleError = (event: Event) => {
      cleanup()
      reject(new Error(`Failed to open OpenClaw gateway websocket. ${summarizeEvent(event)}`.trim()))
    }

    ws.addEventListener('open', handleOpen, { once: true })
    ws.addEventListener('error', handleError, { once: true })
  })
  return ws
}

async function connectGatewaySocket(
  ws: WebSocket,
  gatewayToken: string,
  gatewayDeviceIdentity?: GatewayDeviceIdentity
): Promise<void> {
  const challenge = await waitForGatewayConnectChallenge(ws)
  const nonce = challenge?.nonce?.trim() || ''
  debugGateway('socket:challenge', {
    noncePresent: Boolean(nonce),
    challengeTs: challenge?.ts ?? null,
  })

  const authVariants = [
    { token: gatewayToken, password: gatewayToken },
    { password: gatewayToken },
    { token: gatewayToken },
  ]
  const clientId = gatewayDeviceIdentity?.clientId?.trim() || 'gateway-client'
  const clientMode = gatewayDeviceIdentity?.clientMode?.trim() || 'backend'
  const platform = gatewayDeviceIdentity?.platform?.trim() || process.platform
  const deviceFamily = gatewayDeviceIdentity?.deviceFamily?.trim() || undefined
  let response: GatewayResponseFrame | null = null
  let lastError: unknown = null

  for (const auth of authVariants) {
    try {
      const signedAtMs = Date.now()
      const device = gatewayDeviceIdentity
        ? buildGatewayConnectDevice({
            identity: gatewayDeviceIdentity,
            clientId,
            clientMode,
            role: 'operator',
            scopes: ['operator.admin', 'operator.read', 'operator.write'],
            signedAtMs,
            token: 'token' in auth ? auth.token : null,
            nonce,
            platform,
            deviceFamily,
          })
        : undefined

      response = await waitForGatewayResponse(ws, {
        requestId: crypto.randomUUID(),
        method: 'connect',
        params: {
          minProtocol: GATEWAY_PROTOCOL_VERSION,
          maxProtocol: GATEWAY_PROTOCOL_VERSION,
          client: {
            id: clientId,
            version: '1.0.0',
            platform,
            deviceFamily,
            mode: clientMode,
          },
          caps: [],
          commands: [],
          permissions: {},
          role: 'operator',
          scopes: ['operator.admin', 'operator.read', 'operator.write'],
          auth,
          device,
        },
      })
      break
    } catch (error) {
      lastError = error
      const message = getErrorMessage(error).toLowerCase()
      const shouldRetry =
        message.includes('provide gateway auth password') ||
        message.includes('gateway password missing') ||
        message.includes('provide gateway auth token') ||
        message.includes('gateway token missing')
      if (!shouldRetry) {
        throw error
      }
    }
  }

  if (!response) {
    throw (lastError instanceof Error ? lastError : new Error(getErrorMessage(lastError)))
  }

  const payload =
    response.payload && typeof response.payload === 'object'
      ? (response.payload as { type?: string })
      : null

  if (payload?.type !== 'hello-ok') {
    throw new Error('OpenClaw gateway websocket handshake failed.')
  }

  debugGateway('socket:connected', {
    helloType: payload?.type ?? null,
  })
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

async function waitForGatewayConnectChallenge(
  ws: WebSocket,
): Promise<{ nonce?: string; ts?: number } | null> {
  return await new Promise<{ nonce?: string; ts?: number } | null>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for OpenClaw connect.challenge event.'))
    }, 5_000)

    const cleanup = () => {
      clearTimeout(timeoutId)
      ws.removeEventListener('message', handleMessage)
      ws.removeEventListener('error', handleError)
      ws.removeEventListener('close', handleClose)
    }

    const handleError = (event: Event) => {
      cleanup()
      reject(new Error(`OpenClaw websocket errored before connect.challenge. ${summarizeEvent(event)}`.trim()))
    }

    const handleClose = (event: Event) => {
      cleanup()
      reject(new Error(`OpenClaw websocket closed before connect.challenge. ${summarizeEvent(event)}`.trim()))
    }

    const handleMessage = (event: MessageEvent) => {
      const frame = parseGatewayFrame(event.data)
      if (!frame || !isGatewayEventFrame(frame) || frame.event !== 'connect.challenge') {
        return
      }

      cleanup()
      const payload =
        frame.payload && typeof frame.payload === 'object'
          ? (frame.payload as { nonce?: string; ts?: number })
          : null
      resolve(payload)
    }

    ws.addEventListener('message', handleMessage)
    ws.addEventListener('error', handleError)
    ws.addEventListener('close', handleClose)
  })
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

function buildStaticComputerWorkspaceFallbackFiles(workspace: string): ComputerWorkspaceFileItem[] {
  return COMPUTER_WORKSPACE_FALLBACK_FILE_NAMES.map((name) => ({
    name,
    path: `${workspace}/${name}`,
    missing: false,
  }))
}

function buildStaticComputerWorkspaceFallbackFile(
  name: string,
  workspace: string,
): ComputerWorkspaceFileItem | null {
  const normalizedName = name.trim()
  if (!COMPUTER_WORKSPACE_FALLBACK_FILE_NAMES.includes(normalizedName as typeof COMPUTER_WORKSPACE_FALLBACK_FILE_NAMES[number])) {
    return null
  }

  return {
    name: normalizedName,
    path: `${workspace}/${normalizedName}`,
    missing: false,
    content: '',
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'OpenClaw request timed out after 4 minutes.'
  }
  return error instanceof Error ? error.message : 'Computer request failed'
}

function extractErrorDetail(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return null
  }

  const value = error as Error & { cause?: unknown }
  return value.cause ?? null
}

function getGatewayReadUnavailableReason(error: unknown, resourceLabel: string): string {
  const message = getErrorMessage(error)
  const normalized = message.toLowerCase()

  if (normalized.includes('missing scope: operator.read')) {
    return `OpenClaw gateway denied read access (operator.read), so ${resourceLabel} are unavailable on this computer.`
  }

  if (
    normalized.includes('gateway token mismatch') ||
    normalized.includes('provide gateway auth token') ||
    normalized.includes('provide gateway auth password') ||
    normalized.includes('gateway password missing')
  ) {
    return `OpenClaw gateway authentication failed, so ${resourceLabel} are unavailable on this computer.`
  }

  if (isGatewayReachabilityError(error)) {
    return `OpenClaw gateway is unreachable from Overlay, so ${resourceLabel} are unavailable on this computer.`
  }

  return message
}

function shouldIgnoreGatewayModelPatchError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('missing scope: operator.admin') ||
    message.includes('gateway token mismatch') ||
    message.includes('provide gateway auth token') ||
    message.includes('provide gateway auth password') ||
    message.includes('gateway password missing')
  )
}

function shouldIgnoreGatewaySessionReadError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('missing scope: operator.read') ||
    message.includes('gateway token mismatch') ||
    message.includes('provide gateway auth token') ||
    message.includes('provide gateway auth password') ||
    message.includes('gateway password missing') ||
    isGatewayReachabilityError(error)
  )
}

function shouldIgnoreGatewaySessionMutationError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('missing scope: operator.write') ||
    message.includes('missing scope: operator.admin') ||
    message.includes('gateway token mismatch') ||
    message.includes('provide gateway auth token') ||
    message.includes('provide gateway auth password') ||
    message.includes('gateway password missing')
  )
}

function buildGatewayResponseError(frame: GatewayResponseFrame, fallbackMessage: string): Error {
  const parts = [
    frame.error?.message?.trim(),
    frame.error?.code ? `code=${frame.error.code}` : '',
    frame.error?.details ? `details=${safeJson(frame.error.details)}` : '',
  ].filter(Boolean)

  return new Error(parts.join(' | ') || fallbackMessage)
}

function isGatewayReachabilityError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('timed out opening openclaw gateway websocket') ||
    message.includes('failed to open openclaw gateway websocket') ||
    message.includes('timed out waiting for openclaw connect.challenge event') ||
    message.includes('openclaw websocket errored before connect.challenge') ||
    message.includes('openclaw websocket closed before connect.challenge') ||
    message.includes('timed out waiting for openclaw websocket response') ||
    message.includes('openclaw websocket errored during') ||
    message.includes('openclaw websocket closed during')
  )
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

function debugGateway(event: string, data: Record<string, unknown>): void {
  console.log('[Computer OpenClaw][Gateway]', event, data)
}

function summarizeEvent(event: Event): string {
  if (typeof CloseEvent !== 'undefined' && event instanceof CloseEvent) {
    return `close_code=${event.code} close_reason=${event.reason || 'none'}`
  }
  return event.type ? `event=${event.type}` : 'event=unknown'
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return '[unserializable]'
  }
}
