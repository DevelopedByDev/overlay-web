import type { LLMGateway as CoreLLMGateway } from '@overlay/llm-gateway'
import type {
  AuthProvider,
  AuthUser,
} from '@overlay/auth-contracts'
import type {
  ObjectStore,
  VectorStore,
} from '@overlay/storage-contracts'
import type {
  BillingProvider,
  Entitlements,
} from '@overlay/billing'
import type { CapabilityCheck, OverlayCapability } from './capabilities'

export type {
  LanguageModel,
  LLMGateway,
  ModelInfo,
  ModelOptions,
  PricingInfo,
} from '@overlay/llm-gateway'
export type {
  AuthProvider,
  AuthUser,
  Session,
  TokenClaims,
  User,
  UserProfile,
} from '@overlay/auth-contracts'
export {
  AuthConfigurationError,
  AuthError,
  ForbiddenError,
  InvalidTokenError,
  SessionExpiredError,
  UnauthorizedError,
  isAuthError,
  type AuthErrorCode,
} from '@overlay/auth-contracts'
export type {
  DownloadUrl,
  FileMetadata,
  ObjectStore,
  ObjectSummary,
  QueryResult,
  UploadUrl,
  VectorStore,
} from '@overlay/storage-contracts'
export type {
  BillingProvider,
  CheckoutArgs,
  CheckoutResult,
  CheckoutSessionVerificationArgs,
  CheckoutSessionVerificationResult,
  Entitlements,
  PortalResult,
  PortalSessionArgs,
  UsageArgs,
  UsageKind,
} from '@overlay/billing'

export type ThemePreference = 'light' | 'dark'
/** Token streaming is the only supported mode; the field remains for API/storage compatibility. */
export type ChatStreamingMode = 'token'
export type ChatModePreference = 'ask' | 'act'

export type ThemePresetId =
  | 'default-light'
  | 'default-dark'
  | 'absolutely-light'
  | 'catppuccin-light'
  | 'codex-light'
  | 'everforest-light'
  | 'github-light'
  | 'linear-light'
  | 'notion-light'
  | 'one-light'
  | 'proof-light'
  | 'raycast-light'
  | 'rose-pine-light'
  | 'absolutely'
  | 'codex'
  | 'catppuccin'
  | 'dracula'
  | 'everforest'
  | 'github'
  | 'gruvbox'
  | 'linear'
  | 'lobster'
  | 'material'
  | 'matrix'
  | 'monokai'
  | 'night-owl'
  | 'nord'
  | 'notion'
  | 'one'
  | 'oscurange'
  | 'raycast'
  | 'rose-pine'
  | 'sentry'
  | 'solarized'
  | 'temple'
  | 'tokyo-night'
  | 'vercel'
  | 'vscode-plus'
  | 'xcode'

export interface AppSettings {
  theme: ThemePreference
  lightThemePreset: ThemePresetId
  darkThemePreset: ThemePresetId
  useSecondarySidebar: boolean
  chatStreamingMode: ChatStreamingMode
  autoContinue: boolean
  defaultChatMode: ChatModePreference
  defaultAskModelIds: string[]
  defaultActModelId?: string
  defaultImageModelId?: string
  defaultVideoModelId?: string
  defaultImageAspectRatio?: string
  defaultVideoAspectRatio?: string
  sendWithEnter: boolean
  attachFilesToKnowledgeByDefault: boolean
  onlyAllowZdrModels: boolean
  dismissedZdrWarningGlobally: boolean
  dismissedZdrWarningModelIds: string[]
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'light',
  lightThemePreset: 'default-light',
  darkThemePreset: 'default-dark',
  useSecondarySidebar: false,
  chatStreamingMode: 'token',
  autoContinue: false,
  defaultChatMode: 'act',
  defaultAskModelIds: [],
  defaultActModelId: undefined,
  defaultImageModelId: undefined,
  defaultVideoModelId: undefined,
  defaultImageAspectRatio: undefined,
  defaultVideoAspectRatio: undefined,
  sendWithEnter: true,
  attachFilesToKnowledgeByDefault: false,
  onlyAllowZdrModels: false,
  dismissedZdrWarningGlobally: false,
  dismissedZdrWarningModelIds: [],
}

