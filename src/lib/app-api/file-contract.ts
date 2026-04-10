export type AppFileType = "file" | "folder";

export interface AppFileRecord {
  _id: string;
  userId: string;
  name: string;
  type: AppFileType;
  parentId: string | null;
  content?: string;
  storageId?: string | null;
  r2Key?: string | null;
  sizeBytes?: number;
  isStorageBacked?: boolean;
  downloadUrl?: string;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppFileListFilters {
  projectId?: string;
}

export interface AppCreateFileInput {
  userId: string;
  serverSecret: string;
  name: string;
  type: AppFileType;
  parentId?: string;
  content?: string;
  storageId?: string;
  r2Key?: string;
  sizeBytes?: number;
  projectId?: string;
}

export interface AppUpdateFileInput {
  userId: string;
  serverSecret: string;
  fileId: string;
  name?: string;
  content?: unknown;
}

export interface AppCreateFileResult {
  id: string;
  ids?: string[];
  parts?: number;
}

export interface AppUpdateFileResult {
  success: true;
}

export interface AppDeleteFileResult {
  success: true;
}

export interface AppFileProxyTarget {
  r2Key?: string;
  url?: string;
  name: string;
  mimeType?: string;
  sizeBytes: number;
}

export interface AppFileUploadUrlInput {
  userId: string;
  serverSecret: string;
  sizeBytes: number;
  name?: string;
  mimeType?: string;
}

export interface AppFileUploadUrlResult {
  r2Key: string;
  presignedUrl: string;
  expiresIn: number;
}
