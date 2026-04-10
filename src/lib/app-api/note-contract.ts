export interface AppNoteDoc {
  _id: string;
  userId: string;
  clientId?: string;
  title: string;
  content: string;
  tags: string[];
  projectId?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface AppNoteListFilters {
  updatedSince?: number;
  includeDeleted?: boolean;
  projectId?: string;
}

export interface AppCreateNoteInput {
  userId: string;
  serverSecret: string;
  clientId?: string;
  title?: string;
  content?: string;
  tags?: string[];
  projectId?: string;
}

export interface AppUpdateNoteInput {
  userId: string;
  serverSecret: string;
  noteId: string;
  title?: string;
  content?: string;
  tags?: string[];
  projectId?: string;
}

export interface AppCreateNoteResult {
  id: string;
  note: AppNoteDoc | null;
}

export interface AppUpdateNoteResult {
  success: true;
  note: AppNoteDoc | null;
}

export interface AppDeleteNoteResult {
  success: true;
  noteId: string;
  deletedAt: number;
}