export interface ChatModel {
  id: string
  name: string
  provider:
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'groq'
    | 'xai'
    | 'openrouter'
    | 'minimax'
    | 'moonshotai'
    | 'zai'
    | 'alibaba'
    | string
  description?: string
  intelligence: number
  cost: 0 | 1 | 2 | 3
  /** Relative latency: 1 = heavier/slower, 3 = faster/lighter. */
  speedTier: 1 | 2 | 3
  supportsVision: boolean
  supportsReasoning: boolean
  supportsSearch: boolean
  supportsZeroDataRetention?: boolean
  /** Price per 1M blended tokens ($). */
  pricePer1mTokens?: number
  /** Median output tokens per second. */
  medianOutputTokensPerSecond?: number
}

export interface ImageModel {
  id: string
  name: string
  provider: string
  description?: string
  defaultAspectRatio?: string
}

export interface VideoModel {
  id: string
  name: string
  provider: string
  description?: string
  billingUnit: 'per_video' | 'per_second'
  defaultDuration?: number
  defaultAspectRatio?: string
}

export type AppDestinationId =
  | 'chat'
  | 'files'
  | 'notes'
  | 'knowledge'
  | 'extensions'
  | 'projects'
  | 'automations'
  | 'settings'
  | 'account'

export type KnowledgeSubview = 'memories' | 'files' | 'outputs'
export type ExtensionsSubview = 'connectors' | 'skills' | 'mcps' | 'apps' | 'all'
export type SettingsSubview =
  | 'general'
  | 'account'
  | 'customization'
  | 'memories'
  | 'models'
  | 'contact'
export type ProjectSubview = 'chat' | 'note' | 'file'

export interface AppDestinationConfig {
  id: AppDestinationId
  label: string
  href: string
  subviews?: readonly string[]
}

export const CANONICAL_APP_DESTINATIONS: readonly AppDestinationConfig[] = [
  { id: 'chat', label: 'Chat', href: '/app/chat' },
  {
    id: 'files',
    label: 'Files',
    href: '/app/files',
    subviews: ['files', 'outputs'],
  },
  {
    id: 'extensions',
    label: 'Extensions',
    href: '/app/tools',
    subviews: ['connectors', 'skills', 'mcps', 'apps', 'all'],
  },
  { id: 'projects', label: 'Projects', href: '/app/projects' },
  { id: 'automations', label: 'Automations', href: '/app/automations' },
  {
    id: 'settings',
    label: 'Settings',
    href: '/app/settings',
    subviews: ['general', 'account', 'customization', 'models', 'contact'],
  },
  { id: 'account', label: 'Account', href: '/account' },
] as const

export interface AppFeatureFlags {
  canUseVoiceTranscription: boolean
  canUseKnowledge: boolean
  canUseProjects: boolean
  canUseAutomations: boolean
  canUseExtensions: boolean
}

export type OverlayIconName =
  | 'arrow-up'
  | 'chrome'
  | 'file-text'
  | 'folder-open'
  | 'mail'
  | 'message-square'
  | 'monitor'
  | 'palette'
  | 'package'
  | 'panels-left-right'
  | 'play'
  | 'plug'
  | 'puzzle'
  | 'server'
  | 'settings'
  | 'shield-check'
  | 'smartphone'
  | 'sparkles'
  | 'user'
  | 'workflow'

export type OverlayFeatureFlagId =
  | 'voiceTranscription'
  | 'knowledge'
  | 'projects'
  | 'automations'
  | 'extensions'
  | (string & {})

export interface OverlayFeatureFlag {
  id: OverlayFeatureFlagId
  label: string
  enabled: boolean
  description?: string
  requiredCapabilities?: readonly OverlayCapability[]
}

