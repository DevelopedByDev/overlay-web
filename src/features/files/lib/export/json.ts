export interface ExportMetadata {
  title: string
  createdAt?: number
  updatedAt?: number
  modelIds?: string[]
}

export interface ChatExportData {
  type: 'chat'
  title: string
  metadata: ExportMetadata
  messages: Array<{
    role: string
    content: string
    createdAt?: number
  }>
}

export interface NoteExportData {
  type: 'note'
  title: string
  metadata: ExportMetadata
  content: string
}

export function exportChatToJSON(
  title: string,
  messages: Array<{ role: string; content: string; parts?: Array<{ type: string; text?: string }> }>,
  metadata?: ExportMetadata,
): ChatExportData {
  return {
    type: 'chat',
    title,
    metadata: metadata || { title },
    messages: messages.map((msg) => ({
      role: msg.role,
      content:
        msg.content ||
        (msg.parts ? msg.parts.filter((p) => p.type === 'text').map((p) => p.text).join('') : ''),
    })),
  }
}

export function exportNoteToJSON(
  title: string,
  content: string,
  metadata?: ExportMetadata,
): NoteExportData {
  return {
    type: 'note',
    title,
    metadata: metadata || { title },
    content,
  }
}
