export type {
  CreateNoteRequest,
  CreateNoteResponse,
  DeleteNoteResponse,
  NoteDoc,
  NoteQueryContract,
  NotebookAgentRequest,
  UpdateNoteRequest,
  UpdateNoteResponse,
} from './contracts'

export { noteEditorState, sortNotes } from './modules'

export function normalizeNoteMarkdown(value: string): string {
  return value.replace(/\r\n?/g, '\n')
}
