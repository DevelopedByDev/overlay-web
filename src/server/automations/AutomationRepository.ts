import 'server-only'

import type { Id } from '../../../convex/_generated/dataModel'

export type AutomationSchedule =
  | { kind: 'interval'; intervalMinutes?: number }
  | { kind: 'daily'; hourUTC?: number; minuteUTC?: number }
  | { kind: 'weekly'; dayOfWeekUTC?: number; hourUTC?: number; minuteUTC?: number }
  | { kind: 'monthly'; dayOfMonthUTC?: number; hourUTC?: number; minuteUTC?: number }

export type AutomationForUpdateNote = {
  _id: Id<'automations'>
  userId: string
  name?: string
  title?: string
  description?: string
  instructions?: string
  enabled?: boolean
  schedule?: AutomationSchedule
  timezone?: string
  modelId?: string
  sourceConversationId?: Id<'conversations'>
  conversationId?: Id<'conversations'>
}

export type AutomationRunTarget = {
  _id: Id<'automations'>
  userId: string
  name?: string
  title?: string
  description?: string
  instructions?: string
  instructionsMarkdown?: string
  projectId?: string
  modelId?: string
  sourceConversationId?: Id<'conversations'>
  conversationId?: Id<'conversations'>
}

export type AutomationExecutionPayload = {
  run: {
    status: string
    scheduledFor: number
    turnId?: string
    conversationId?: Id<'conversations'>
  }
  automation: AutomationRunTarget
}

export interface AutomationRepository {
  listAutomations(args: {
    includeDeleted?: boolean
    projectId?: string
    userId: string
  }): Promise<unknown[]>
  listRuns(args: {
    automationId: Id<'automations'>
    userId: string
  }): Promise<unknown[]>
  getAutomation(args: {
    automationId: Id<'automations'>
    userId: string
  }): Promise<AutomationForUpdateNote | null>
  getAutomationRunTarget(args: {
    automationId: Id<'automations'>
    userId: string
  }): Promise<AutomationRunTarget | null>
  getEntitlements(args: {
    userId: string
  }): Promise<{ planKind?: 'free' | 'paid' } | null>
  createAutomation(args: Record<string, unknown> & {
    userId: string
  }): Promise<unknown>
  updateAutomation(args: Record<string, unknown> & {
    automationId: Id<'automations'>
    userId: string
  }): Promise<void>
  pauseAutomation(args: {
    automationId: Id<'automations'>
    userId: string
  }): Promise<void>
  resumeAutomation(args: {
    automationId: Id<'automations'>
    userId: string
  }): Promise<void>
  removeAutomation(args: {
    automationId: Id<'automations'>
    userId: string
  }): Promise<void>
  removeConversation(args: {
    conversationId: Id<'conversations'>
    userId: string
  }): Promise<void>
  appendAutomationUpdateNote(args: {
    automationId: Id<'automations'>
    content: string
    conversationId: Id<'conversations'>
    userId: string
  }): Promise<void>
  createManualRun(args: {
    automationId: Id<'automations'>
    scheduledFor: number
    userId: string
  }): Promise<Id<'automationRuns'> | null>
  markManualRunStarted(args: {
    conversationId?: Id<'conversations'>
    now: number
    runId: Id<'automationRuns'>
    turnId: string
    userId: string
  }): Promise<void>
  markManualRunCompleted(args: {
    conversationId: Id<'conversations'>
    now: number
    runId: Id<'automationRuns'>
    userId: string
  }): Promise<void>
  markManualRunFailed(args: {
    error: string
    now: number
    runId: Id<'automationRuns'>
    userId: string
  }): Promise<void>
  getRunForExecution(args: {
    runId: Id<'automationRuns'>
  }): Promise<AutomationExecutionPayload | null>
}
