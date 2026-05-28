import 'server-only'

export { ConvexFileRepository } from './ConvexFileRepository'
export {
  FileService,
  FileServiceError,
  type ContentProxyResult,
  type FileServiceClock,
  type FileServiceDeps,
  type FileServiceStorage,
  type SearchTextMatchRow,
} from './FileService'
export type {
  FileRecord,
  FileRepository,
  FileShareResult,
  FileStorageEntitlements,
  FileStorageProxyTarget,
  FileSubtreeStorageEntry,
  FileUploadIntentRecord,
} from './FileRepository'
