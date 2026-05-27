import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JsonRenderDataPayload, JsonRenderActionResult } from '@overlay/chat-core'
import type { MessageToolPart } from '@overlay/chat-core'
import { JSONUIProvider, Renderer, type Spec } from '@json-render/react'
import {
  JsonRenderActionContext,
  JsonRenderFormContext,
  jsonRenderRegistry,
  jsonRenderRegistryKnownTypes,
  type JsonRenderActionName,
} from './registry'

export type JsonRenderToolOutput = JsonRenderDataPayload

type JsonRenderPartProps = {
  payload?: JsonRenderDataPayload
  part?: MessageToolPart
  conversationId?: string | null
  assistantMessageId?: string | null
  dataPartId?: string | null
  responseInProgress?: boolean
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object') return false
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== 'string') return false
  }
  return true
}

function isJsonRenderPayload(value: unknown): value is JsonRenderDataPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as {
    schemaVersion?: unknown
    spec?: { root?: unknown; elements?: unknown }
    actions?: unknown
  }
  return (
    payload.schemaVersion === 1 &&
    typeof payload.spec?.root === 'string' &&
    payload.spec.elements !== null &&
    typeof payload.spec.elements === 'object' &&
    Array.isArray(payload.actions)
  )
}

function parseToolOutput(part: MessageToolPart | undefined): JsonRenderDataPayload | null {
  if (!part || part.state !== 'output-available') return null
  const output = part.output as Record<string, unknown> | undefined
  if (!output || typeof output !== 'object') return null
  if (isJsonRenderPayload(output)) return output
  const spec = output.spec as Spec | undefined
  if (!spec || typeof spec !== 'object' || typeof (spec as { root?: unknown }).root !== 'string') return null
  return {
    schemaVersion: 1,
    spec: spec as JsonRenderDataPayload['spec'],
    initialValues: isStringRecord(output.initialValues) ? output.initialValues : undefined,
    actions: [
      {
        id: 'send-email',
        kind: 'gmail.sendEmail',
        fieldMap: {
          recipientEmail: 'recipientEmail',
          subject: 'subject',
          body: 'body',
          cc: 'cc',
          bcc: 'bcc',
        },
      },
    ],
    actionResults: { 'send-email': { status: 'idle' } },
  }
}

function statusText(result: JsonRenderActionResult | undefined, responseInProgress: boolean): string | null {
  if (responseInProgress) return 'Ready when the response finishes.'
  if (!result || result.status === 'idle') return null
  if (result.status === 'running') return 'Sending...'
  if (result.status === 'succeeded') return result.message || 'Sent'
  if (result.status === 'failed') return result.error || 'Send failed.'
  return null
}

export function JsonRenderPart({
  payload,
  part,
  conversationId,
  assistantMessageId,
  dataPartId,
  responseInProgress = false,
}: JsonRenderPartProps) {
  const parsed = useMemo(() => payload ?? parseToolOutput(part), [payload, part])
  const [values, setValues] = useState<Record<string, string>>(parsed?.initialValues ?? {})
  const [localResults, setLocalResults] = useState<Record<string, JsonRenderActionResult>>({})

  useEffect(() => {
    if (!parsed) return
    setValues(parsed.initialValues ?? {})
    setLocalResults({})
  }, [parsed])

  const actionResults = useMemo(
    () => ({ ...(parsed?.actionResults ?? {}), ...localResults }),
    [parsed?.actionResults, localResults],
  )
  const primaryAction = parsed?.actions.find((action) => action.kind === 'gmail.sendEmail')
  const primaryResult = primaryAction ? actionResults[primaryAction.id] : undefined
  const message = statusText(primaryResult, responseInProgress)

  const setValue = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  const dispatch = useCallback(
    async (actionName: JsonRenderActionName) => {
      if (!parsed) return
      if (actionName === 'cancel') {
        setLocalResults((prev) => ({
          ...prev,
          cancel: { status: 'succeeded', message: 'Cancelled', updatedAt: Date.now() },
        }))
        return
      }

      const action = parsed.actions.find((candidate) => candidate.id === actionName)
      if (!action || action.kind !== 'gmail.sendEmail') return
      if (!conversationId || !assistantMessageId || !dataPartId || responseInProgress) return

      setLocalResults((prev) => ({
        ...prev,
        [action.id]: { status: 'running', updatedAt: Date.now() },
      }))
      try {
        const response = await fetch('/api/app/chat-actions/gmail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            assistantMessageId,
            dataPartId,
            actionId: action.id,
            values,
          }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || data?.success === false) {
          const err = typeof data?.message === 'string' ? data.message : 'Send failed.'
          throw new Error(err)
        }
        setLocalResults((prev) => ({
          ...prev,
          [action.id]: {
            status: 'succeeded',
            message: typeof data?.message === 'string' ? data.message : 'Sent',
            updatedAt: Date.now(),
          },
        }))
      } catch (error) {
        setLocalResults((prev) => ({
          ...prev,
          [action.id]: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Send failed.',
            updatedAt: Date.now(),
          },
        }))
      }
    },
    [assistantMessageId, conversationId, dataPartId, parsed, responseInProgress, values],
  )

  const isActionDisabled = useCallback(
    (actionName: JsonRenderActionName) => {
      if (actionName === 'cancel') return false
      const result = actionResults[actionName]
      return (
        responseInProgress ||
        !conversationId ||
        !assistantMessageId ||
        !dataPartId ||
        result?.status === 'running' ||
        result?.status === 'succeeded'
      )
    },
    [actionResults, assistantMessageId, conversationId, dataPartId, responseInProgress],
  )

  const getActionLabel = useCallback(
    (actionName: JsonRenderActionName, fallback: string) => {
      const result = actionResults[actionName]
      if (result?.status === 'running') return 'Sending...'
      if (result?.status === 'succeeded') return 'Sent'
      return fallback
    },
    [actionResults],
  )

  if (!parsed) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-50/40 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
        Email form unavailable.
      </div>
    )
  }

  return (
    <JsonRenderFormContext.Provider value={{ values, setValue }}>
      <JsonRenderActionContext.Provider value={{ dispatch, isActionDisabled, getActionLabel }}>
        <JSONUIProvider registry={jsonRenderRegistry}>
          <div className="space-y-2">
            <Renderer spec={parsed.spec as Spec} registry={jsonRenderRegistry} />
            {message ? (
              <p
                className={`px-1 text-[11px] ${
                  primaryResult?.status === 'failed'
                    ? 'text-red-600'
                    : primaryResult?.status === 'succeeded'
                      ? 'text-emerald-600'
                      : 'text-[var(--muted-light)]'
                }`}
              >
                {message}
              </p>
            ) : null}
          </div>
        </JSONUIProvider>
      </JsonRenderActionContext.Provider>
    </JsonRenderFormContext.Provider>
  )
}

export { jsonRenderRegistryKnownTypes }
