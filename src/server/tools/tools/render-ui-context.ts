import 'server-only'

import type { UIMessageStreamWriter } from 'ai'

/**
 * Data part `dataType` that carries a json-render Spec for inline UI rendering.
 *
 * The act route's UI stream emits `data-json-render` parts; the chat client
 * routes them to the json-render React renderer (see `<JsonRenderPart>`).
 */
export const JSON_RENDER_DATA_TYPE = 'json-render'

export const JSON_RENDER_SCHEMA_VERSION = 1

export type JsonRenderActionStatus = 'idle' | 'running' | 'succeeded' | 'failed'

export interface JsonRenderActionResult {
  status: JsonRenderActionStatus
  message?: string
  error?: string
  executionId?: string
  updatedAt?: number
}

export interface JsonRenderGmailSendActionDescriptor {
  id: string
  kind: 'gmail.sendEmail'
  fieldMap: {
    recipientEmail: string
    subject: string
    body: string
    cc?: string
    bcc?: string
  }
}

/**
 * Payload shape carried on a `data-json-render` part.
 *
 * @property spec          json-render flat element tree (root + elements map).
 * @property initialValues Optional initial values for named Input/Textarea fields.
 * @property actions       Server-verifiable chat actions bound to this UI.
 */
export interface JsonRenderDataPayload {
  schemaVersion: typeof JSON_RENDER_SCHEMA_VERSION
  spec: { root: string; elements: Record<string, unknown> }
  initialValues?: Record<string, string>
  actions: JsonRenderGmailSendActionDescriptor[]
  actionResults?: Record<string, JsonRenderActionResult>
}

export interface JsonRenderDataPartForPersistence extends Record<string, unknown> {
  type: 'data'
  id: string
  dataType: typeof JSON_RENDER_DATA_TYPE
  data: JsonRenderDataPayload
}

/**
 * `experimental_context` shape passed from the act route into the ToolLoopAgent.
 *
 * Tools that need to emit UI-stream side-channel data parts (e.g. `render_ui`)
 * read the writer from this context.
 */
export interface ActAgentExperimentalContext {
  writer?: UIMessageStreamWriter
  dataParts?: JsonRenderDataPartForPersistence[]
}

/**
 * Safely extract the UI stream writer from an opaque experimental_context value.
 *
 * Returns undefined when the context is absent or shape mismatch — callers must
 * treat the writer as optional and fall back to writer-less behaviour.
 */
export function extractUIStreamWriter(experimental_context: unknown): UIMessageStreamWriter | undefined {
  if (!experimental_context || typeof experimental_context !== 'object') return undefined
  const writer = (experimental_context as ActAgentExperimentalContext).writer
  return typeof writer === 'object' && writer !== null && typeof writer.write === 'function' ? writer : undefined
}

export function appendJsonRenderDataPart(
  experimental_context: unknown,
  part: JsonRenderDataPartForPersistence,
): void {
  if (!experimental_context || typeof experimental_context !== 'object') return
  const context = experimental_context as ActAgentExperimentalContext
  const existing = Array.isArray(context.dataParts) ? context.dataParts : []
  context.dataParts = [
    ...existing.filter((candidate) => candidate.id !== part.id),
    part,
  ]
}
