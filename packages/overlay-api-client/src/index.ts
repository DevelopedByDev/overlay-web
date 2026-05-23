import type {
  AppBootstrapResponse,
  AppSettings,
  AccountEntitlements,
  AutomationRunDetail,
  AutomationRunRequest,
  AutomationRunResponse,
  AutomationSummary,
  AutomationTestRequest,
  AutomationTestResponse,
  BillingPortalRequest,
  BillingPortalResponse,
  BillingSettings,
  CheckoutVerifyRequest,
  CheckoutVerifyResponse,
  ConversationMessage,
  ConversationSummary,
  ConnectedIntegrationsResponse,
  CreateAutomationRequest,
  CreateAutomationResponse,
  CreateEntityResponse,
  CreateFileRequest,
  CreateFileResponse,
  CreateMcpServerRequest,
  CreateMemoryRequest,
  CreateMemoryResponse,
  CreateNoteRequest,
  CreateNoteResponse,
  Entitlements,
  FilePresignQuery,
  FilePresignResponse,
  IntegrationSummary,
  IntegrationConnectionRequest,
  IntegrationConnectionResponse,
  IntegrationSearchResponse,
  FileQueryContract,
  FileShareRequest,
  FileShareResponse,
  FileTextSearchRequest,
  FileTextSearchResponse,
  FileUploadUrlRequest,
  FileUploadUrlResponse,
  KnowledgeFile,
  McpServerSummary,
  MemoryQueryContract,
  MemoryRow,
  MutationSuccessResponse,
  NoteDoc,
  NoteQueryContract,
  NotebookAgentRequest,
  OutputQueryContract,
  OutputSummary,
  ProjectQueryContract,
  CreateProjectRequest,
  CreateProjectResponse,
  ProjectSummary,
  TestMcpServerRequest,
  TestMcpServerResponse,
  SkillSummary,
  UpdateFileRequest,
  UpdateMcpServerRequest,
  UpdateMemoryRequest,
  UpdateNoteRequest,
  UpdateNoteResponse,
  UpdateProjectRequest,
  UpdateProjectResponse,
  DeleteProjectResponse,
  DeleteNoteResponse,
  DeleteAutomationResponse,
  DeleteOutputResponse,
  CreateSkillRequest,
  UpdateSkillRequest,
  OnboardingCompleteResponse,
  OnboardingStatusResponse,
  DesktopLinkRequest,
  DesktopLinkResponse,
  TopUpCheckoutRequest,
  TopUpCheckoutResponse,
  TopUpHistoryResponse,
  TopUpVerifyRequest,
  TopUpVerifyResponse,
  UpdateBillingSettingsRequest,
  UpdateAutomationRequest,
} from '@overlay/app-core'

type QueryValue = string | number | boolean | null | undefined
type QueryParams = Record<string, QueryValue>
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface CreateOverlayAppClientOptions {
  baseUrl?: string
  fetch?: FetchLike
  getAuthHeaders?: () => HeadersInit | Promise<HeadersInit>
}

export interface ConversationQuery {
  conversationId?: string
  messages?: boolean
  projectId?: string
  updatedSince?: number
  includeDeleted?: boolean
  limit?: number
  beforeCreatedAt?: number
  compactToolPayloads?: boolean
}

export type ConversationGetResponse =
  | ConversationSummary[]
  | ConversationSummary
  | {
      messages: ConversationMessage[]
      limit?: number
      hasMore?: boolean
      earliestCreatedAt?: number
    }

export interface CreateConversationRequest {
  title?: string
  projectId?: string
  askModelIds?: string[]
  actModelId?: string
  lastMode?: 'ask' | 'act'
  clientId?: string
}

export interface CreateConversationResponse {
  id?: string
  conversation?: ConversationSummary
  error?: string
}

export interface UpdateConversationRequest {
  conversationId?: string
  title?: string
  projectId?: string | null
  lastMode?: 'ask' | 'act'
  askModelIds?: string[]
  actModelId?: string
  lastModified?: number
}

export interface ConversationMessageRequest {
  conversationId?: string
  turnId?: string
  mode?: 'ask' | 'act'
  role?: 'user' | 'assistant'
  content?: string
  parts?: Array<Record<string, unknown>>
  attachmentNames?: string[]
  model?: string
  modelId?: string
  contentType?: 'text' | 'image' | 'video'
  variantIndex?: number
  replyToTurnId?: string
  replySnippet?: string
  accessToken?: string
  userId?: string
}

