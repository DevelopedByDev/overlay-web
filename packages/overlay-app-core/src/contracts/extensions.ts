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
