export type ThemePreference = 'light' | 'dark'
/** Token streaming is the only supported mode; the field remains for API/storage compatibility. */
export type ChatStreamingMode = 'token'

export interface AppSettings {
  theme: ThemePreference
  useSecondarySidebar: boolean
  chatStreamingMode: ChatStreamingMode
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'light',
  useSecondarySidebar: false,
  chatStreamingMode: 'token',
}

export interface AuthUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  profilePictureUrl?: string
  emailVerified?: boolean
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
  supportsVision: boolean
  supportsReasoning: boolean
  supportsSearch: boolean
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
  { id: 'notes', label: 'Notes', href: '/app/notes' },
  {
    id: 'knowledge',
    label: 'Knowledge',
    href: '/app/knowledge',
    subviews: ['memories', 'files', 'outputs'],
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

export interface AppBootstrapDefaults {
  chatModelId?: string
  imageModelId?: string
  videoModelId?: string
}

export interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  planKind?: 'free' | 'paid'
  planAmountCents?: number
  creditsUsed: number
  creditsTotal: number
  budgetUsedCents?: number
  budgetTotalCents?: number
  budgetRemainingCents?: number
  autoTopUpEnabled?: boolean
  topUpAmountCents?: number
  autoTopUpAmountCents?: number
  autoTopUpConsentGranted?: boolean
  topUpMinAmountCents?: number
  topUpMaxAmountCents?: number
  topUpStepAmountCents?: number
  dailyUsage: { ask: number; write: number; agent: number }
  dailyLimits?: { ask: number; write: number; agent: number }
  overlayStorageBytesUsed?: number
  overlayStorageBytesLimit?: number
  transcriptionSecondsUsed?: number
  transcriptionSecondsLimit?: number
  localTranscriptionEnabled?: boolean
  resetAt?: string
  billingPeriodEnd?: string
  lastSyncedAt?: number
}

export interface AppBootstrapResponse {
  user: AuthUser | null
  entitlements: Entitlements | null
  uiSettings: AppSettings
  chatModels: ChatModel[]
  imageModels: ImageModel[]
  videoModels: VideoModel[]
  featureFlags: AppFeatureFlags
  destinations: AppDestinationConfig[]
  defaults?: AppBootstrapDefaults
}

export type AppBootstrap = AppBootstrapResponse

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
  type: 'file' | 'folder'
  parentId: string | null
  content?: string
  sizeBytes?: number
  isStorageBacked?: boolean
  downloadUrl?: string
  createdAt: number
  updatedAt: number
  projectId?: string
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

export interface IntegrationSummary {
  slug: string
  name: string
  description: string
  logoUrl: string | null
  isConnected: boolean
  connectedAccountId?: string | null
}

export interface SkillSummary {
  _id: string
  name: string
  description: string
  instructions: string
  enabled?: boolean
  projectId?: string
}

export interface ProjectSummary {
  _id: string
  name: string
  description?: string
  instructions?: string
  updatedAt: number
  createdAt: number
}

export type AutomationSourceType = 'skill' | 'inline'
export type AutomationMode = 'ask' | 'act'
export type AutomationStatus = 'active' | 'paused' | 'archived'
export type AutomationScheduleKind = 'once' | 'daily' | 'weekdays' | 'weekly' | 'monthly'
export type AutomationReadinessState =
  | 'ready'
  | 'needs_setup'
  | 'invalid_source'
  | 'paused_due_to_failures'
export type AutomationRunStage =
  | 'queued'
  | 'dispatching'
  | 'running'
  | 'persisting'
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'canceled'
  | 'needs_setup'
export type AutomationRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'canceled'
  | 'timed_out'

export interface AutomationExecutorSummary {
  platform: 'vercel' | 'local' | 'unknown'
  region?: string
  deploymentId?: string
  runtime?: string
}

export interface AutomationScheduleConfig {
  onceAt?: number
  localTime?: string
  weekdays?: number[]
  dayOfMonth?: number
}

export interface AutomationSummary {
  _id: string
  userId?: string
  title: string
  description?: string
  sourceType?: AutomationSourceType
  skillId?: string
  instructionsMarkdown?: string
  mode: AutomationMode
  modelId: string
  projectId?: string
  status: AutomationStatus
  timezone: string
  scheduleKind: AutomationScheduleKind | string
  scheduleConfig: AutomationScheduleConfig | Record<string, unknown>
  nextRunAt?: number
  lastRunAt?: number
  lastRunStatus?: AutomationRunStatus | string
  conversationId?: string
  readinessState?: AutomationReadinessState | string
  readinessMessage?: string
  failureStreak?: number
  createdAt?: number
  updatedAt: number
}

export interface AutomationRunSummary {
  _id: string
  automationId: string
  userId?: string
  status: AutomationRunStatus | string
  triggerSource?: 'manual' | 'schedule' | 'retry'
  scheduledFor?: number
  startedAt?: number
  finishedAt?: number
  durationMs?: number
  conversationId?: string
  turnId?: string
  attemptNumber?: number
  retryOfRunId?: string
  stage?: AutomationRunStage | string
  failureStage?: string
  requestId?: string
  lastHeartbeatAt?: number
  assistantPersisted?: boolean
  assistantMessage?: string
  readinessState?: AutomationReadinessState | string
  executor?: AutomationExecutorSummary
  promptSnapshot?: string
  mode?: AutomationMode
  modelId?: string
  resultSummary?: string
  errorCode?: string
  errorMessage?: string
  createdAt?: number
}

export interface AutomationToolInvocationSummary {
  _id: string
  toolId: string
  mode: AutomationMode
  modelId?: string
  conversationId?: string
  turnId?: string
  success: boolean
  durationMs?: number
  costBucket:
    | 'perplexity'
    | 'image'
    | 'video'
    | 'browser'
    | 'daytona'
    | 'composio'
    | 'internal'
  errorMessage?: string
  createdAt: number
}

export interface AutomationOutputSummary {
  _id: string
  type: string
  status: 'pending' | 'completed' | 'failed'
  url?: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
  modelId: string
  conversationId?: string
  turnId?: string
  errorMessage?: string
  createdAt: number
  completedAt?: number
}

export interface AutomationRunEventSummary {
  _id: string
  automationRunId: string
  stage: AutomationRunStage | string
  level: 'info' | 'warning' | 'error'
  message: string
  metadata?: Record<string, unknown>
  createdAt: number
}

export interface AutomationRunDetail {
  run: AutomationRunSummary
  automation?: Pick<AutomationSummary, '_id' | 'title' | 'description' | 'mode' | 'modelId'>
  userMessage?: string
  assistantMessage?: string
  tools: AutomationToolInvocationSummary[]
  outputs: AutomationOutputSummary[]
  relatedRetryRun?: AutomationRunSummary
  events?: AutomationRunEventSummary[]
}
