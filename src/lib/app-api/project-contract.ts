export interface AppProjectSummary {
  _id: string;
  userId: string;
  clientId?: string;
  name: string;
  instructions?: string;
  parentId?: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface AppProjectListFilters {
  updatedSince?: number;
  includeDeleted?: boolean;
}

export interface AppCreateProjectInput {
  userId: string;
  serverSecret: string;
  clientId?: string;
  name: string;
  instructions?: string;
  parentId?: string | null;
}

export interface AppUpdateProjectInput {
  userId: string;
  serverSecret: string;
  projectId: string;
  name?: string;
  instructions?: string;
  parentId?: string | null;
}

export interface AppCreateProjectResult {
  id: string;
  project: AppProjectSummary | null;
}

export interface AppUpdateProjectResult {
  success: true;
  project: AppProjectSummary | null;
}

export interface AppDeleteProjectResult {
  success: true;
  deletedIds: string[];
  deletedAt: number;
}