export interface FileQuery {
  fileId?: string
  projectId?: string | null
  kind?: 'folder' | 'note' | 'upload' | 'output' | string
  parentId?: string | null
  conversationId?: string
  outputType?: string
  type?: string
}

export interface ProjectQuery {
  projectId?: string
  updatedSince?: number
  includeDeleted?: boolean
}

export interface IntegrationQuery {
  action?: 'search' | string
  limit?: number
  slug?: string
  q?: string
  cursor?: string
  projectId?: string
}

export interface SkillQuery {
  skillId?: string
  projectId?: string
}

export interface McpServerQuery {
  mcpServerId?: string
  projectId?: string
}

export interface AutomationQuery {
  automationId?: string
  includeRuns?: boolean
  projectId?: string
}

export interface MemoryQuery extends MemoryQueryContract {}

export interface OutputQuery extends OutputQueryContract {}

export interface NoteQuery extends NoteQueryContract {}

function appendQuery(path: string, query?: QueryParams): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    params.set(key, String(value))
  }
  const search = params.toString()
  return search ? `${path}?${search}` : path
}

function toUrl(baseUrl: string | undefined, path: string): string {
  if (!baseUrl) return path
  return new URL(path, baseUrl).toString()
}

function jsonRequest(body: unknown, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return {
    ...init,
    headers,
    body: JSON.stringify(body),
  }
}

