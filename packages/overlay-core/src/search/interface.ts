// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Search layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

export interface ISearch {
  indexDocument(doc: SearchDocument): Promise<void>
  removeDocument(id: string): Promise<void>
  search(query: string, opts?: SearchOptions): Promise<SearchResult[]>
  semanticSearch(query: string, opts?: SearchOptions): Promise<SearchResult[]>
}

export interface SearchDocument {
  id: string
  type: 'conversation' | 'memory' | 'file' | 'note'
  content: string
  userId: string
  projectId?: string
  metadata?: Record<string, unknown>
}

export interface SearchResult {
  id: string
  type: 'conversation' | 'memory' | 'file' | 'note'
  title: string
  snippet: string
  score: number
  metadata?: Record<string, unknown>
}

export interface SearchOptions {
  limit?: number
  offset?: number
  filters?: {
    type?: string
    userId?: string
    projectId?: string
    dateFrom?: number
    dateTo?: number
  }
}
