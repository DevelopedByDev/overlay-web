import {
  callComputerGatewayMethod,
  createComputerSession,
  deleteComputerSession,
  getComputerSessionMessages,
  getComputerWorkspaceFile,
  listComputerSessions,
  listComputerWorkspaceFiles,
  runComputerGatewayCommand,
  setComputerWorkspaceFile,
  updateComputerSession,
  type ComputerToolAuth,
} from '@/lib/computer-openclaw'

export interface ComputerControlClient {
  createSession(params: { computerId: string; modelId?: string }): Promise<Awaited<ReturnType<typeof createComputerSession>>>
  listSessions(computerId: string): Promise<Awaited<ReturnType<typeof listComputerSessions>>>
  updateSession(params: { computerId: string; sessionKey: string; modelId?: string; label?: string }): Promise<Awaited<ReturnType<typeof updateComputerSession>>>
  deleteSession(params: { computerId: string; sessionKey: string }): Promise<Awaited<ReturnType<typeof deleteComputerSession>>>
  sendMessage(params: { computerId: string; sessionKey: string; message: string }): Promise<string>
  getTranscript(params: { computerId: string; sessionKey: string }): Promise<Awaited<ReturnType<typeof getComputerSessionMessages>>>
  listWorkspaceFiles(computerId: string): Promise<Awaited<ReturnType<typeof listComputerWorkspaceFiles>>>
  readWorkspaceFile(params: { computerId: string; name: string }): Promise<Awaited<ReturnType<typeof getComputerWorkspaceFile>>>
  writeWorkspaceFile(params: { computerId: string; name: string; content: string }): Promise<Awaited<ReturnType<typeof setComputerWorkspaceFile>>>
  invokeGatewayTool<T = unknown>(params: { computerId: string; method: string; params?: unknown }): Promise<T>
}

export function createComputerControlClient(auth?: ComputerToolAuth): ComputerControlClient {
  return {
    createSession: (params) => createComputerSession(params, auth),
    listSessions: (computerId) => listComputerSessions(computerId, auth),
    updateSession: (params) => updateComputerSession(params, auth),
    deleteSession: (params) => deleteComputerSession(params, auth),
    sendMessage: (params) => runComputerGatewayCommand(params, auth),
    getTranscript: (params) => getComputerSessionMessages(params, auth),
    listWorkspaceFiles: (computerId) => listComputerWorkspaceFiles(computerId, auth),
    readWorkspaceFile: (params) => getComputerWorkspaceFile(params, auth),
    writeWorkspaceFile: (params) => setComputerWorkspaceFile(params, auth),
    invokeGatewayTool: <T = unknown>(params: { computerId: string; method: string; params?: unknown }) =>
      callComputerGatewayMethod<T>(params, auth),
  }
}

