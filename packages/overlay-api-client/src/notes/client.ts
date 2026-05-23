import type {
  CreateNoteRequest,
  CreateNoteResponse,
  DeleteNoteResponse,
  KnowledgeFile,
  NoteDoc,
  NotebookAgentRequest,
  UpdateNoteRequest,
  UpdateNoteResponse,
} from '@overlay/app-core'
import type { HttpContext } from '../shared/http'
import type { QueryParams } from '../shared/types'
import type { NoteFileQuery, NoteQuery } from './types'

export class NotesClient {
  constructor(private readonly http: HttpContext) {}

  private path(query?: NoteQuery): string {
    return this.http.appendQuery('/api/app/notes', query as QueryParams | undefined)
  }

  private filesPath(query?: NoteFileQuery): string {
    return this.http.appendQuery('/api/app/files', { ...query, kind: 'note' } as QueryParams)
  }

  get<T = NoteDoc[] | NoteDoc>(query?: NoteQuery, init?: RequestInit) {
    return this.http.json<T>(this.path(query), init)
  }

  getResponse(query?: NoteQuery, init?: RequestInit) {
    return this.http.request(this.path(query), init)
  }

  getCanonicalFiles<T = KnowledgeFile[] | KnowledgeFile>(query?: NoteFileQuery, init?: RequestInit) {
    return this.http.json<T>(this.filesPath(query), init)
  }

  create(body: CreateNoteRequest, init?: RequestInit) {
    return this.http.json<CreateNoteResponse>('/api/app/notes', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  createResponse(body: CreateNoteRequest, init?: RequestInit) {
    return this.http.request('/api/app/notes', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  update(body: UpdateNoteRequest, init?: RequestInit) {
    return this.http.json<UpdateNoteResponse>('/api/app/notes', this.http.jsonRequest(body, { ...init, method: 'PATCH' }))
  }

  updateResponse(body: UpdateNoteRequest, init?: RequestInit) {
    return this.http.request('/api/app/notes', this.http.jsonRequest(body, { ...init, method: 'PATCH' }))
  }

  deleteResponse(query: { noteId: string }, init?: RequestInit) {
    return this.http.request(this.path(query), { ...init, method: 'DELETE' })
  }

  notebookAgentResponse(body: NotebookAgentRequest, init?: RequestInit) {
    return this.http.request('/api/app/notebook-agent', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  parseDeleteResponse(response: Response) {
    return this.http.parseJson<DeleteNoteResponse>(response)
  }
}
