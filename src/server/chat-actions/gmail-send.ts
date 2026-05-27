import { createHash } from 'node:crypto'

export const GMAIL_SEND_TOOL_SLUG = 'GMAIL_SEND_EMAIL'
export const GMAIL_TOOLKIT_VERSION = '20260506_01'

export type GmailSendFieldMap = {
  recipientEmail: string
  subject: string
  body: string
  cc?: string
  bcc?: string
}

export type GmailSendActionDescriptor = {
  id: string
  kind: 'gmail.sendEmail'
  fieldMap: GmailSendFieldMap
}

export type NormalizedGmailSendInput = {
  recipientEmail: string
  subject: string
  body: string
  cc?: string[]
  bcc?: string[]
}

export type ComposioGmailSendArguments = {
  recipient_email: string
  subject: string
  body: string
  is_html: false
  cc?: string[]
  bcc?: string[]
}

function stringValue(values: Record<string, unknown>, key: string | undefined): string {
  if (!key) return ''
  const value = values[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function parseEmailList(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[;,]/g)
    .map((part) => part.trim())
    .filter(Boolean)
}

function assertRequired(value: string, label: string): string {
  if (!value.trim()) {
    throw new Error(`${label} is required`)
  }
  return value.trim()
}

export function normalizeGmailSendValues(
  action: GmailSendActionDescriptor,
  values: Record<string, unknown>,
): NormalizedGmailSendInput {
  if (action.kind !== 'gmail.sendEmail') {
    throw new Error('Unsupported chat action')
  }
  const recipientEmail = assertRequired(
    stringValue(values, action.fieldMap.recipientEmail) || stringValue(values, 'to'),
    'Recipient',
  )
  const subject = assertRequired(stringValue(values, action.fieldMap.subject), 'Subject')
  const body = assertRequired(stringValue(values, action.fieldMap.body), 'Body')
  const cc = parseEmailList(stringValue(values, action.fieldMap.cc))
  const bcc = parseEmailList(stringValue(values, action.fieldMap.bcc))

  return {
    recipientEmail,
    subject,
    body,
    ...(cc.length > 0 ? { cc } : {}),
    ...(bcc.length > 0 ? { bcc } : {}),
  }
}

export function buildComposioGmailSendArguments(
  input: NormalizedGmailSendInput,
): ComposioGmailSendArguments {
  return {
    recipient_email: input.recipientEmail,
    subject: input.subject,
    body: input.body,
    is_html: false,
    ...(input.cc?.length ? { cc: input.cc } : {}),
    ...(input.bcc?.length ? { bcc: input.bcc } : {}),
  }
}

export function stableHashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(sortForStableHash(value))).digest('hex')
}

function sortForStableHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForStableHash)
  if (!value || typeof value !== 'object') return value
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = sortForStableHash((value as Record<string, unknown>)[key])
  }
  return sorted
}

export function buildChatActionIdempotencyKey(params: {
  userId: string
  conversationId: string
  assistantMessageId: string
  dataPartId: string
  actionId: string
  normalizedInput: NormalizedGmailSendInput
}): { idempotencyKey: string; inputHash: string } {
  const inputHash = stableHashJson(params.normalizedInput)
  return {
    inputHash,
    idempotencyKey: stableHashJson({
      userId: params.userId,
      conversationId: params.conversationId,
      assistantMessageId: params.assistantMessageId,
      dataPartId: params.dataPartId,
      actionId: params.actionId,
      inputHash,
    }),
  }
}
