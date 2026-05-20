export interface FileQuery {
  fileId?: string
  projectId?: string | null
  kind?: 'folder' | 'note' | 'upload' | 'output' | string
  parentId?: string | null
  conversationId?: string
  outputType?: string
  type?: string
}
