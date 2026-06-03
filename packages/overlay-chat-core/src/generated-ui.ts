export const GENERATED_UI_DATA_TYPE = 'overlay.generated_ui' as const
export const GENERATED_UI_VERSION = 1 as const

export type GeneratedUiKind = 'draft.text' | 'draft.email' | 'connector.connect'

export type GeneratedUiVariant = {
  id: string
  label: string
  subject?: string
  body: string
}

export type GeneratedTextDraftData = {
  version: typeof GENERATED_UI_VERSION
  kind: 'draft.text'
  title?: string
  body: string
  format?: 'plain' | 'markdown'
}

export type GeneratedEmailDraftData = {
  version: typeof GENERATED_UI_VERSION
  kind: 'draft.email'
  subject: string
  body: string
  to?: string[]
  cc?: string[]
  bcc?: string[]
  provider?: 'gmail'
  variants?: GeneratedUiVariant[]
}

export type GeneratedConnectorData = {
  version: typeof GENERATED_UI_VERSION
  kind: 'connector.connect'
  serviceName: string
  slug?: string
  description?: string
  connectUrl?: string
  connected?: boolean
}

export type GeneratedUiData =
  | GeneratedTextDraftData
  | GeneratedEmailDraftData
  | GeneratedConnectorData

export type GeneratedUiPart = {
  type: 'data'
  id: string
  dataType: typeof GENERATED_UI_DATA_TYPE
  data: GeneratedUiData
  transient?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out = value.map(nonEmptyString).filter((item): item is string => Boolean(item))
  return out.length ? out.slice(0, 20) : undefined
}

function normalizeVariant(value: unknown, index: number): GeneratedUiVariant | null {
  const record = asRecord(value)
  if (!record) return null
  const body = nonEmptyString(record.body)
  if (!body) return null
  return {
    id: nonEmptyString(record.id) ?? `variant-${index + 1}`,
    label: nonEmptyString(record.label) ?? `Variant ${index + 1}`,
    ...(optionalString(record.subject) ? { subject: optionalString(record.subject) } : {}),
    body,
  }
}

function normalizeVariants(value: unknown): GeneratedUiVariant[] | undefined {
  if (!Array.isArray(value)) return undefined
  const variants = value
    .map((item, index) => normalizeVariant(item, index))
    .filter((item): item is GeneratedUiVariant => Boolean(item))
    .slice(0, 6)
  return variants.length ? variants : undefined
}

export function normalizeGeneratedUiData(value: unknown): GeneratedUiData | null {
  const record = asRecord(value)
  if (!record || record.version !== GENERATED_UI_VERSION) return null
  if (record.kind === 'draft.text') {
    const body = nonEmptyString(record.body)
    if (!body) return null
    const format = record.format === 'markdown' ? 'markdown' : record.format === 'plain' ? 'plain' : undefined
    return {
      version: GENERATED_UI_VERSION,
      kind: 'draft.text',
      ...(optionalString(record.title) ? { title: optionalString(record.title) } : {}),
      body,
      ...(format ? { format } : {}),
    }
  }
  if (record.kind === 'draft.email') {
    const subject = nonEmptyString(record.subject)
    const body = nonEmptyString(record.body)
    if (!subject || !body) return null
    const provider = record.provider === 'gmail' ? 'gmail' : undefined
    const variants = normalizeVariants(record.variants)
    return {
      version: GENERATED_UI_VERSION,
      kind: 'draft.email',
      subject,
      body,
      ...(optionalStringArray(record.to) ? { to: optionalStringArray(record.to) } : {}),
      ...(optionalStringArray(record.cc) ? { cc: optionalStringArray(record.cc) } : {}),
      ...(optionalStringArray(record.bcc) ? { bcc: optionalStringArray(record.bcc) } : {}),
      ...(provider ? { provider } : {}),
      ...(variants ? { variants } : {}),
    }
  }
  if (record.kind === 'connector.connect') {
    const serviceName = nonEmptyString(record.serviceName)
    if (!serviceName) return null
    return {
      version: GENERATED_UI_VERSION,
      kind: 'connector.connect',
      serviceName,
      ...(optionalString(record.slug) ? { slug: optionalString(record.slug) } : {}),
      ...(optionalString(record.description) ? { description: optionalString(record.description) } : {}),
      ...(optionalString(record.connectUrl) ? { connectUrl: optionalString(record.connectUrl) } : {}),
      ...(typeof record.connected === 'boolean' ? { connected: record.connected } : {}),
    }
  }
  return null
}

export function isGeneratedUiData(value: unknown): value is GeneratedUiData {
  return normalizeGeneratedUiData(value) !== null
}

export function isGeneratedUiPart(value: unknown): value is GeneratedUiPart {
  const record = asRecord(value)
  if (!record) return false
  if (record.type !== 'data' || record.dataType !== GENERATED_UI_DATA_TYPE) return false
  if (!nonEmptyString(record.id)) return false
  return isGeneratedUiData(record.data)
}

export function generatedUiDataToPlainText(data: GeneratedUiData): string {
  if (data.kind === 'draft.text') {
    return [data.title, data.body].filter(Boolean).join('\n\n')
  }
  if (data.kind === 'draft.email') {
    const lines: string[] = []
    if (data.to?.length) lines.push(`To: ${data.to.join(', ')}`)
    if (data.cc?.length) lines.push(`Cc: ${data.cc.join(', ')}`)
    if (data.bcc?.length) lines.push(`Bcc: ${data.bcc.join(', ')}`)
    lines.push(`Subject: ${data.subject}`)
    lines.push(data.body)
    return lines.join('\n\n')
  }
  const lines = [data.serviceName]
  if (data.description) lines.push(data.description)
  if (data.connectUrl) lines.push(data.connectUrl)
  return lines.join('\n')
}

export function buildGeneratedUiPart(id: string, data: unknown): GeneratedUiPart | null {
  const normalized = normalizeGeneratedUiData(data)
  const partId = nonEmptyString(id)
  if (!partId || !normalized) return null
  return {
    type: 'data',
    id: partId,
    dataType: GENERATED_UI_DATA_TYPE,
    data: normalized,
  }
}
