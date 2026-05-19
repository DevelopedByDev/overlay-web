'use client'

export type {
  ProjectChatSummary as ProjectChat,
  ProjectFileSummary as ProjectFile,
  ProjectNoteSummary as ProjectNote,
  ProjectSummary as Project,
} from '@overlay/app-core'
export { opensInDocumentEditor } from '@overlay/app-core'
export {
  PROJECT_TREE_CHEVRON_COL as TREE_CHEVRON_COL,
  PROJECT_TREE_DEPTH_STEP_PX as TREE_DEPTH_STEP_PX,
  PROJECT_TREE_GUTTER_PX as TREE_GUTTER_PX,
  PROJECT_TREE_ICON_COL as TREE_ICON_COL,
  ProjectFileTreeNode,
} from '@overlay/modules-react/projects'
