export const OUTPUT_TYPES = [
  'image',
  'video',
  'audio',
  'document',
  'archive',
  'code',
  'text',
  'other',
] as const

export type OutputType = (typeof OUTPUT_TYPES)[number]

export const OUTPUT_SOURCES = [
  'image_generation',
  'video_generation',
  'sandbox',
] as const

export type OutputSource = (typeof OUTPUT_SOURCES)[number]

export function isKnownOutputType(value: string): value is OutputType {
  return OUTPUT_TYPES.includes(value as OutputType)
}

export function isMediaOutputType(value: string): value is 'image' | 'video' {
  return value === 'image' || value === 'video'
}

export function classifyOutputType(fileName?: string, mimeType?: string): OutputType {
  const normalizedMime = mimeType?.trim().toLowerCase() || ''
  const normalizedName = fileName?.trim().toLowerCase() || ''

  if (normalizedMime.startsWith('image/')) return 'image'
  if (normalizedMime.startsWith('video/')) return 'video'
  if (normalizedMime.startsWith('audio/')) return 'audio'
  if (
    normalizedMime === 'application/pdf' ||
    normalizedMime.includes('presentation') ||
    normalizedMime.includes('word') ||
    normalizedMime.includes('sheet') ||
    normalizedMime.includes('officedocument') ||
    normalizedMime === 'text/html'
  ) {
    return 'document'
  }
  if (
    normalizedMime.includes('zip') ||
    normalizedMime.includes('tar') ||
    normalizedMime.includes('gzip') ||
    normalizedMime.includes('compressed') ||
    normalizedMime.includes('archive')
  ) {
    return 'archive'
  }
  if (
    normalizedMime.includes('javascript') ||
    normalizedMime.includes('typescript') ||
    normalizedMime.includes('python') ||
    normalizedMime.includes('json')
  ) {
    return 'code'
  }
  if (normalizedMime.startsWith('text/')) return 'text'

  if (
    normalizedName.endsWith('.png') ||
    normalizedName.endsWith('.jpg') ||
    normalizedName.endsWith('.jpeg') ||
    normalizedName.endsWith('.gif') ||
    normalizedName.endsWith('.webp') ||
    normalizedName.endsWith('.svg')
  ) {
    return 'image'
  }
  if (
    normalizedName.endsWith('.mp4') ||
    normalizedName.endsWith('.mov') ||
    normalizedName.endsWith('.webm') ||
    normalizedName.endsWith('.mkv')
  ) {
    return 'video'
  }
  if (
    normalizedName.endsWith('.mp3') ||
    normalizedName.endsWith('.wav') ||
    normalizedName.endsWith('.m4a') ||
    normalizedName.endsWith('.aac')
  ) {
    return 'audio'
  }
  if (
    normalizedName.endsWith('.pdf') ||
    normalizedName.endsWith('.ppt') ||
    normalizedName.endsWith('.pptx') ||
    normalizedName.endsWith('.doc') ||
    normalizedName.endsWith('.docx') ||
    normalizedName.endsWith('.xls') ||
    normalizedName.endsWith('.xlsx') ||
    normalizedName.endsWith('.html')
  ) {
    return 'document'
  }
  if (
    normalizedName.endsWith('.zip') ||
    normalizedName.endsWith('.tar') ||
    normalizedName.endsWith('.gz') ||
    normalizedName.endsWith('.tgz') ||
    normalizedName.endsWith('.rar')
  ) {
    return 'archive'
  }
  if (
    normalizedName.endsWith('.js') ||
    normalizedName.endsWith('.ts') ||
    normalizedName.endsWith('.tsx') ||
    normalizedName.endsWith('.jsx') ||
    normalizedName.endsWith('.py') ||
    normalizedName.endsWith('.json') ||
    normalizedName.endsWith('.md')
  ) {
    return 'code'
  }
  if (
    normalizedName.endsWith('.txt') ||
    normalizedName.endsWith('.csv') ||
    normalizedName.endsWith('.log')
  ) {
    return 'text'
  }

  return 'other'
}

export function defaultDownloadName(output: {
  fileName?: string | null
  type: OutputType
  _id?: string
}): string {
  if (output.fileName?.trim()) {
    return output.fileName.trim()
  }

  const suffixByType: Record<OutputType, string> = {
    image: 'png',
    video: 'mp4',
    audio: 'mp3',
    document: 'pdf',
    archive: 'zip',
    code: 'txt',
    text: 'txt',
    other: 'bin',
  }

  return `output-${output._id ?? 'file'}.${suffixByType[output.type]}`
}
