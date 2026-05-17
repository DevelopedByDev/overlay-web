export type {
  CreateProjectRequest,
  CreateProjectResponse,
  DeleteProjectResponse,
  ProjectQueryContract,
  ProjectSummary,
  UpdateProjectRequest,
  UpdateProjectResponse,
} from './contracts'

export {
  buildProjectTree,
  collectProjectDescendantIds,
  flattenTree,
  sortByName,
} from './modules'

export type { TreeNode } from './modules'
