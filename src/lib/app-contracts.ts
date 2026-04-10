import type { AuthUser } from "@/lib/workos-auth";
import type {
  AppSettings,
  ThemePreference,
} from "@/components/app/AppSettingsProvider";
import type {
  AutomationRunDetail,
  AutomationRunSummary,
  AutomationSummary,
} from "@/lib/automations";
import type {
  AppConversationMessage,
  AppConversationSummary,
} from "@/lib/app-api/conversation-contract";
import type { AppMemoryListRow } from "@/lib/app-api/memory-contract";
import type { AppNoteDoc } from "@/lib/app-api/note-contract";
import type { AppProjectSummary } from "@/lib/app-api/project-contract";
import type { ChatModel, ImageModel, VideoModel } from "@/lib/models";
import type { OutputType, OutputSource } from "@/lib/output-types";

export type { AppSettings, ThemePreference };

export interface Entitlements {
  tier: "free" | "pro" | "max";
  creditsUsed: number;
  creditsTotal: number;
  dailyUsage: { ask: number; write: number; agent: number };
  dailyLimits?: { ask: number; write: number; agent: number };
  overlayStorageBytesUsed?: number;
  overlayStorageBytesLimit?: number;
  transcriptionSecondsUsed?: number;
  transcriptionSecondsLimit?: number;
  localTranscriptionEnabled?: boolean;
  resetAt?: string;
  billingPeriodEnd?: string;
  lastSyncedAt?: number;
}

export type ConversationSummary = AppConversationSummary;
export type ConversationMessage = AppConversationMessage;

export type NoteDoc = AppNoteDoc;

export interface KnowledgeFile {
  _id: string;
  name: string;
  type: "file" | "folder";
  parentId: string | null;
  content?: string;
  sizeBytes?: number;
  isStorageBacked?: boolean;
  downloadUrl?: string;
  createdAt: number;
  updatedAt: number;
  projectId?: string;
}

export type MemoryRow = AppMemoryListRow;

export interface OutputSummary {
  _id: string;
  type: OutputType;
  source?: OutputSource;
  status: "pending" | "completed" | "failed";
  prompt: string;
  modelId: string;
  url?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: number;
  completedAt?: number;
}

export interface IntegrationSummary {
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  isConnected: boolean;
  connectedAccountId?: string | null;
}

export interface SkillSummary {
  _id: string;
  name: string;
  description: string;
  instructions: string;
  enabled?: boolean;
  projectId?: string;
}

export type ProjectSummary = AppProjectSummary;

export interface AppFeatureFlags {
  canUseVoiceTranscription: boolean;
  canUseKnowledge: boolean;
  canUseProjects: boolean;
  canUseAutomations: boolean;
  canUseExtensions: boolean;
}

export interface AppDestinationConfig {
  id:
    | "chat"
    | "notes"
    | "knowledge"
    | "extensions"
    | "projects"
    | "automations"
    | "settings"
    | "account";
  label: string;
  href: string;
  subviews?: string[];
}

export interface AppBootstrapResponse {
  user: AuthUser | null;
  entitlements: Entitlements | null;
  uiSettings: AppSettings;
  chatModels: ChatModel[];
  imageModels: ImageModel[];
  videoModels: VideoModel[];
  featureFlags: AppFeatureFlags;
  destinations: AppDestinationConfig[];
}

export type {
  AutomationRunDetail,
  AutomationRunSummary,
  AutomationSummary,
  AuthUser,
};
