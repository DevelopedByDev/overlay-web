export type AppOutputType =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "code"
  | "text"
  | "other";

export type AppOutputSource =
  | "image_generation"
  | "video_generation"
  | "sandbox";

export interface AppOutputSummary {
  _id: string;
  userId: string;
  type: AppOutputType;
  source?: AppOutputSource;
  status: "pending" | "completed" | "failed";
  prompt: string;
  modelId: string;
  url?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  conversationId?: string;
  turnId?: string;
  storageId?: string;
  r2Key?: string;
  createdAt: number;
  completedAt?: number;
}

export interface AppOutputListFilters {
  type?: AppOutputType;
  limit?: number;
  conversationId?: string;
}

export interface AppDeleteOutputResult {
  success: true;
}

export interface AppOutputProxyTarget {
  r2Key?: string;
  url?: string;
  sizeBytes: number;
  type: AppOutputType;
  fileName?: string;
  mimeType?: string;
}
