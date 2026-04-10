export type AppKnowledgeSourceKind = "file" | "memory";

export interface AppKnowledgeSearchChunk {
  text: string;
  title?: string;
  sourceKind: AppKnowledgeSourceKind;
  sourceId: string;
  chunkIndex: number;
  score: number;
}

export interface AppKnowledgeSearchInput {
  userId: string;
  serverSecret: string;
  accessToken?: string;
  query: string;
  projectId?: string;
  sourceKind?: AppKnowledgeSourceKind;
  kVec?: number;
  kLex?: number;
  m?: number;
}

export interface AppKnowledgeSearchResult {
  chunks: AppKnowledgeSearchChunk[];
}