export interface OverlayBrandConfig {
  name: string
  shortName?: string
  logoSrc: string
  logoAlt?: string
  homeHref: string
  supportEmail?: string
  organizationName?: string
}

export interface OverlayNavigationItem {
  id: AppDestinationId | (string & {})
  label: string
  href: string
  icon: OverlayIconName
  componentKey?: string
  disabled?: boolean
  featureFlagId?: OverlayFeatureFlagId
  requiredCapabilities?: readonly OverlayCapability[]
  subviews?: readonly string[]
}

export interface OverlaySettingsSection {
  id: SettingsSubview | (string & {})
  label: string
  href?: string
  icon?: OverlayIconName
  componentKey?: string
  disabled?: boolean
  featureFlagId?: OverlayFeatureFlagId
  requiredCapabilities?: readonly OverlayCapability[]
}

export type OverlayFeatureModuleId =
  | 'files-knowledge'
  | 'notes'
  | 'projects'
  | 'tools-extensions'
  | 'settings-account'
  | (string & {})

export interface OverlayFeatureModule {
  id: OverlayFeatureModuleId
  label: string
  description?: string
  navigationItemId?: OverlayNavigationItem['id']
  routePatterns: readonly string[]
  componentKey: string
  packageName?: string
  featureFlagId?: OverlayFeatureFlagId
  requiredCapabilities?: readonly OverlayCapability[]
  order?: number
}

export type OverlaySidebarActionKey =
  | 'chat.create'
  | 'notes.create'
  | 'projects.create'
  | 'automations.create'
  | (string & {})

export type OverlaySidebarSearchCategory =
  | 'file'
  | 'connector'
  | 'automation'
  | 'skill'
  | 'mcp'
  | 'chat'
  | (string & {})

export interface OverlaySidebarAction {
  id: string
  label: string
  actionKey: OverlaySidebarActionKey
  navigationItemId?: OverlayNavigationItem['id']
  featureModuleId?: OverlayFeatureModuleId
  routePatterns: readonly string[]
  searchCategory?: OverlaySidebarSearchCategory
  requiresAuth?: boolean
  primaryNavAction?: boolean
  featureFlagId?: OverlayFeatureFlagId
  requiredCapabilities?: readonly OverlayCapability[]
  order?: number
}

export interface OverlaySettingsPanel {
  id: SettingsSubview | (string & {})
  label: string
  sectionId: OverlaySettingsSection['id']
  componentKey: string
  description?: string
  featureFlagId?: OverlayFeatureFlagId
  requiredCapabilities?: readonly OverlayCapability[]
  order?: number
}

export interface OverlayToolRegistration {
  id: string
  label: string
  description?: string
  category?: 'browser' | 'knowledge' | 'integration' | 'automation' | 'developer' | (string & {})
  componentKey?: string
  featureFlagId?: OverlayFeatureFlagId
  requiredCapabilities?: readonly OverlayCapability[]
  policyGateId?: string
}

export interface OverlayIntegrationRegistration {
  id: string
  label: string
  providerKey: string
  description?: string
  logoSrc?: string
  componentKey?: string
  featureFlagId?: OverlayFeatureFlagId
  requiredCapabilities?: readonly OverlayCapability[]
  policyGateId?: string
}

export interface OverlayModelProviderRegistration {
  id: string
  label: string
  providerKey: string
  description?: string
  logoSrc?: string
  componentKey?: string
  requiredCapabilities?: readonly OverlayCapability[]
  policyGateId?: string
}

export interface OverlayPolicyGate {
  id: string
  label: string
  description?: string
  defaultEnabled: boolean
  enforcement: 'hide' | 'disable' | 'warn'
  reason?: string
}

export interface OverlayThemePresetSummary {
  id: ThemePresetId
  name: string
  variant: ThemePreference
  previewColors: {
    background: string
    accent: string
  }
}

export interface OverlayThemeMetadata {
  defaultLightPreset: ThemePresetId
  defaultDarkPreset: ThemePresetId
  presets: readonly OverlayThemePresetSummary[]
  cssVarKeys: readonly string[]
}

