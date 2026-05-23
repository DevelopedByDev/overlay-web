export interface IntegrationQuery {
  action?: 'search' | string
  limit?: number
  slug?: string
  q?: string
  cursor?: string
  projectId?: string
}
