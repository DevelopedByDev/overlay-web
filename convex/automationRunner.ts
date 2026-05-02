import { v } from 'convex/values'
import { api, internal } from './_generated/api'
import { internalAction } from './_generated/server'
import type { Id } from './_generated/dataModel'

const SERVICE_AUTH_AUDIENCE = 'overlay-internal-api'
const SERVICE_AUTH_ISSUER = 'overlay-nextjs'
const SERVICE_AUTH_HEADER = 'x-overlay-service-auth'
const textEncoder = new TextEncoder()

function summarizeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown automation error'
  }
}

function getAutomationRunnerBaseUrl(): string {
  const explicit = process.env.AUTOMATION_RUNNER_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  const appUrl =
    process.env.DEV_NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (appUrl) return appUrl.replace(/\/+$/, '')

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) return `https://${vercelUrl}`.replace(/\/+$/, '')

  return 'https://getoverlay.io'
}

function getInternalApiSecret(): string {
  const secret = process.env.INTERNAL_API_SECRET?.trim()
  if (!secret) {
    throw new Error('INTERNAL_API_SECRET is not configured')
  }
  return secret
}

function getServiceAuthSecret(): string {
  const dedicated = process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim()
  if (dedicated) return dedicated
  return getInternalApiSecret()
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function toBase64Url(value: string): string {
  return bytesToBase64Url(textEncoder.encode(value))
}

async function buildServiceAuthToken(params: {
  userId: string
  method: string
  path: string
}): Promise<string> {
  const payloadSegment = toBase64Url(JSON.stringify({
    aud: SERVICE_AUTH_AUDIENCE,
    iss: SERVICE_AUTH_ISSUER,
    jti: crypto.randomUUID(),
    sub: params.userId.trim(),
    method: params.method.trim().toUpperCase(),
    path: params.path.trim() || '/',
    iat: Date.now(),
    exp: Date.now() + 60_000,
  }))
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(getServiceAuthSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payloadSegment))
  return `${payloadSegment}.${bytesToBase64Url(new Uint8Array(signature))}`
}

export const runMinuteTick = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const runIds = await ctx.runMutation(internal.automations.claimDueRuns, {
      now: Date.now(),
      limit: 25,
    })

    for (const runId of runIds) {
      await ctx.scheduler.runAfter(0, internal.automationRunner.runAutomation, {
        runId,
      })
    }

    return null
  },
})

export const runAutomation = internalAction({
  args: {
    runId: v.id('automationRuns'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(internal.automations.getRunForExecution, {
      runId: args.runId,
    })
    if (!payload) return null

    const { run, automation } = payload
    if (run.status !== 'queued') return null

    const now = Date.now()
    const turnId = `automation-${args.runId}-${now}`
    const existingConversationId = (automation.sourceConversationId || automation.conversationId) as
      | Id<'conversations'>
      | undefined
    const conversationId = existingConversationId ?? await ctx.runMutation(api.conversations.create, {
      userId: automation.userId,
      serverSecret: getInternalApiSecret(),
      title: automation.name || automation.title || 'Automation run',
      projectId: automation.projectId,
      askModelIds: [automation.modelId || 'claude-sonnet-4-6'],
      actModelId: automation.modelId || 'claude-sonnet-4-6',
      lastMode: 'act',
    })
    await ctx.runMutation(internal.automations.markRunStarted, {
      runId: args.runId,
      conversationId,
      turnId,
      now,
    })

    try {
      const actPath = '/api/app/conversations/act'
      const response = await fetch(`${getAutomationRunnerBaseUrl()}${actPath}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-overlay-internal-secret': getInternalApiSecret(),
          [SERVICE_AUTH_HEADER]: await buildServiceAuthToken({
            userId: automation.userId,
            method: 'POST',
            path: actPath,
          }),
        },
        body: JSON.stringify({
          conversationId,
          turnId,
          modelId: automation.modelId || 'claude-sonnet-4-6',
          userId: automation.userId,
          mode: 'automate',
          automationMode: true,
          messages: [
            {
              id: turnId,
              role: 'user',
              content: [
                `Scheduled automation: ${automation.name || automation.title || 'Untitled automation'}`,
                automation.description ? `Description: ${automation.description}` : '',
                `Scheduled for: ${new Date(run.scheduledFor).toISOString()}`,
                '',
                automation.instructions || automation.instructionsMarkdown || '',
              ].filter(Boolean).join('\n'),
              parts: [
                {
                  type: 'text',
                  text: [
                    `Scheduled automation: ${automation.name || automation.title || 'Untitled automation'}`,
                    automation.description ? `Description: ${automation.description}` : '',
                    `Scheduled for: ${new Date(run.scheduledFor).toISOString()}`,
                    '',
                    automation.instructions || automation.instructionsMarkdown || '',
                  ].filter(Boolean).join('\n'),
                },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `Automation runner returned ${response.status}`)
      }

      await response.text().catch(() => '')
      await ctx.runMutation(internal.automations.markRunCompleted, {
        runId: args.runId,
        conversationId,
        now: Date.now(),
      })
    } catch (error) {
      await ctx.runMutation(internal.automations.markRunFailed, {
        runId: args.runId,
        error: summarizeError(error).slice(0, 1000),
        now: Date.now(),
      })
    }

    return null
  },
})
