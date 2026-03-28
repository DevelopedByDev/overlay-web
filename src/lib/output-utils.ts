const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  html: 'text/html; charset=utf-8',
  json: 'application/json; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  ts: 'text/plain; charset=utf-8',
  zip: 'application/zip',
  tar: 'application/x-tar',
  gz: 'application/gzip',
}

export type OutputType =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'code'
  | 'text'
  | 'other'

export function guessMimeType(fileName: string, fallback?: string | null): string | undefined {
  const explicit = fallback?.trim()
  if (explicit) return explicit
  const extension = fileName.split('.').pop()?.trim().toLowerCase()
  if (!extension) return undefined
  return MIME_BY_EXTENSION[extension]
}

export function classifyOutputType(fileName?: string | null, mimeType?: string | null): OutputType {
  const normalizedMime = mimeType?.trim().toLowerCase() || ''
  const extension = fileName?.split('.').pop()?.trim().toLowerCase() || ''

  if (normalizedMime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
    return 'image'
  }
  if (normalizedMime.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(extension)) {
    return 'video'
  }
  if (normalizedMime.startsWith('audio/') || ['mp3', 'wav', 'm4a'].includes(extension)) {
    return 'audio'
  }
  if (
    normalizedMime.includes('zip') ||
    normalizedMime.includes('tar') ||
    normalizedMime.includes('gzip') ||
    ['zip', 'tar', 'gz'].includes(extension)
  ) {
    return 'archive'
  }
  if (
    normalizedMime.includes('javascript') ||
    normalizedMime.includes('json') ||
    ['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'css', 'scss'].includes(extension)
  ) {
    return 'code'
  }
  if (
    normalizedMime.startsWith('text/') ||
    ['txt', 'md', 'csv'].includes(extension)
  ) {
    return 'text'
  }
  if (
    normalizedMime.includes('pdf') ||
    normalizedMime.includes('presentation') ||
    normalizedMime.includes('powerpoint') ||
    normalizedMime.includes('wordprocessingml') ||
    ['pdf', 'ppt', 'pptx', 'doc', 'docx', 'key'].includes(extension)
  ) {
    return 'document'
  }
  return 'other'
}

