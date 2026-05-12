// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Database layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

export interface Conversation {
  id: string
  orgId: string
  title: string
  lastModified: number
  createdAt: number
  updatedAt: number
  deletedAt?: number
  lastMode: 'ask' | 'act'
  askModelIds: string[]
  actModelId: string
  userId: string
  projectId?: string
}

export interface NewConversation {
  orgId?: string
  title: string
  userId: string
  lastMode: 'ask' | 'act'
  askModelIds: string[]
  actModelId: string
  projectId?: string
}

export interface User {
  id: string
  orgId: string
  email: string
  firstName?: string
  lastName?: string
  profilePictureUrl?: string
  emailVerified?: boolean
  role?: 'superadmin' | 'admin' | 'user' | 'guest'
  createdAt: number
  updatedAt: number
}

export interface NewUser {
  orgId?: string
  email: string
  firstName?: string
  lastName?: string
  profilePictureUrl?: string
  role?: 'superadmin' | 'admin' | 'user' | 'guest'
}

export interface Memory {
  id: string
  orgId: string
  key: string
  segmentIndex: number
  content: string
  fullContent: string
  source: string
  type?: 'preference' | 'fact' | 'project' | 'decision' | 'agent'
  importance?: number
  projectId?: string
  conversationId?: string
  noteId?: string
  userId: string
  createdAt: number
  updatedAt?: number
}

export interface NewMemory {
  orgId?: string
  key: string
  content: string
  userId: string
  type?: 'preference' | 'fact' | 'project' | 'decision' | 'agent'
  importance?: number
  projectId?: string
  conversationId?: string
}

export interface FileRecord {
  id: string
  orgId: string
  name: string
  type: 'file' | 'folder'
  parentId: string | null
  content?: string
  sizeBytes?: number
  isStorageBacked?: boolean
  storageKey?: string
  downloadUrl?: string
  userId: string
  projectId?: string
  createdAt: number
  updatedAt: number
}

export interface NewFileRecord {
  orgId?: string
  name: string
  type: 'file' | 'folder'
  parentId: string | null
  userId: string
  projectId?: string
  content?: string
  sizeBytes?: number
  storageKey?: string
}

export interface Note {
  id: string
  orgId: string
  title: string
  content: string
  tags: string[]
  userId: string
  projectId?: string
  createdAt: number
  updatedAt: number
}

export interface NewNote {
  orgId?: string
  title: string
  content: string
  userId: string
  projectId?: string
  tags?: string[]
}

export interface ListOptions {
  limit?: number
  cursor?: string
  orderBy?: 'createdAt' | 'updatedAt' | 'lastModified'
  orderDirection?: 'asc' | 'desc'
}

export interface Organization {
  id: string
  name: string
  slug?: string
  createdAt: number
  updatedAt: number
}

export interface NewOrganization {
  id?: string
  name: string
  slug?: string
}

export interface Project {
  id: string
  orgId: string
  userId: string
  name: string
  parentId?: string
  instructions?: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export interface NewProject {
  orgId?: string
  userId: string
  name: string
  parentId?: string
  instructions?: string
}

export interface ConversationMessage {
  id: string
  orgId: string
  conversationId: string
  userId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  status?: 'pending' | 'generating' | 'completed' | 'failed' | 'stopped'
  modelId?: string
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface NewConversationMessage {
  orgId?: string
  conversationId: string
  userId: string
  role: ConversationMessage['role']
  content: string
  status?: ConversationMessage['status']
  modelId?: string
  metadata?: Record<string, unknown>
}

export interface OutputRecord {
  id: string
  orgId: string
  userId: string
  type: 'image' | 'video' | 'document' | 'other'
  storageKey?: string
  status: 'pending' | 'completed' | 'failed'
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface NewOutputRecord {
  orgId?: string
  userId: string
  type: OutputRecord['type']
  storageKey?: string
  status?: OutputRecord['status']
  metadata?: Record<string, unknown>
}

export interface SkillRecord {
  id: string
  orgId: string
  userId: string
  name: string
  content: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface McpServerRecord {
  id: string
  orgId: string
  userId: string
  name: string
  url?: string
  config?: Record<string, unknown>
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface UsageEntitlements {
  orgId: string
  userId: string
  tier: 'free' | 'pro' | 'max' | 'enterprise'
  planKind?: 'free' | 'paid' | 'manual'
  dailyUsage?: Record<string, number>
  dailyLimits?: Record<string, number>
  budgetUsedCents?: number
  budgetTotalCents?: number
  resetAt?: number
  billingPeriodEnd?: number
  lastSyncedAt?: number
}

export interface AppSettings {
  orgId: string
  userId: string
  settings: Record<string, unknown>
  updatedAt: number
}

export interface AutomationRecord {
  id: string
  orgId: string
  userId: string
  name: string
  status: 'active' | 'paused' | 'disabled'
  schedule?: string
  payload?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface DatabaseAuditEvent {
  id: string
  orgId: string
  userId?: string
  action: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  createdAt: number
}

export const DEFAULT_ORG_ID = 'default'