export interface OverlayModelPolicyContext {
  user: AuthUser | null
  entitlements: Entitlements | null
}

export interface OverlayModelPolicyHooks {
  filterChatModels?: (
    models: readonly ChatModel[],
    context: OverlayModelPolicyContext,
  ) => readonly ChatModel[]
  filterImageModels?: (
    models: readonly ImageModel[],
    context: OverlayModelPolicyContext,
  ) => readonly ImageModel[]
  filterVideoModels?: (
    models: readonly VideoModel[],
    context: OverlayModelPolicyContext,
  ) => readonly VideoModel[]
  getDefaultChatModelId?: (
    models: readonly ChatModel[],
    context: OverlayModelPolicyContext,
  ) => string | undefined
  getDefaultImageModelId?: (
    models: readonly ImageModel[],
    context: OverlayModelPolicyContext,
  ) => string | undefined
  getDefaultVideoModelId?: (
    models: readonly VideoModel[],
    context: OverlayModelPolicyContext,
  ) => string | undefined
}

export interface OverlayAppConfig {
  brand?: Partial<OverlayBrandConfig>
  navigation?: readonly OverlayNavigationItem[]
  settingsSections?: readonly OverlaySettingsSection[]
  featureFlags?: readonly OverlayFeatureFlag[]
  featureModules?: readonly OverlayFeatureModule[]
  sidebarActions?: readonly OverlaySidebarAction[]
  settingsPanels?: readonly OverlaySettingsPanel[]
  tools?: readonly OverlayToolRegistration[]
  integrations?: readonly OverlayIntegrationRegistration[]
  modelProviders?: readonly OverlayModelProviderRegistration[]
  policyGates?: readonly OverlayPolicyGate[]
  theme?: Partial<OverlayThemeMetadata>
  modelPolicy?: OverlayModelPolicyHooks
  authProvider?: AuthProvider
  billingProvider?: BillingProvider
  objectStore?: ObjectStore
  vectorStore?: VectorStore
  llmGateway?: CoreLLMGateway
  rateLimiter?: RateLimiter
  eventBus?: EventBus
}

export interface OverlayAppShellRegistry {
  brand: OverlayBrandConfig
  navigation: readonly OverlayNavigationItem[]
  settingsSections: readonly OverlaySettingsSection[]
  featureFlags: readonly OverlayFeatureFlag[]
  featureModules: readonly OverlayFeatureModule[]
  sidebarActions: readonly OverlaySidebarAction[]
  settingsPanels: readonly OverlaySettingsPanel[]
  tools: readonly OverlayToolRegistration[]
  integrations: readonly OverlayIntegrationRegistration[]
  modelProviders: readonly OverlayModelProviderRegistration[]
  policyGates: readonly OverlayPolicyGate[]
  appFeatureFlags: AppFeatureFlags
  capabilities: CapabilityCheck
  theme: OverlayThemeMetadata
}

export interface AppBootstrapDefaults {
  chatModelId?: string
  imageModelId?: string
  videoModelId?: string
}

export interface AppBootstrapResponse {
  user: AuthUser | null
  entitlements: Entitlements | null
  uiSettings: AppSettings
  chatModels: ChatModel[]
  imageModels: ImageModel[]
  videoModels: VideoModel[]
  brand?: OverlayBrandConfig
  navigation?: OverlayNavigationItem[]
  settingsSections?: OverlaySettingsSection[]
  featureFlagRegistry?: OverlayFeatureFlag[]
  featureModules?: OverlayFeatureModule[]
  sidebarActions?: OverlaySidebarAction[]
  settingsPanels?: OverlaySettingsPanel[]
  toolRegistry?: OverlayToolRegistration[]
  integrationRegistry?: OverlayIntegrationRegistration[]
  modelProviderRegistry?: OverlayModelProviderRegistration[]
  policyGates?: OverlayPolicyGate[]
  theme?: OverlayThemeMetadata
  featureFlags: AppFeatureFlags
  capabilities: CapabilityCheck
  destinations: AppDestinationConfig[]
  defaults?: AppBootstrapDefaults
}

