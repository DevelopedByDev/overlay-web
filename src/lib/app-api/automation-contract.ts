import type {
  AutomationMode,
  AutomationOutputSummary,
  AutomationRunDetail,
  AutomationRunEventSummary,
  AutomationRunSummary,
  AutomationScheduleConfig,
  AutomationScheduleKind,
  AutomationSourceType,
  AutomationStatus,
  AutomationSummary,
  AutomationToolInvocationSummary,
} from "@/lib/automations";

export type {
  AutomationMode as AppAutomationMode,
  AutomationOutputSummary as AppAutomationOutputSummary,
  AutomationRunDetail as AppAutomationRunDetail,
  AutomationRunEventSummary as AppAutomationRunEventSummary,
  AutomationRunSummary as AppAutomationRunSummary,
  AutomationScheduleConfig as AppAutomationScheduleConfig,
  AutomationScheduleKind as AppAutomationScheduleKind,
  AutomationSourceType as AppAutomationSourceType,
  AutomationStatus as AppAutomationStatus,
  AutomationSummary as AppAutomationSummary,
  AutomationToolInvocationSummary as AppAutomationToolInvocationSummary,
};

export interface AppAutomationListFilters {
  projectId?: string;
}

export interface AppCreateAutomationInput {
  userId: string;
  serverSecret: string;
  projectId?: string;
  title: string;
  description?: string;
  sourceType: AutomationSourceType;
  skillId?: string;
  instructionsMarkdown?: string;
  mode: AutomationMode;
  modelId?: string;
  status?: AutomationStatus;
  timezone: string;
  scheduleKind: AutomationScheduleKind;
  scheduleConfig?: AutomationScheduleConfig;
}

export interface AppUpdateAutomationInput {
  userId: string;
  serverSecret: string;
  automationId: string;
  projectId?: string;
  title?: string;
  description?: string;
  sourceType?: AutomationSourceType;
  skillId?: string;
  instructionsMarkdown?: string;
  mode?: AutomationMode;
  modelId?: string;
  status?: AutomationStatus;
  timezone?: string;
  scheduleKind?: AutomationScheduleKind;
  scheduleConfig?: AutomationScheduleConfig;
}

export interface AppCreateAutomationResult {
  id: string;
}

export interface AppUpdateAutomationResult {
  success: true;
}

export interface AppDeleteAutomationResult {
  success: true;
}

export interface AppAutomationRunsFilters {
  limit?: number;
}

export interface AppRetryAutomationRunResult {
  success: true;
  automationRunId: string;
}

export interface AppRunAutomationNowResult {
  success: true;
  automationRunId: string;
  conversationId?: string;
  turnId?: string;
  resultSummary?: string;
}
