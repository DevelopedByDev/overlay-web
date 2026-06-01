import type { ZodTypeAny } from 'zod'
import {
  CreateWebhookSubscriptionRequest,
  DeleteWebhookSubscriptionRequest,
  UpdateWebhookSubscriptionRequest,
  WebhookSubscriptionListQuery,
} from './webhooks'
import {
  ActConversationRequest,
  AddConversationMessageRequest,
  AutomationListQuery,
  BrowserTaskRequest,
  BootstrapQuery,
  ChatSuggestionQuery,
  ConversationListQuery,
  CreateAutomationRequest,
  CreateConversationRequest,
  CreateFileRequest,
  CreateMemoryRequest,
  CreateNoteRequest,
  CreateProjectRequest,
  DaytonaRunRequest,
  DeleteAutomationRequest,
  DeleteConversationMessageRequest,
  DeleteConversationRequest,
  DeleteFileRequest,
  DeleteMemoryRequest,
  DeleteNoteRequest,
  DeleteOutputRequest,
  DeleteProjectRequest,
  EntityDeleteRequest,
  EntityListQuery,
  EntityMutationRequest,
  FileContentQuery,
  FileListQuery,
  GenerateImageRequest,
  GenerateTabGroupLabelRequest,
  GenerateTitleRequest,
  GenerateVideoRequest,
  IngestDocumentForm,
  IntegrationConnectRequest,
  IntegrationListQuery,
  KnowledgeSearchRequest,
  McpTestRequest,
  MemoryListQuery,
  NoteListQuery,
  NotebookAgentRequest,
  OnboardingMutationRequest,
  OnboardingStatusQuery,
  OutputContentQuery,
  OutputListQuery,
  PresignFileQuery,
  ProjectListQuery,
  SearchFileTextRequest,
  BillingSettingsQuery,
  SettingsQuery,
  ShareConversationRequest,
  ShareFileRequest,
  StopConversationRequest,
  StreamAuthRequest,
  SubscriptionQuery,
  TestAutomationRequest,
  TranscribeRequest,
  UpdateAutomationRequest,
  UpdateConversationRequest,
  UpdateFileRequest,
  UpdateMemoryRequest,
  UpdateNoteRequest,
  UpdateBillingSettingsRequest,
  UpdateProjectRequest,
  UpdateSettingsRequest,
  UploadUrlRequest,
  RunAutomationRequest,
} from './index'

export type ApiBoundarySchema = {
  query?: ZodTypeAny
  json?: ZodTypeAny
  formData?: ZodTypeAny
  response?: ZodTypeAny
}

type DynamicBoundary = {
  method: string
  pattern: RegExp
  schema: ApiBoundarySchema
}