export type AppBootstrap = AppBootstrapResponse

export type AutomationSchedule =
  | { kind: 'interval'; intervalMinutes?: number }
  | { kind: 'daily'; hourUTC?: number; minuteUTC?: number }
  | { kind: 'weekly'; dayOfWeekUTC?: number; hourUTC?: number; minuteUTC?: number }
  | { kind: 'monthly'; dayOfMonthUTC?: number; hourUTC?: number; minuteUTC?: number }

export interface AutomationSummary {
  _id: string
  name?: string
  title?: string
  description?: string
  instructions?: string
  instructionsMarkdown?: string
  enabled?: boolean
  schedule?: AutomationSchedule
  timezone?: string
  nextRunAt?: number
  lastRunAt?: number
  lastRunStatus?: string
  lastError?: string
  projectId?: string
  modelId?: string
  graphSource?: string
  sourceConversationId?: string
  conversationId?: string
  concurrencyPolicy?: 'skip' | 'queue'
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export type AutomationRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'succeeded'
  | 'failed'
  | 'skipped'

export interface AutomationRunSummary {
  _id: string
  automationId: string
  userId?: string
  status: AutomationRunStatus
  scheduledFor: number
  startedAt?: number
  completedAt?: number
  finishedAt?: number
  conversationId?: string
  turnId?: string
  error?: string
  errorCode?: string
  errorMessage?: string
  resultSummary?: string
  retryOfRunId?: string
  triggerSource?: string
  createdAt: number
  updatedAt?: number
}

export interface AutomationRunDetail extends AutomationRunSummary {
  attemptNumber?: number
  assistantMessage?: string
  assistantPersisted?: boolean
  durationMs?: number
  executor?: unknown
  failureStage?: string
  lastHeartbeatAt?: number
  mode?: 'ask' | 'act'
  modelId?: string
  promptSnapshot?: string
  readinessState?: string
  requestId?: string
  stage?: string
}

export interface ConversationSummary {
  _id: string
  title: string
  lastModified: number
  createdAt: number
  updatedAt: number
  deletedAt?: number
  lastMode: 'ask' | 'act'
  askModelIds: string[]
  actModelId: string
  clientId?: string
  projectId?: string
}

export type ConversationMessagePart =
  | { type: 'text'; text?: string }
  | { type: 'file'; url?: string; mediaType?: string; fileName?: string }
  | {
      type: 'tool-invocation'
      toolInvocation: {
        toolCallId?: string
        toolName: string
        state?: string
        toolInput?: Record<string, unknown>
        toolOutput?: unknown
      }
    }

export interface ConversationMessage {
  id: string
  turnId: string
  mode: 'ask' | 'act'
  contentType: 'text' | 'image' | 'video'
  variantIndex?: number
  role: 'user' | 'assistant'
  parts: ConversationMessagePart[]
  model?: string
  replyToTurnId?: string
  replySnippet?: string
  routedModelId?: string
}

export interface NoteDoc {
  _id: string
  title: string
  content: string
  tags: string[]
  createdAt: number
  updatedAt: number
  deletedAt?: number
  clientId?: string
  projectId?: string
}

export interface KnowledgeFile {
  _id: string
  name: string
  type: 'file' | 'folder' | 'note' | 'output' | string
  kind?: 'folder' | 'note' | 'upload' | 'output' | string
  parentId: string | null
  content?: string
  textContent?: string
  mimeType?: string
  extension?: string
  sizeBytes?: number
  isStorageBacked?: boolean
  downloadUrl?: string
  outputType?: string
  createdAt: number
  updatedAt: number
  projectId?: string
}

export type KnowledgeFileKind = 'folder' | 'note' | 'upload' | 'output' | string

export interface KnowledgeFileTreeNode extends KnowledgeFile {
  depth: number
  path: readonly string[]
  children: KnowledgeFileTreeNode[]
}

export interface FileQueryContract extends PaginationQueryContract {
  fileId?: string
  projectId?: string | null
  kind?: KnowledgeFileKind
  parentId?: string | null
  conversationId?: string
  outputType?: string
  type?: string
}

export interface CreateFileRequest {
  name: string
  type?: 'file' | 'folder' | string
  kind?: KnowledgeFileKind
  parentId?: string | null
  content?: string
  textContent?: string
  r2Key?: string
  sizeBytes?: number
  projectId?: string | null
  mimeType?: string
  extension?: string
  conversationId?: string
  turnId?: string
  modelId?: string
  prompt?: string
  outputType?: string
  legacyOutputId?: string
  accessToken?: string
  userId?: string
}

export interface CreateFileResponse {
  id?: string
  ids?: string[]
  parts?: number
  file?: KnowledgeFile | null
  error?: string
}

export interface UpdateFileRequest {
  fileId: string
  name?: string
  content?: string
  textContent?: string
  parentId?: string | null
  projectId?: string | null
  accessToken?: string
  userId?: string
}

export interface MutationSuccessResponse {
  success: boolean
  error?: string
}

export interface FileUploadUrlRequest {
  name?: string
  mimeType?: string
  sizeBytes: number
  accessToken?: string
  userId?: string
}

export interface FileUploadUrlResponse {
  uploadUrl: string
  r2Key: string
  expiresIn: number
  maxSizeBytes: number
  error?: string
  message?: string
}

export interface FilePresignQuery {
  name: string
  mimeType?: string
  sizeBytes: number
}

export interface FilePresignResponse {
  r2Key: string
  presignedUrl: string
  expiresIn: number
  maxSizeBytes: number
  error?: string
  message?: string
}

export interface FileShareRequest {
  fileId: string
  visibility: 'private' | 'public'
  accessToken?: string
  userId?: string
}

export interface FileShareResponse {
  visibility: 'private' | 'public'
  token: string | null
  url: string | null
  error?: string
}

export type FileBulkAction = 'delete' | 'move' | 'share' | 'download'

export interface FileBulkActionRequest {
  action: FileBulkAction
  fileIds: readonly string[]
  targetParentId?: string | null
  targetProjectId?: string | null
  visibility?: 'private' | 'public'
}

export interface FileTextSearchRequest {
  fileIds: string[]
  query: string
  contextChars?: number
  maxMatchesPerFile?: number
  maxTotalSnippetChars?: number
  accessToken?: string
  userId?: string
}

export interface FileTextSearchMatch {
  fileId: string
  fileName: string
  matchIndexInFile: number
  charStart: number
  charEnd: number
  snippet: string
}

export interface FileTextSearchResponse {
  success: true
  matches: FileTextSearchMatch[]
  truncated: boolean
}

export interface MemoryRow {
  key: string
  memoryId: string
  segmentIndex: number
  content: string
  fullContent: string
  source: string
  type?: 'preference' | 'fact' | 'project' | 'decision' | 'agent'
  importance?: number
  projectId?: string
  conversationId?: string
  noteId?: string
  messageId?: string
  turnId?: string
  tags?: string[]
  actor?: 'user' | 'agent'
  status?: 'candidate' | 'approved' | 'rejected'
  createdAt: number
  updatedAt?: number
}

export interface MemoryQueryContract extends PaginationQueryContract {
  memoryId?: string
  raw?: boolean
  updatedSince?: number
  includeDeleted?: boolean
  projectId?: string
  conversationId?: string
  noteId?: string
}

export interface CreateMemoryRequest {
  content: string
  source?: 'chat' | 'note' | 'manual'
  clientId?: string
  type?: 'preference' | 'fact' | 'project' | 'decision' | 'agent'
  importance?: number
  projectId?: string
  conversationId?: string
  noteId?: string
  messageId?: string
  turnId?: string
  tags?: string[]
  actor?: 'user' | 'agent'
  accessToken?: string
  userId?: string
}

export interface CreateMemoryResponse {
  id: string
  ids: string[]
  count: number
  memory?: MemoryRow | null
  error?: string
}

export interface UpdateMemoryRequest extends Partial<Omit<CreateMemoryRequest, 'clientId'>> {
  memoryId: string
}

export type OutputType = string
export type OutputSource = string

export interface OutputSummary {
  _id: string
  type: OutputType
  source?: OutputSource
  status: 'pending' | 'completed' | 'failed'
  prompt: string
  modelId: string
  url?: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
  metadata?: Record<string, unknown>
  errorMessage?: string
  createdAt: number
  completedAt?: number
}

export interface OutputQueryContract extends PaginationQueryContract {
  outputId?: string
  type?: string
  limit?: number
  conversationId?: string
}

export type DeleteOutputResponse = MutationSuccessResponse

export interface NoteQueryContract extends PaginationQueryContract {
  noteId?: string
  projectId?: string | null
  includeDeleted?: boolean
}

export interface CreateNoteRequest {
  title?: string
  content?: string
  tags?: string[]
  projectId?: string
  clientId?: string
  accessToken?: string
  userId?: string
}

export interface CreateNoteResponse {
  id: string
  note: NoteDoc | null
  error?: string
}

export interface UpdateNoteRequest {
  noteId: string
  title?: string
  content?: string
  tags?: string[]
  projectId?: string
  accessToken?: string
  userId?: string
}

export interface UpdateNoteResponse {
  success: boolean
  note: NoteDoc | null
  error?: string
}

export interface DeleteNoteResponse extends MutationSuccessResponse {
  noteId?: string
  deletedAt?: number
}

export interface NotebookAgentMention {
  type: string
  id: string
  name: string
  fileIds?: string[]
}

export interface NotebookAgentRequest {
  noteContent: string
  noteTitle: string
  message: string
  modelId?: string
  mode?: 'ask' | 'write'
  projectId?: string
  mentions?: NotebookAgentMention[]
  accessToken?: string
  userId?: string
}

export interface NotebookEdit {
  id: string
  description: string
  startLine: number
  endLine: number
  originalLines: string[]
  newLines: string[]
}

export type NotebookAgentStreamEvent =
  | { type: 'thinking'; thinking?: string }
  | { type: 'tool_call'; tool?: string; toolInput?: Record<string, unknown> }
  | { type: 'edit_proposal'; edit?: NotebookEdit }
  | { type: 'text'; text?: string }
  | { type: 'done' }
  | { type: 'error'; error?: string }

export interface IntegrationSummary {
  slug: string
  name: string
  description: string
  logoUrl: string | null
  isConnected?: boolean
  connectedAccountId?: string | null
}

export interface IntegrationSearchResponse {
  data?: IntegrationSummary[]
  items: IntegrationSummary[]
  nextCursor?: string | null
  hasMore?: boolean
  total?: number
}

export interface ConnectedIntegrationsResponse {
  connected: string[]
  data?: IntegrationSummary[]
  items?: IntegrationSummary[]
  hasMore?: boolean
  total?: number
}

export interface IntegrationConnectionRequest {
  action?: 'connect' | 'disconnect'
  toolkit: string
  accessToken?: string
  userId?: string
}

export interface IntegrationConnectionResponse {
  success?: boolean
  redirectUrl?: string | null
  connectionId?: string | null
  status?: string | null
  error?: string
}

export interface SkillSummary {
  _id: string
  name: string
  description: string
  instructions: string
  enabled?: boolean
  projectId?: string
  createdAt?: number
  updatedAt?: number
}

export interface CreateSkillRequest {
  name: string
  description: string
  instructions: string
  enabled?: boolean
  projectId?: string
  accessToken?: string
  userId?: string
}

export interface UpdateSkillRequest {
  skillId: string
  name?: string
  description?: string
  instructions?: string
  enabled?: boolean
  accessToken?: string
  userId?: string
}

export interface CreateEntityResponse {
  id: string
  error?: string
}

export interface ProjectSummary {
  _id: string
  name: string
  description?: string
  instructions?: string
  parentId?: string | null
  deletedAt?: number
  updatedAt: number
  createdAt: number
}

export interface ProjectQueryContract extends PaginationQueryContract {
  projectId?: string
  updatedSince?: number
  includeDeleted?: boolean
}

export interface ProjectTreeNode extends ProjectSummary {
  depth: number
  path: readonly string[]
  children: ProjectTreeNode[]
}

export interface ProjectResourceSummary {
  conversations: ConversationSummary[]
  notes: NoteDoc[]
  files: KnowledgeFile[]
}

export interface CreateProjectRequest {
  name: string
  parentId?: string | null
  instructions?: string
  clientId?: string
  accessToken?: string
  userId?: string
}

export interface CreateProjectResponse {
  id: string
  project?: ProjectSummary | null
  error?: string
}

export interface UpdateProjectRequest {
  projectId: string
  name?: string
  instructions?: string
  parentId?: string | null
  accessToken?: string
  userId?: string
}

export interface UpdateProjectResponse {
  success: boolean
  project?: ProjectSummary | null
  error?: string
}

export interface DeleteProjectResponse extends MutationSuccessResponse {
  deletedIds?: string[]
  deletedAt?: number
}

export interface McpServerSummary {
  _id: string
  name: string
  description?: string
  transport: 'sse' | 'streamable-http'
  url: string
  enabled: boolean
  authType: 'none' | 'bearer' | 'header'
  hasAuth?: boolean
  timeoutMs?: number
  createdAt: number
  updatedAt: number
}

export type McpAuthType = 'none' | 'bearer' | 'header'
export type McpTransport = 'sse' | 'streamable-http'

export type McpAuthConfig =
  | { bearerToken: string }
  | { headerName: string; headerValue: string }
  | Record<string, never>

export interface CreateMcpServerRequest {
  name: string
  description?: string
  transport: McpTransport
  url: string
  enabled?: boolean
  authType?: McpAuthType
  authConfig?: McpAuthConfig | null
  timeoutMs?: number
  accessToken?: string
  userId?: string
}

export interface UpdateMcpServerRequest extends Partial<CreateMcpServerRequest> {
  mcpServerId: string
}

export interface TestMcpServerRequest {
  url: string
  transport?: McpTransport
  authType?: McpAuthType
  authConfig?: McpAuthConfig
  accessToken?: string
  userId?: string
}

export interface TestMcpServerResponse {
  ok: boolean
  toolCount?: number
  error?: string
}

export interface OnboardingStatusResponse {
  hasSeenOnboarding: boolean
}

export interface OnboardingCompleteResponse {
  ok: boolean
  persistedToConvex?: boolean
}

export interface RateLimitSpec {
  bucket: string
  key?: string | null | undefined
  limit: number
  windowMs: number
}

export interface RateLimitDecision {
  bucket: string
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
  resetAt?: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
  decisions: RateLimitDecision[]
}

export interface RateLimiter {
  check(key: string, limits: RateLimitSpec[]): Promise<RateLimitResult>
}

export type PaginationSort = 'createdAt' | 'updatedAt' | 'name'
export type PaginationOrder = 'asc' | 'desc'

export interface PaginationQueryContract {
  cursor?: string
  limit?: number
  sort?: PaginationSort
  order?: PaginationOrder
}

export interface PaginatedEnvelope<T> {
  data: T[]
  nextCursor?: string
  hasMore: boolean
  total?: number
}

export interface EventBus {
  publish(topic: string, payload: unknown): Promise<void>
  subscribe(topic: string, handler: (payload: unknown) => void): () => void
}

export interface OverlayServerContext {
  auth: AuthProvider
  billing: BillingProvider
  objectStore: ObjectStore
  vectorStore: VectorStore
  llmGateway: CoreLLMGateway
  rateLimiter: RateLimiter
  eventBus: EventBus
}
