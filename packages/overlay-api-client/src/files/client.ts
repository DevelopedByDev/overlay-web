import type {
  CreateFileRequest,
  CreateFileResponse,
  FilePresignQuery,
  FilePresignResponse,
  FileShareRequest,
  FileShareResponse,
  FileTextSearchRequest,
  FileTextSearchResponse,
  FileUploadUrlRequest,
  FileUploadUrlResponse,
  KnowledgeFile,
  MutationSuccessResponse,
  UpdateFileRequest,
} from '@overlay/app-core'
import type { HttpContext } from '../shared/http'
import type { QueryParams } from '../shared/types'
import type { FileQuery } from './types'

export class FilesClient {
  constructor(private readonly http: HttpContext) {}

  private path(query?: FileQuery): string {
    return this.http.appendQuery('/api/app/files', query as QueryParams | undefined)
  }

  get<T = KnowledgeFile[] | KnowledgeFile>(query?: FileQuery, init?: RequestInit) {
    return this.http.json<T>(this.path(query), init)
  }

  getResponse(query?: FileQuery, init?: RequestInit) {
    return this.http.request(this.path(query), init)
  }

  contentResponse(fileId: string, init?: RequestInit) {
    return this.http.request(`/api/app/files/${encodeURIComponent(fileId)}/content`, init)
  }

  create(body: CreateFileRequest, init?: RequestInit) {
    return this.http.json<CreateFileResponse>('/api/app/files', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  createResponse(body: CreateFileRequest, init?: RequestInit) {
    return this.http.request('/api/app/files', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  update(body: UpdateFileRequest, init?: RequestInit) {
    return this.http.json<MutationSuccessResponse>('/api/app/files', this.http.jsonRequest(body, { ...init, method: 'PATCH' }))
  }

  updateResponse(body: UpdateFileRequest, init?: RequestInit) {
    return this.http.request('/api/app/files', this.http.jsonRequest(body, { ...init, method: 'PATCH' }))
  }

  deleteResponse(query: { fileId: string }, init?: RequestInit) {
    return this.http.request(this.path(query), { ...init, method: 'DELETE' })
  }

  ingestDocumentResponse(body: BodyInit, init?: RequestInit) {
    return this.http.request('/api/app/files/ingest-document', { ...init, method: 'POST', body })
  }

  share(body: FileShareRequest, init?: RequestInit) {
    return this.http.json<FileShareResponse>('/api/app/files/share', this.http.jsonRequest(body, { ...init, method: 'PATCH' }))
  }

  shareResponse(body: FileShareRequest, init?: RequestInit) {
    return this.http.request('/api/app/files/share', this.http.jsonRequest(body, { ...init, method: 'PATCH' }))
  }

  uploadUrl(body: FileUploadUrlRequest, init?: RequestInit) {
    return this.http.json<FileUploadUrlResponse>(
      '/api/app/files/upload-url',
      this.http.jsonRequest(body, { ...init, method: 'POST' }),
    )
  }

  uploadUrlResponse(body: FileUploadUrlRequest, init?: RequestInit) {
    return this.http.request('/api/app/files/upload-url', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  presign(query: FilePresignQuery, init?: RequestInit) {
    return this.http.json<FilePresignResponse>(
      this.http.appendQuery('/api/app/files/presign', query as unknown as QueryParams),
      init,
    )
  }

  presignResponse(query: FilePresignQuery, init?: RequestInit) {
    return this.http.request(this.http.appendQuery('/api/app/files/presign', query as unknown as QueryParams), init)
  }

  searchText(body: FileTextSearchRequest, init?: RequestInit) {
    return this.http.json<FileTextSearchResponse>(
      '/api/app/files/search-text',
      this.http.jsonRequest(body, { ...init, method: 'POST' }),
    )
  }

  searchTextResponse(body: FileTextSearchRequest, init?: RequestInit) {
    return this.http.request('/api/app/files/search-text', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }
}