const exactBoundaries: Record<string, ApiBoundarySchema> = {
  'GET /api/v1/automations': { query: AutomationListQuery },
  'POST /api/v1/automations': { json: CreateAutomationRequest },
  'PATCH /api/v1/automations': { json: UpdateAutomationRequest },
  'DELETE /api/v1/automations': { query: DeleteAutomationRequest, json: DeleteAutomationRequest },
  'POST /api/v1/automations/run': { json: RunAutomationRequest },
  'POST /api/v1/automations/test': { json: TestAutomationRequest },
  'GET /api/v1/bootstrap': { query: BootstrapQuery },
  'POST /api/v1/browser-task': { json: BrowserTaskRequest },
  'GET /api/v1/chat-suggestions': { query: ChatSuggestionQuery },
  'GET /api/v1/conversations': { query: ConversationListQuery },
  'POST /api/v1/conversations': { json: CreateConversationRequest },
  'PATCH /api/v1/conversations': { json: UpdateConversationRequest },
  'DELETE /api/v1/conversations': { query: DeleteConversationRequest, json: DeleteConversationRequest },
  'POST /api/v1/conversations/act': { json: ActConversationRequest },
  'POST /api/v1/conversations/act/extension-plan': { json: ActConversationRequest },
  'POST /api/v1/conversations/message': { json: AddConversationMessageRequest },
  'DELETE /api/v1/conversations/message': { json: DeleteConversationMessageRequest },
  'PATCH /api/v1/conversations/share': { json: ShareConversationRequest },
  'POST /api/v1/conversations/stop': { json: StopConversationRequest },
  'POST /api/v1/conversations/stream-auth': { json: StreamAuthRequest },
  'POST /api/v1/daytona/run': { json: DaytonaRunRequest },
  'GET /api/v1/files': { query: FileListQuery },
  'POST /api/v1/files': { json: CreateFileRequest },
  'PATCH /api/v1/files': { json: UpdateFileRequest },
  'DELETE /api/v1/files': { query: DeleteFileRequest, json: DeleteFileRequest },
  'POST /api/v1/files/ingest-document': { formData: IngestDocumentForm },
  'GET /api/v1/files/presign': { query: PresignFileQuery },
  'POST /api/v1/files/search-text': { json: SearchFileTextRequest },
  'PATCH /api/v1/files/share': { json: ShareFileRequest },
  'POST /api/v1/files/upload-url': { json: UploadUrlRequest },
  'POST /api/v1/generate-image': { json: GenerateImageRequest },
  'POST /api/v1/generate-tab-group-label': { json: GenerateTabGroupLabelRequest },
  'POST /api/v1/generate-title': { json: GenerateTitleRequest },
  'POST /api/v1/generate-video': { json: GenerateVideoRequest },
  'GET /api/v1/integrations': { query: IntegrationListQuery },
  'POST /api/v1/integrations': { json: IntegrationConnectRequest },
  'POST /api/v1/knowledge/search': { json: KnowledgeSearchRequest },
  'GET /api/v1/mcps': { query: EntityListQuery },
  'POST /api/v1/mcps': { json: EntityMutationRequest },
  'PATCH /api/v1/mcps': { json: EntityMutationRequest },
  'DELETE /api/v1/mcps': { query: EntityDeleteRequest, json: EntityDeleteRequest },
  'POST /api/v1/mcps/test': { json: McpTestRequest },
  'GET /api/v1/memory': { query: MemoryListQuery },
  'POST /api/v1/memory': { json: CreateMemoryRequest },
  'PATCH /api/v1/memory': { json: UpdateMemoryRequest },
  'DELETE /api/v1/memory': { query: DeleteMemoryRequest, json: DeleteMemoryRequest },
  'POST /api/v1/notebook-agent': { json: NotebookAgentRequest },
  'GET /api/v1/notes': { query: NoteListQuery },
  'POST /api/v1/notes': { json: CreateNoteRequest },
  'PATCH /api/v1/notes': { json: UpdateNoteRequest },
  'DELETE /api/v1/notes': { query: DeleteNoteRequest, json: DeleteNoteRequest },
  'POST /api/v1/onboarding/complete': { json: OnboardingMutationRequest },
  'POST /api/v1/onboarding/reset': { json: OnboardingMutationRequest },
  'GET /api/v1/onboarding/status': { query: OnboardingStatusQuery },
  'GET /api/v1/outputs': { query: OutputListQuery },
  'DELETE /api/v1/outputs': { query: DeleteOutputRequest, json: DeleteOutputRequest },
  'GET /api/v1/projects': { query: ProjectListQuery },
  'POST /api/v1/projects': { json: CreateProjectRequest },
  'PATCH /api/v1/projects': { json: UpdateProjectRequest },
  'DELETE /api/v1/projects': { query: DeleteProjectRequest, json: DeleteProjectRequest },
  'GET /api/v1/settings': { query: SettingsQuery },
  'PATCH /api/v1/settings': { json: UpdateSettingsRequest },
  'GET /api/v1/skills': { query: EntityListQuery },
  'POST /api/v1/skills': { json: EntityMutationRequest },
  'PATCH /api/v1/skills': { json: EntityMutationRequest },
  'DELETE /api/v1/skills': { query: EntityDeleteRequest, json: EntityDeleteRequest },
  'GET /api/v1/subscription': { query: SubscriptionQuery },
  'GET /api/v1/subscription/settings': { query: BillingSettingsQuery },
  'POST /api/v1/subscription/settings': { json: UpdateBillingSettingsRequest },
  'POST /api/v1/transcribe': { formData: TranscribeRequest },
  'GET /api/v1/webhooks': { query: WebhookSubscriptionListQuery },
  'POST /api/v1/webhooks': { json: CreateWebhookSubscriptionRequest },
  'PATCH /api/v1/webhooks': { json: UpdateWebhookSubscriptionRequest },
  'DELETE /api/v1/webhooks': { query: DeleteWebhookSubscriptionRequest, json: DeleteWebhookSubscriptionRequest },
}

const dynamicBoundaries: DynamicBoundary[] = [
  { method: 'GET', pattern: /^\/api\/v1\/files\/[^/]+\/content$/, schema: { query: FileContentQuery } },
  { method: 'GET', pattern: /^\/api\/v1\/outputs\/[^/]+\/content$/, schema: { query: OutputContentQuery } },
]

export function getApiBoundarySchema(pathname: string, method: string): ApiBoundarySchema | undefined {
  const key = `${method.toUpperCase()} ${pathname.replace(/\/+$/, '') || '/'}`
  const exact = exactBoundaries[key]
  if (exact) return exact
  return dynamicBoundaries.find((entry) => entry.method === method.toUpperCase() && entry.pattern.test(pathname))
    ?.schema
}

export function queryParamsToObject(searchParams: URLSearchParams): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {}
  for (const [key, value] of searchParams.entries()) {
    const existing = query[key]
    if (existing === undefined) {
      query[key] = value
    } else if (Array.isArray(existing)) {
      existing.push(value)
    } else {
      query[key] = [existing, value]
    }
  }
  return query
}

export function validateApiClientBoundary(args: {
  body?: unknown
  method?: string
  path: string
}): void {
  const url = new URL(args.path, 'https://overlay.local')
  const method = (args.method ?? 'GET').toUpperCase()
  const schema = getApiBoundarySchema(url.pathname, method)
  if (!schema) return

  if (schema.query) {
    const result = schema.query.safeParse(queryParamsToObject(url.searchParams))
    if (!result.success) {
      throw new Error(`Invalid ${method} ${url.pathname} query: ${result.error.issues[0]?.message ?? 'validation failed'}`)
    }
  }

  if (args.body !== undefined && schema.json) {
    const result = schema.json.safeParse(args.body)
    if (!result.success) {
      throw new Error(`Invalid ${method} ${url.pathname} body: ${result.error.issues[0]?.message ?? 'validation failed'}`)
    }
  }
}
