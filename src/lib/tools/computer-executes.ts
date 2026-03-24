import { convex } from '@/lib/convex'
import type { ComputerToolAuth } from '@/lib/computer-openclaw'
import {
  createComputerSession,
  deleteComputerSession,
  getComputerSessionMessages,
  getComputerWorkspaceFile,
  listComputerSessions,
  listComputerWorkspaceFiles,
  runComputerGatewayCommand,
  setComputerWorkspaceFile,
  updateComputerSession,
} from '@/lib/computer-openclaw'
import type { OverlayToolsOptions } from './types'

/** How chat tools refer to a computer: friendly name, internal id, or default when only one exists. */
export type ComputerTargetInput = {
  computerName?: string
  computerId?: string
}

function asAuth(options: OverlayToolsOptions): ComputerToolAuth | undefined {
  if (!options.accessToken?.trim()) return undefined
  return { userId: options.userId, accessToken: options.accessToken }
}

async function resolveComputerIdForTools(
  options: OverlayToolsOptions,
  input: ComputerTargetInput,
): Promise<{ ok: true; computerId: string } | { ok: false; error: string }> {
  const auth = asAuth(options)
  if (!auth) return { ok: false, error: 'Missing access token for computer tools' }
  const res = await convex.query<
    { ok: true; computerId: string; displayName: string } | { ok: false; error: string }
  >('computers:resolveForChatTools', {
    userId: options.userId,
    accessToken: options.accessToken!,
    computerName: input.computerName?.trim() || undefined,
    computerId: input.computerId?.trim() || undefined,
  })
  if (!res) return { ok: false, error: 'Could not resolve computer (Convex unavailable).' }
  if (!res.ok) return res
  return { ok: true, computerId: String(res.computerId) }
}

export async function executeListComputerSessions(
  options: OverlayToolsOptions,
  input: ComputerTargetInput,
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  const resolved = await resolveComputerIdForTools(options, input)
  if (!resolved.ok) return { success: false, error: resolved.error }
  try {
    const data = await listComputerSessions(resolved.computerId, auth)
    return { success: true, ...data }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list computer sessions',
    }
  }
}

export async function executeGetComputerSessionMessages(
  options: OverlayToolsOptions,
  input: ComputerTargetInput & { sessionKey: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  const resolved = await resolveComputerIdForTools(options, input)
  if (!resolved.ok) return { success: false, error: resolved.error }
  try {
    const data = await getComputerSessionMessages(
      { computerId: resolved.computerId, sessionKey: input.sessionKey.trim() },
      auth,
    )
    return { success: true, sessionKey: data.sessionKey, messages: data.messages }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load session messages',
    }
  }
}

export async function executeListComputerWorkspaceFiles(
  options: OverlayToolsOptions,
  input: ComputerTargetInput,
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  const resolved = await resolveComputerIdForTools(options, input)
  if (!resolved.ok) return { success: false, error: resolved.error }
  try {
    const data = await listComputerWorkspaceFiles(resolved.computerId, auth)
    return { success: true, workspace: data.workspace, files: data.files }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list workspace files',
    }
  }
}

export async function executeReadComputerWorkspaceFile(
  options: OverlayToolsOptions,
  input: ComputerTargetInput & { name: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  const resolved = await resolveComputerIdForTools(options, input)
  if (!resolved.ok) return { success: false, error: resolved.error }
  try {
    const data = await getComputerWorkspaceFile(
      { computerId: resolved.computerId, name: input.name.trim() },
      auth,
    )
    return { success: true, workspace: data.workspace, file: data.file }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to read workspace file',
    }
  }
}

export async function executeCreateComputerSession(
  options: OverlayToolsOptions,
  input: ComputerTargetInput & { modelId?: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  const resolved = await resolveComputerIdForTools(options, input)
  if (!resolved.ok) return { success: false, error: resolved.error }
  try {
    const data = await createComputerSession(
      { computerId: resolved.computerId, modelId: input.modelId },
      auth,
    )
    return { success: true, ...data }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create computer session',
    }
  }
}

export async function executeUpdateComputerSession(
  options: OverlayToolsOptions,
  input: ComputerTargetInput & { sessionKey: string; modelId?: string; label?: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  const resolved = await resolveComputerIdForTools(options, input)
  if (!resolved.ok) return { success: false, error: resolved.error }
  try {
    const data = await updateComputerSession(
      {
        computerId: resolved.computerId,
        sessionKey: input.sessionKey.trim(),
        modelId: input.modelId,
        label: input.label,
      },
      auth,
    )
    return { success: true, ...data }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update computer session',
    }
  }
}

export async function executeDeleteComputerSession(
  options: OverlayToolsOptions,
  input: ComputerTargetInput & { sessionKey: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  const resolved = await resolveComputerIdForTools(options, input)
  if (!resolved.ok) return { success: false, error: resolved.error }
  try {
    const data = await deleteComputerSession(
      { computerId: resolved.computerId, sessionKey: input.sessionKey.trim() },
      auth,
    )
    return { success: true, ...data }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete computer session',
    }
  }
}

export async function executeWriteComputerWorkspaceFile(
  options: OverlayToolsOptions,
  input: ComputerTargetInput & { name: string; content: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  const resolved = await resolveComputerIdForTools(options, input)
  if (!resolved.ok) return { success: false, error: resolved.error }
  try {
    const data = await setComputerWorkspaceFile(
      {
        computerId: resolved.computerId,
        name: input.name.trim(),
        content: input.content,
      },
      auth,
    )
    return { success: true, workspace: data.workspace, file: data.file }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to write workspace file',
    }
  }
}

export async function executeRunComputerGatewayCommand(
  options: OverlayToolsOptions,
  input: ComputerTargetInput & { sessionKey: string; message: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  const resolved = await resolveComputerIdForTools(options, input)
  if (!resolved.ok) return { success: false, error: resolved.error }
  try {
    const text = await runComputerGatewayCommand(
      {
        computerId: resolved.computerId,
        sessionKey: input.sessionKey.trim(),
        message: input.message,
      },
      auth,
    )
    return { success: true, text }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gateway command failed',
    }
  }
}

