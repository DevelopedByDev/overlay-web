'use client'

// Compatibility wrapper: canonical file tree presentation lives in @overlay/modules-react
// and pure file helpers/types live in @overlay/app-core.
export type { KnowledgeFileNode as FileNode } from '@overlay/app-core'
export { filePathLabel, opensInDocumentEditor } from '@overlay/app-core'
export { FileTreeRow, FolderCard } from '@overlay/modules-react/knowledge'
