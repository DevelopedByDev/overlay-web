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

function asAuth(options: OverlayToolsOptions): ComputerToolAuth | undefined {
  if (!options.accessToken?.trim()) return undefined
  return { userId: options.userId, accessToken: options.accessToken }
}

export async function executeListComputerSessions(
  options: OverlayToolsOptions,
  input: { computerId: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  try {
    const data = await listComputerSessions(input.computerId.trim(), auth)
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
  input: { computerId: string; sessionKey: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  try {
    const data = await getComputerSessionMessages(
      { computerId: input.computerId.trim(), sessionKey: input.sessionKey.trim() },
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
  input: { computerId: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  try {
    const data = await listComputerWorkspaceFiles(input.computerId.trim(), auth)
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
  input: { computerId: string; name: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  try {
    const data = await getComputerWorkspaceFile(
      { computerId: input.computerId.trim(), name: input.name.trim() },
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
  input: { computerId: string; modelId?: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  try {
    const data = await createComputerSession(
      { computerId: input.computerId.trim(), modelId: input.modelId },
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
  input: { computerId: string; sessionKey: string; modelId?: string; label?: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  try {
    const data = await updateComputerSession(
      {
        computerId: input.computerId.trim(),
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
  input: { computerId: string; sessionKey: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  try {
    const data = await deleteComputerSession(
      { computerId: input.computerId.trim(), sessionKey: input.sessionKey.trim() },
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
  input: { computerId: string; name: string; content: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  try {
    const data = await setComputerWorkspaceFile(
      {
        computerId: input.computerId.trim(),
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
  input: { computerId: string; sessionKey: string; message: string },
) {
  const auth = asAuth(options)
  if (!auth) return { success: false, error: 'Missing access token for computer tools' }
  try {
    const text = await runComputerGatewayCommand(
      {
        computerId: input.computerId.trim(),
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