async function mergeHeaders(
  getAuthHeaders: CreateOverlayAppClientOptions['getAuthHeaders'],
  initHeaders: HeadersInit | undefined,
): Promise<Headers> {
  const headers = new Headers()
  const authHeaders = await getAuthHeaders?.()
  new Headers(authHeaders).forEach((value, key) => headers.set(key, value))
  new Headers(initHeaders).forEach((value, key) => headers.set(key, value))
  return headers
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

export function createOverlayAppClient(options: CreateOverlayAppClientOptions = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis)
  if (!fetchImpl) {
    throw new Error('createOverlayAppClient requires a fetch implementation')
  }

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = await mergeHeaders(options.getAuthHeaders, init.headers)
    const requestInit: RequestInit = {
      ...init,
      headers,
    }
    if (requestInit.credentials === undefined) {
      requestInit.credentials = 'same-origin'
    }
    return fetchImpl(toUrl(options.baseUrl, path), requestInit)
  }

  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    return parseJson<T>(await request(path, init))
  }

  const conversationsPath = (query?: ConversationQuery) =>
    appendQuery('/api/app/conversations', query as QueryParams | undefined)
  const filesPath = (query?: FileQuery) => appendQuery('/api/app/files', query as QueryParams | undefined)
  const projectsPath = (query?: ProjectQuery) =>
    appendQuery('/api/app/projects', query as QueryParams | undefined)
  const integrationsPath = (query?: IntegrationQuery) =>
    appendQuery('/api/app/integrations', query as QueryParams | undefined)
  const skillsPath = (query?: SkillQuery) => appendQuery('/api/app/skills', query as QueryParams | undefined)
  const mcpsPath = (query?: McpServerQuery) => appendQuery('/api/app/mcps', query as QueryParams | undefined)
  const automationsPath = (query?: AutomationQuery) =>
    appendQuery('/api/app/automations', query as QueryParams | undefined)
  const memoryPath = (query?: MemoryQuery) => appendQuery('/api/app/memory', query as QueryParams | undefined)
  const outputsPath = (query?: OutputQuery) => appendQuery('/api/app/outputs', query as QueryParams | undefined)
  const notesPath = (query?: NoteQuery) => appendQuery('/api/app/notes', query as QueryParams | undefined)

  return {
    request,
    json,
    bootstrap: {
      get: (init?: RequestInit) => json<AppBootstrapResponse>('/api/app/bootstrap', init),
      getResponse: (init?: RequestInit) => request('/api/app/bootstrap', init),
    },
    conversations: {
      get: <T = ConversationGetResponse>(query?: ConversationQuery, init?: RequestInit) =>
        json<T>(conversationsPath(query), init),
      getResponse: (query?: ConversationQuery, init?: RequestInit) =>
        request(conversationsPath(query), init),
      create: (body: CreateConversationRequest, init?: RequestInit) =>
        json<CreateConversationResponse>(
          '/api/app/conversations',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      createResponse: (body: CreateConversationRequest, init?: RequestInit) =>
        request('/api/app/conversations', jsonRequest(body, { ...init, method: 'POST' })),
      update: (body: UpdateConversationRequest, init?: RequestInit) =>
        json<ConversationSummary>(
          '/api/app/conversations',
          jsonRequest(body, { ...init, method: 'PATCH' }),
        ),
      updateResponse: (body: UpdateConversationRequest, init?: RequestInit) =>
        request('/api/app/conversations', jsonRequest(body, { ...init, method: 'PATCH' })),
      deleteResponse: (query: { conversationId: string }, init?: RequestInit) =>
        request(conversationsPath(query), { ...init, method: 'DELETE' }),
      addMessage: (body: ConversationMessageRequest, init?: RequestInit) =>
        json<{ success: boolean; conversationId: string; turnId: string }>(
          '/api/app/conversations/message',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      addMessageResponse: (body: ConversationMessageRequest, init?: RequestInit) =>
        request('/api/app/conversations/message', jsonRequest(body, { ...init, method: 'POST' })),
      deleteMessageResponse: (
        body: { conversationId?: string; turnId?: string; accessToken?: string; userId?: string },
        init?: RequestInit,
      ) =>
        request('/api/app/conversations/message', jsonRequest(body, { ...init, method: 'DELETE' })),
      stopResponse: (
        body: {
          conversationId?: string
          messageId?: string
          partialContent?: string
          partialParts?: Array<Record<string, unknown>>
        },
        init?: RequestInit,
      ) =>
        request('/api/app/conversations/stop', jsonRequest(body, { ...init, method: 'POST' })),
    },
    files: {
      get: <T = KnowledgeFile[] | KnowledgeFile>(query?: FileQuery, init?: RequestInit) =>
        json<T>(filesPath(query), init),
      getResponse: (query?: FileQuery, init?: RequestInit) => request(filesPath(query), init),
      contentResponse: (fileId: string, init?: RequestInit) =>
        request(`/api/app/files/${encodeURIComponent(fileId)}/content`, init),
      create: (body: CreateFileRequest, init?: RequestInit) =>
        json<CreateFileResponse>('/api/app/files', jsonRequest(body, { ...init, method: 'POST' })),
      createResponse: (body: CreateFileRequest, init?: RequestInit) =>
        request('/api/app/files', jsonRequest(body, { ...init, method: 'POST' })),
      update: (body: UpdateFileRequest, init?: RequestInit) =>
        json<MutationSuccessResponse>(
          '/api/app/files',
          jsonRequest(body, { ...init, method: 'PATCH' }),
        ),
      updateResponse: (body: UpdateFileRequest, init?: RequestInit) =>
        request('/api/app/files', jsonRequest(body, { ...init, method: 'PATCH' })),
      deleteResponse: (query: { fileId: string }, init?: RequestInit) =>
        request(filesPath(query), { ...init, method: 'DELETE' }),
      ingestDocumentResponse: (body: BodyInit, init?: RequestInit) =>
        request('/api/app/files/ingest-document', { ...init, method: 'POST', body }),
      share: (body: FileShareRequest, init?: RequestInit) =>
        json<FileShareResponse>('/api/app/files/share', jsonRequest(body, { ...init, method: 'PATCH' })),
      shareResponse: (body: FileShareRequest, init?: RequestInit) =>
        request('/api/app/files/share', jsonRequest(body, { ...init, method: 'PATCH' })),
      uploadUrl: (body: FileUploadUrlRequest, init?: RequestInit) =>
        json<FileUploadUrlResponse>(
          '/api/app/files/upload-url',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      uploadUrlResponse: (body: FileUploadUrlRequest, init?: RequestInit) =>
        request('/api/app/files/upload-url', jsonRequest(body, { ...init, method: 'POST' })),
      presign: (query: FilePresignQuery, init?: RequestInit) =>
        json<FilePresignResponse>(
          appendQuery('/api/app/files/presign', query as unknown as QueryParams),
          init,
        ),
      presignResponse: (query: FilePresignQuery, init?: RequestInit) =>
        request(appendQuery('/api/app/files/presign', query as unknown as QueryParams), init),
      searchText: (body: FileTextSearchRequest, init?: RequestInit) =>
        json<FileTextSearchResponse>(
          '/api/app/files/search-text',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      searchTextResponse: (body: FileTextSearchRequest, init?: RequestInit) =>
        request('/api/app/files/search-text', jsonRequest(body, { ...init, method: 'POST' })),
    },
    memory: {
      get: <T = MemoryRow[] | MemoryRow>(query?: MemoryQuery, init?: RequestInit) =>
        json<T>(memoryPath(query), init),
      getResponse: (query?: MemoryQuery, init?: RequestInit) => request(memoryPath(query), init),
      create: (body: CreateMemoryRequest, init?: RequestInit) =>
        json<CreateMemoryResponse>('/api/app/memory', jsonRequest(body, { ...init, method: 'POST' })),
      createResponse: (body: CreateMemoryRequest, init?: RequestInit) =>
        request('/api/app/memory', jsonRequest(body, { ...init, method: 'POST' })),
      update: (body: UpdateMemoryRequest, init?: RequestInit) =>
        json<{ success: boolean; memory?: MemoryRow | null; error?: string }>(
          '/api/app/memory',
          jsonRequest(body, { ...init, method: 'PATCH' }),
        ),
      updateResponse: (body: UpdateMemoryRequest, init?: RequestInit) =>
        request('/api/app/memory', jsonRequest(body, { ...init, method: 'PATCH' })),
      deleteResponse: (query: { memoryId: string }, init?: RequestInit) =>
        request(memoryPath(query), { ...init, method: 'DELETE' }),
    },
    outputs: {
      get: <T = OutputSummary[]>(query?: OutputQuery, init?: RequestInit) =>
        json<T>(outputsPath(query), init),
      getResponse: (query?: OutputQuery, init?: RequestInit) => request(outputsPath(query), init),
      contentResponse: (outputId: string, init?: RequestInit) =>
        request(`/api/app/outputs/${encodeURIComponent(outputId)}/content`, init),
      deleteResponse: (query: { outputId: string }, init?: RequestInit) =>
        request(outputsPath(query), { ...init, method: 'DELETE' }),
      parseDeleteResponse: parseJson<DeleteOutputResponse>,
    },
    notes: {
      get: <T = NoteDoc[] | NoteDoc>(query?: NoteQuery, init?: RequestInit) =>
        json<T>(notesPath(query), init),
      getResponse: (query?: NoteQuery, init?: RequestInit) => request(notesPath(query), init),
      getCanonicalFiles: <T = KnowledgeFile[] | KnowledgeFile>(
        query?: Omit<FileQuery, 'kind'>,
        init?: RequestInit,
      ) => json<T>(filesPath({ ...query, kind: 'note' }), init),
      create: (body: CreateNoteRequest, init?: RequestInit) =>
        json<CreateNoteResponse>('/api/app/notes', jsonRequest(body, { ...init, method: 'POST' })),
      createResponse: (body: CreateNoteRequest, init?: RequestInit) =>
        request('/api/app/notes', jsonRequest(body, { ...init, method: 'POST' })),
      update: (body: UpdateNoteRequest, init?: RequestInit) =>
        json<UpdateNoteResponse>('/api/app/notes', jsonRequest(body, { ...init, method: 'PATCH' })),
      updateResponse: (body: UpdateNoteRequest, init?: RequestInit) =>
        request('/api/app/notes', jsonRequest(body, { ...init, method: 'PATCH' })),
      deleteResponse: (query: { noteId: string }, init?: RequestInit) =>
        request(notesPath(query), { ...init, method: 'DELETE' }),
      notebookAgentResponse: (body: NotebookAgentRequest, init?: RequestInit) =>
        request('/api/app/notebook-agent', jsonRequest(body, { ...init, method: 'POST' })),
      parseDeleteResponse: parseJson<DeleteNoteResponse>,
    },
    projects: {
      get: <T = ProjectSummary[] | ProjectSummary>(query?: ProjectQuery, init?: RequestInit) =>
        json<T>(projectsPath(query), init),
      getResponse: (query?: ProjectQuery, init?: RequestInit) => request(projectsPath(query), init),
      create: (body: CreateProjectRequest, init?: RequestInit) =>
        json<CreateProjectResponse>(
          '/api/app/projects',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      createResponse: (body: CreateProjectRequest, init?: RequestInit) =>
        request('/api/app/projects', jsonRequest(body, { ...init, method: 'POST' })),
      update: (body: UpdateProjectRequest, init?: RequestInit) =>
        json<UpdateProjectResponse>(
          '/api/app/projects',
          jsonRequest(body, { ...init, method: 'PATCH' }),
        ),
      updateResponse: (body: UpdateProjectRequest, init?: RequestInit) =>
        request('/api/app/projects', jsonRequest(body, { ...init, method: 'PATCH' })),
      deleteResponse: (query: { projectId: string }, init?: RequestInit) =>
        request(projectsPath(query), { ...init, method: 'DELETE' }),
      parseDeleteResponse: parseJson<DeleteProjectResponse>,
    },
    integrations: {
      get: <T = ConnectedIntegrationsResponse | IntegrationSearchResponse | IntegrationSummary[]>(
        query?: IntegrationQuery,
        init?: RequestInit,
      ) => json<T>(integrationsPath(query), init),
      getResponse: (query?: IntegrationQuery, init?: RequestInit) =>
        request(integrationsPath(query), init),
      connect: (body: IntegrationConnectionRequest, init?: RequestInit) =>
        json<IntegrationConnectionResponse>(
          '/api/app/integrations',
          jsonRequest({ ...body, action: body.action ?? 'connect' }, { ...init, method: 'POST' }),
        ),
      connectResponse: (body: IntegrationConnectionRequest, init?: RequestInit) =>
        request(
          '/api/app/integrations',
          jsonRequest({ ...body, action: body.action ?? 'connect' }, { ...init, method: 'POST' }),
        ),
      disconnectResponse: (toolkit: string | { toolkit: string; projectId?: string }, init?: RequestInit) =>
        request(
          '/api/app/integrations',
          jsonRequest(
            typeof toolkit === 'string'
              ? { action: 'disconnect', toolkit }
              : { action: 'disconnect', ...toolkit },
            { ...init, method: 'POST' },
          ),
        ),
      createResponse: (body: IntegrationConnectionRequest, init?: RequestInit) =>
        request('/api/app/integrations', jsonRequest(body, { ...init, method: 'POST' })),
      updateResponse: (body: IntegrationConnectionRequest, init?: RequestInit) =>
        request('/api/app/integrations', jsonRequest(body, { ...init, method: 'PATCH' })),
      deleteResponse: (query?: IntegrationQuery, init?: RequestInit) =>
        request(integrationsPath(query), { ...init, method: 'DELETE' }),
    },
    skills: {
      get: <T = SkillSummary[]>(query?: SkillQuery, init?: RequestInit) =>
        json<T>(skillsPath(query), init),
      getResponse: (query?: SkillQuery, init?: RequestInit) => request(skillsPath(query), init),
      create: (body: CreateSkillRequest, init?: RequestInit) =>
        json<CreateEntityResponse>(
          '/api/app/skills',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      createResponse: (body: CreateSkillRequest, init?: RequestInit) =>
        request('/api/app/skills', jsonRequest(body, { ...init, method: 'POST' })),
      update: (body: UpdateSkillRequest, init?: RequestInit) =>
        json<MutationSuccessResponse>(
          '/api/app/skills',
          jsonRequest(body, { ...init, method: 'PATCH' }),
        ),
      updateResponse: (body: UpdateSkillRequest, init?: RequestInit) =>
        request('/api/app/skills', jsonRequest(body, { ...init, method: 'PATCH' })),
      deleteResponse: (query: { skillId: string }, init?: RequestInit) =>
        request(skillsPath(query), { ...init, method: 'DELETE' }),
    },
    mcpServers: {
      get: <T = McpServerSummary[]>(query?: McpServerQuery, init?: RequestInit) =>
        json<T>(mcpsPath(query), init),
      getResponse: (query?: McpServerQuery, init?: RequestInit) => request(mcpsPath(query), init),
      create: (body: CreateMcpServerRequest, init?: RequestInit) =>
        json<CreateEntityResponse>('/api/app/mcps', jsonRequest(body, { ...init, method: 'POST' })),
      createResponse: (body: CreateMcpServerRequest, init?: RequestInit) =>
        request('/api/app/mcps', jsonRequest(body, { ...init, method: 'POST' })),
      update: (body: UpdateMcpServerRequest, init?: RequestInit) =>
        json<MutationSuccessResponse>(
          '/api/app/mcps',
          jsonRequest(body, { ...init, method: 'PATCH' }),
        ),
      updateResponse: (body: UpdateMcpServerRequest, init?: RequestInit) =>
        request('/api/app/mcps', jsonRequest(body, { ...init, method: 'PATCH' })),
      deleteResponse: (query: { mcpServerId: string }, init?: RequestInit) =>
        request(mcpsPath(query), { ...init, method: 'DELETE' }),
      test: (body: TestMcpServerRequest, init?: RequestInit) =>
        json<TestMcpServerResponse>(
          '/api/app/mcps/test',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      testResponse: (body: TestMcpServerRequest, init?: RequestInit) =>
        request('/api/app/mcps/test', jsonRequest(body, { ...init, method: 'POST' })),
    },
    automations: {
      get: <T = AutomationSummary[] | AutomationSummary>(
        query?: AutomationQuery,
        init?: RequestInit,
      ) => json<T>(automationsPath(query), init),
      getResponse: (query?: AutomationQuery, init?: RequestInit) =>
        request(automationsPath(query), init),
      create: (body: CreateAutomationRequest, init?: RequestInit) =>
        json<CreateAutomationResponse>(
          '/api/app/automations',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      createResponse: (body: CreateAutomationRequest, init?: RequestInit) =>
        request('/api/app/automations', jsonRequest(body, { ...init, method: 'POST' })),
      update: (body: UpdateAutomationRequest, init?: RequestInit) =>
        json<{ success?: boolean; error?: string }>(
          '/api/app/automations',
          jsonRequest(body, { ...init, method: 'PATCH' }),
        ),
      updateResponse: (body: UpdateAutomationRequest, init?: RequestInit) =>
        request('/api/app/automations', jsonRequest(body, { ...init, method: 'PATCH' })),
      deleteResponse: (query: { automationId: string }, init?: RequestInit) =>
        request(automationsPath(query), { ...init, method: 'DELETE' }),
      parseDeleteResponse: parseJson<DeleteAutomationResponse>,
      run: (body: AutomationRunRequest, init?: RequestInit) =>
        json<AutomationRunResponse>(
          '/api/app/automations/run',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      runResponse: (body: AutomationRunRequest, init?: RequestInit) =>
        request('/api/app/automations/run', jsonRequest(body, { ...init, method: 'POST' })),
      test: (body: AutomationTestRequest, init?: RequestInit) =>
        json<AutomationTestResponse>(
          '/api/app/automations/test',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      testResponse: (body: AutomationTestRequest, init?: RequestInit) =>
        request('/api/app/automations/test', jsonRequest(body, { ...init, method: 'POST' })),
    },
    settings: {
      get: (init?: RequestInit) => json<AppSettings>('/api/app/settings', init),
      getResponse: (init?: RequestInit) => request('/api/app/settings', init),
      update: (body: Partial<AppSettings>, init?: RequestInit) =>
        json<AppSettings>('/api/app/settings', jsonRequest(body, { ...init, method: 'PATCH' })),
      updateResponse: (body: Partial<AppSettings>, init?: RequestInit) =>
        request('/api/app/settings', jsonRequest(body, { ...init, method: 'PATCH' })),
    },
    subscription: {
      get: (init?: RequestInit) => json<Entitlements>('/api/app/subscription', init),
      getResponse: (init?: RequestInit) => request('/api/app/subscription', init),
      getSettings: (init?: RequestInit) =>
        json<BillingSettings>('/api/subscription/settings', init),
      getSettingsResponse: (init?: RequestInit) => request('/api/subscription/settings', init),
      updateSettings: (body: UpdateBillingSettingsRequest, init?: RequestInit) =>
        json<BillingSettings>(
          '/api/subscription/settings',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      updateSettingsResponse: (
        body: UpdateBillingSettingsRequest,
        init?: RequestInit,
      ) =>
        request('/api/subscription/settings', jsonRequest(body, { ...init, method: 'POST' })),
    },
    account: {
      entitlements: (init?: RequestInit) => json<AccountEntitlements>('/api/entitlements', init),
      entitlementsResponse: (init?: RequestInit) => request('/api/entitlements', init),
      desktopLink: (body: DesktopLinkRequest, init?: RequestInit) =>
        json<DesktopLinkResponse>(
          '/api/auth/desktop-link',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      desktopLinkResponse: (body: DesktopLinkRequest, init?: RequestInit) =>
        request('/api/auth/desktop-link', jsonRequest(body, { ...init, method: 'POST' })),
      deleteResponse: (body: Record<string, unknown> = {}, init?: RequestInit) =>
        request('/api/account/delete', jsonRequest(body, { ...init, method: 'POST' })),
    },
    billing: {
      portal: (body: BillingPortalRequest = {}, init?: RequestInit) =>
        json<BillingPortalResponse>('/api/portal', jsonRequest(body, { ...init, method: 'POST' })),
      portalResponse: (body: BillingPortalRequest = {}, init?: RequestInit) =>
        request('/api/portal', jsonRequest(body, { ...init, method: 'POST' })),
      verifyCheckout: (body: CheckoutVerifyRequest, init?: RequestInit) =>
        json<CheckoutVerifyResponse>(
          '/api/checkout/verify',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      verifyCheckoutResponse: (body: CheckoutVerifyRequest, init?: RequestInit) =>
        request('/api/checkout/verify', jsonRequest(body, { ...init, method: 'POST' })),
    },
    topUps: {
      history: (init?: RequestInit) => json<TopUpHistoryResponse>('/api/topups/history', init),
      historyResponse: (init?: RequestInit) => request('/api/topups/history', init),
      checkout: (body: TopUpCheckoutRequest, init?: RequestInit) =>
        json<TopUpCheckoutResponse>(
          '/api/topups/checkout',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      checkoutResponse: (body: TopUpCheckoutRequest, init?: RequestInit) =>
        request('/api/topups/checkout', jsonRequest(body, { ...init, method: 'POST' })),
      verify: (body: TopUpVerifyRequest, init?: RequestInit) =>
        json<TopUpVerifyResponse>(
          '/api/topups/verify',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      verifyResponse: (body: TopUpVerifyRequest, init?: RequestInit) =>
        request('/api/topups/verify', jsonRequest(body, { ...init, method: 'POST' })),
    },
    onboarding: {
      status: (init?: RequestInit) =>
        json<OnboardingStatusResponse>('/api/app/onboarding/status', init),
      statusResponse: (init?: RequestInit) => request('/api/app/onboarding/status', init),
      complete: (body: { accessToken?: string; userId?: string } = {}, init?: RequestInit) =>
        json<OnboardingCompleteResponse>(
          '/api/app/onboarding/complete',
          jsonRequest(body, { ...init, method: 'POST' }),
        ),
      completeResponse: (body: { accessToken?: string; userId?: string } = {}, init?: RequestInit) =>
        request('/api/app/onboarding/complete', jsonRequest(body, { ...init, method: 'POST' })),
      resetResponse: (body: { accessToken?: string; userId?: string } = {}, init?: RequestInit) =>
        request('/api/app/onboarding/reset', jsonRequest(body, { ...init, method: 'POST' })),
    },
    chat: {
      suggestionsResponse: (init?: RequestInit) => request('/api/app/chat-suggestions', init),
      generateTitleResponse: (body: { text?: string; message?: string }, init?: RequestInit) =>
        request('/api/app/generate-title', jsonRequest(body, { ...init, method: 'POST' })),
      generateImageResponse: (body: Record<string, unknown>, init?: RequestInit) =>
        request('/api/app/generate-image', jsonRequest(body, { ...init, method: 'POST' })),
      generateVideoResponse: (body: Record<string, unknown>, init?: RequestInit) =>
        request('/api/app/generate-video', jsonRequest(body, { ...init, method: 'POST' })),
    },
    automationRuns: {
      runResponse: (body: AutomationRunRequest, init?: RequestInit) =>
        request('/api/app/automations/run', jsonRequest(body, { ...init, method: 'POST' })),
      testResponse: (body: AutomationTestRequest, init?: RequestInit) =>
        request('/api/app/automations/test', jsonRequest(body, { ...init, method: 'POST' })),
      parseRunDetail: parseJson<AutomationRunDetail>,
    },
  }
}

export type OverlayAppClient = ReturnType<typeof createOverlayAppClient>
