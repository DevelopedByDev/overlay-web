// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Database layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

export interface Conversation {
  id: string
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
  title: string
  userId: string
  lastMode: 'ask' | 'act'
  askModelIds: string[]
  actModelId: string
  projectId?: string
}

export interface User {
  id: string
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
  email: string
  firstName?: string
  lastName?: string
  profilePictureUrl?: string
  role?: 'superadmin' | 'admin' | 'user' | 'guest'
}

export interface Memory {
  id: string
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
  name: string
  type: 'file' | 'folder'
  parentId: string | null
  content?: string
  sizeBytes?: number
  isStorageBacked?: boolean
  downloadUrl?: string
  userId: string
  projectId?: string
  createdAt: number
  updatedAt: number
}

export interface NewFileRecord {
  name: string
  type: 'file' | 'folder'
  parentId: string | null
  userId: string
  projectId?: string
  content?: string
  sizeBytes?: number
}

export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  userId: string
  projectId?: string
  createdAt: number
  updatedAt: number
}

export interface NewNote {
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
