export interface AppSkillSummary {
  _id: string;
  userId: string;
  name: string;
  description: string;
  instructions: string;
  enabled?: boolean;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppSkillListFilters {
  projectId?: string;
}

export interface AppCreateSkillInput {
  userId: string;
  serverSecret: string;
  name: string;
  description?: string;
  instructions?: string;
  enabled?: boolean;
  projectId?: string;
}

export interface AppUpdateSkillInput {
  userId: string;
  serverSecret: string;
  skillId: string;
  name?: string;
  description?: string;
  instructions?: string;
  enabled?: boolean;
}

export interface AppCreateSkillResult {
  id: string;
}

export interface AppUpdateSkillResult {
  success: true;
}

export interface AppDeleteSkillResult {
  success: true;
}
