import { v } from 'convex/values'
import {
  action, mutation, query, internalMutation, internalQuery, internalAction
} from './_generated/server'
import { api, internal, components } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'
import { requireAccessToken, validateServerSecret } from './lib/auth'
import {
  redactIdentifierForLog,
  redactIpForLog,
  summarizeErrorForLog,
  summarizeTextForLog,
} from './lib/logging'
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID, getModel } from '../src/lib/models'
import { calculateTokenCost } from '../src/lib/model-pricing'
import type { Id } from './_generated/dataModel'

const TAG = '[Computer]'
const stripeClient = new StripeSubscriptions(components.stripe, {})

async function authorizeUserAccess(params: {
  accessToken?: string
  serverSecret?: string
  userId: string
}) {
  if (validateServerSecret(params.serverSecret)) {
    return
  }
  await requireAccessToken(params.accessToken ?? '', params.userId)
}

function summarizeUrlForLog(value: string): string {
  try {
    const url = new URL(value)
    const sanitizedPath = url.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => (/^\d+$/.test(segment) ? ':id' : segment))
      .join('/')
    return `${url.origin}/${sanitizedPath}`
  } catch {
    return '[redacted-url]'
  }
}

function summarizeToolOutputForLog(output: unknown): string {
  if (output == null) {
    return 'nullish'
  }

  if (typeof output === 'string') {
    return `string length=${output.length}`
  }

  if (typeof output === 'object') {
    const keys = Object.keys(output as object)
    return `object keys=${keys.slice(0, 8).join(',')}${keys.length > 8 ? ',…' : ''}`
  }

  return typeof output
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    region: v.union(v.literal('eu-central'), v.literal('us-east')),
    userId: v.string(),
    accessToken: v.string(),
  },
  returns: v.id('computers'),
  handler: async (ctx, args) => {
    console.log(
      `${TAG} create — region=${args.region} name=${summarizeTextForLog(args.name)}`
    )
    await requireAccessToken(args.accessToken, args.userId)
    const trimmedName = args.name.trim()
    if (!trimmedName) {
      throw new Error('Computer name is required')
    }
    const siblings = await ctx.db
      .query('computers')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .collect()
    const nameLower = trimmedName.toLowerCase()
    const duplicate = siblings.some(
      (c) => c.status !== 'deleted' && c.name.trim().toLowerCase() === nameLower,
    )
    if (duplicate) {
      throw new Error('You already have a computer with this name. Choose a different name.')
    }
    const gatewayToken =
      crypto.randomUUID().replace(/-/g, '') +
      crypto.randomUUID().replace(/-/g, '')
    const readySecret = crypto.randomUUID().replace(/-/g, '')
    const id = await ctx.db.insert('computers', {
      userId: args.userId,
      name: trimmedName,
      setupType: 'managed',
      region: args.region,
      status: 'pending_payment',
      gatewayToken,
      readySecret,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    console.log(`${TAG} create — SUCCESS: computerId=${redactIdentifierForLog(id)} status=pending_payment`)
    return id
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const setStripeInfo = internalMutation({
  args: {
    computerId: v.id('computers'),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(
      `${TAG} setStripeInfo — computerId=${redactIdentifierForLog(args.computerId)}`
    )
    await ctx.db.patch(args.computerId, {
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeCustomerId: args.stripeCustomerId,
      updatedAt: Date.now(),
    })
    console.log(`${TAG} setStripeInfo — DONE`)
  },
})

export const setProvisioningInfo = internalMutation({
  args: {
    computerId: v.id('computers'),
    hetznerServerId: v.number(),
    hetznerServerIp: v.string(),
    hetznerFirewallId: v.number(),
  },
  handler: async (ctx, args) => {
    console.log(
      `${TAG} setProvisioningInfo — computerId=${redactIdentifierForLog(args.computerId)} ip=${redactIpForLog(args.hetznerServerIp)}`
    )
    await ctx.db.patch(args.computerId, {
      status: 'provisioning',
      provisioningStep: 'creating_server',
      hetznerServerId: args.hetznerServerId,
      hetznerServerIp: args.hetznerServerIp,
      hetznerFirewallId: args.hetznerFirewallId,
      updatedAt: Date.now(),
    })
    console.log(`${TAG} setProvisioningInfo — DONE status=provisioning step=creating_server`)
  },
})

export const setProvisioningStep = internalMutation({
  args: { computerId: v.id('computers'), step: v.string() },
  handler: async (ctx, args) => {
    console.log(
      `${TAG} setProvisioningStep — computerId=${redactIdentifierForLog(args.computerId)} step=${args.step}`
    )
    await ctx.db.patch(args.computerId, {
      provisioningStep: args.step,
      updatedAt: Date.now(),
    })
  },
})

export const setReady = internalMutation({
  args: { computerId: v.id('computers'), readySecret: v.string() },
  handler: async (ctx, args) => {
    console.log(`${TAG} setReady — computerId=${redactIdentifierForLog(args.computerId)}`)
    const computer = await ctx.db.get(args.computerId)
    if (!computer) {
      console.error(`${TAG} setReady — FAILED: computer not found`)
      throw new Error('Computer not found')
    }
    if (computer.status === 'ready') {
      console.log(`${TAG} setReady — already ready, idempotent return`)
      return
    }
    if (computer.readySecret !== args.readySecret) {
      console.error(
        `${TAG} setReady — FAILED: invalid readySecret for computerId=${redactIdentifierForLog(args.computerId)}`
      )
      throw new Error('Invalid readySecret')
    }
    await ctx.db.patch(args.computerId, {
      status: 'ready',
      readySecret: undefined,
      provisioningStep: undefined,
      updatedAt: Date.now(),
    })
    console.log(
      `${TAG} setReady — SUCCESS: computerId=${redactIdentifierForLog(args.computerId)} status=ready readySecret cleared`
    )
  },
})

export const setError = internalMutation({
  args: { computerId: v.id('computers'), message: v.string() },
  handler: async (ctx, args) => {
    console.error(
      `${TAG} setError — computerId=${redactIdentifierForLog(args.computerId)} message=${summarizeTextForLog(args.message)}`
    )
    await ctx.db.patch(args.computerId, {
      status: 'error',
      errorMessage: args.message,
      updatedAt: Date.now(),
    })
  },
})

export const setPastDue = internalMutation({
  args: { computerId: v.id('computers') },
  handler: async (ctx, args) => {
    const now = Date.now()
    console.warn(
      `${TAG} setPastDue — computerId=${redactIdentifierForLog(args.computerId)} teardown scheduled in 7 days`
    )
    await ctx.db.patch(args.computerId, {
      status: 'past_due',
      pastDueAt: now,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(
      7 * 24 * 60 * 60 * 1000,
      internal.computers.teardownComputer,
      { computerId: args.computerId }
    )
    console.log(`${TAG} setPastDue — DONE status=past_due`)
  },
})

export const markDeleted = internalMutation({
  args: { computerId: v.id('computers') },
  handler: async (ctx, args) => {
    console.log(`${TAG} markDeleted — computerId=${redactIdentifierForLog(args.computerId)}`)
    await ctx.db.patch(args.computerId, {
      status: 'deleted',
      gatewayToken: undefined,
      readySecret: undefined,
      updatedAt: Date.now(),
    })
    console.log(`${TAG} markDeleted — DONE secrets cleared`)
  },
})

export const logEvent = internalMutation({
  args: {
    computerId: v.id('computers'),
    type: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(
      `${TAG} event [${args.type}] computerId=${redactIdentifierForLog(args.computerId)} message=${summarizeTextForLog(args.message)}`
    )
    await ctx.db.insert('computerEvents', {
      computerId: args.computerId,
      type: args.type,
      message: args.message,
      createdAt: Date.now(),
    })
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

export const get = query({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      await authorizeUserAccess(args)
    } catch {
      return null
    }
    const computer = await ctx.db.get(args.computerId)
    if (!computer || computer.userId !== args.userId) return null
    return { ...computer, gatewayToken: undefined, readySecret: undefined }
  },
})

/** Resolve chat/tool target: optional computerId, optional computerName, or default when exactly one ready computer. */
export const resolveForChatTools = query({
  args: {
    userId: v.string(),
    accessToken: v.string(),
    computerName: v.optional(v.string()),
    computerId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    { ok: true; computerId: Id<'computers'>; displayName: string } | { ok: false; error: string }
  > => {
    try {
      await requireAccessToken(args.accessToken, args.userId)
    } catch {
      return { ok: false, error: 'Unauthorized' }
    }
    const rows = await ctx.db
      .query('computers')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .collect()
    const active = rows.filter((c) => c.status !== 'deleted')

    const cid = args.computerId?.trim()
    if (cid) {
      const c = active.find((x) => x._id === cid)
      if (!c) return { ok: false, error: 'Computer not found for this account.' }
      return { ok: true, computerId: c._id, displayName: c.name }
    }

    const wantName = args.computerName?.trim()
    if (wantName) {
      const lower = wantName.toLowerCase()
      const matches = active.filter((c) => c.name.trim().toLowerCase() === lower)
      if (matches.length === 0) {
        const labels = active.map((c) => `"${c.name}"`).join(', ')
        return {
          ok: false,
          error: labels
            ? `No computer named "${wantName}". Available: ${labels}`
            : `No computer named "${wantName}".`,
        }
      }
      if (matches.length > 1) {
        return {
          ok: false,
          error: 'Multiple computers share that name; rename one in the app or pass computerId.',
        }
      }
      return { ok: true, computerId: matches[0]!._id, displayName: matches[0]!.name }
    }

    const ready = active.filter((c) => c.status === 'ready')
    if (ready.length === 1) {
      return { ok: true, computerId: ready[0]!._id, displayName: ready[0]!.name }
    }
    if (ready.length === 0) {
      return {
        ok: false,
        error: 'No ready computers found. Open the Computers page to provision one, then try again.',
      }
    }
    return {
      ok: false,
      error: `You have ${ready.length} computers. Say which one to use by name (e.g. ${ready.map((c) => `"${c.name}"`).join(', ')}).`,
    }
  },
})

export const list = query({
  args: { userId: v.string(), accessToken: v.string() },
  handler: async (ctx, args) => {
    try {
      await requireAccessToken(args.accessToken, args.userId)
    } catch {
      return []
    }
    const computers = await ctx.db
      .query('computers')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .filter((q) => q.neq(q.field('status'), 'deleted'))
      .collect()
    return computers.map((c) => ({ ...c, gatewayToken: undefined, readySecret: undefined }))
  },
})

export const listEvents = query({
  args: { computerId: v.id('computers'), userId: v.string(), accessToken: v.string() },
  handler: async (ctx, args) => {
    try {
      await requireAccessToken(args.accessToken, args.userId)
    } catch {
      return []
    }
    const computer = await ctx.db.get(args.computerId)
    if (!computer || computer.userId !== args.userId) return []
    return ctx.db
      .query('computerEvents')
      .withIndex('by_computerId_createdAt', (q) => q.eq('computerId', args.computerId))
      .order('asc')
      .collect()
  },
})

export const listChatMessages = query({
  args: { computerId: v.id('computers'), userId: v.string(), accessToken: v.string() },
  handler: async (ctx, args) => {
    try {
      await requireAccessToken(args.accessToken, args.userId)
    } catch {
      return []
    }
    const computer = await ctx.db.get(args.computerId)
    if (!computer || computer.userId !== args.userId) return []

    const events = await ctx.db
      .query('computerEvents')
      .withIndex('by_computerId_createdAt', (q) => q.eq('computerId', args.computerId))
      .order('asc')
      .collect()

    return events
      .filter((event) =>
        event.type === 'chat_user' ||
        event.type === 'chat_assistant' ||
        event.type === 'chat_error'
      )
      .map((event) => ({
        _id: event._id,
        role:
          event.type === 'chat_user'
            ? 'user'
            : 'assistant',
        content: event.message,
        createdAt: event.createdAt,
        isError: event.type === 'chat_error',
      }))
  },
})

export const getChatConnection = query({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  returns: v.object({
    gatewayToken: v.string(),
    hooksToken: v.string(),
    hetznerServerIp: v.string(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{ gatewayToken: string; hooksToken: string; hetznerServerIp: string }> => {
    await authorizeUserAccess(args)

    const computer = await ctx.runQuery(internal.computers.getInternal, {
      computerId: args.computerId,
    })

    if (!computer || computer.userId !== args.userId) {
      throw new Error('Computer not found')
    }

    if (computer.status !== 'ready' || !computer.hetznerServerIp || !computer.gatewayToken) {
      throw new Error('Computer is not ready')
    }

    return {
      gatewayToken: computer.gatewayToken,
      hooksToken: deriveHooksToken(computer.gatewayToken),
      hetznerServerIp: computer.hetznerServerIp,
    }
  },
})

export const addChatMessage = mutation({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess(args)

    const computer = await ctx.db.get(args.computerId)
    if (!computer || computer.userId !== args.userId) {
      throw new Error('Computer not found')
    }

    const content = args.content.trim()
    if (!content) {
      throw new Error('Message cannot be empty')
    }

    await ctx.db.insert('computerEvents', {
      computerId: args.computerId,
      type: args.role === 'user' ? 'chat_user' : 'chat_assistant',
      message: content,
      createdAt: Date.now(),
    })

    return { ok: true }
  },
})

export const addChatError = mutation({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess(args)

    const computer = await ctx.db.get(args.computerId)
    if (!computer || computer.userId !== args.userId) {
      throw new Error('Computer not found')
    }

    await ctx.db.insert('computerEvents', {
      computerId: args.computerId,
      type: 'chat_error',
      message: args.message,
      createdAt: Date.now(),
    })

    return { ok: true }
  },
})

export const setChatRuntimeState = mutation({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    sessionKey: v.string(),
    requestedModelId: v.string(),
    requestedModelRef: v.optional(v.string()),
    effectiveProvider: v.optional(v.string()),
    effectiveModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess(args)

    const computer = await ctx.db.get(args.computerId)
    if (!computer || computer.userId !== args.userId) {
      throw new Error('Computer not found')
    }

    const now = Date.now()
    await ctx.db.patch(args.computerId, {
      chatSessionKey: args.sessionKey,
      chatRequestedModelId: args.requestedModelId,
      chatRequestedModelRef: args.requestedModelRef,
      chatEffectiveProvider: args.effectiveProvider,
      chatEffectiveModel: args.effectiveModel,
      chatModelResolvedAt: now,
      updatedAt: now,
    })

    return { ok: true }
  },
})

export const sendChatMessage = action({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.string(),
    message: v.string(),
    modelId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log(
      `${TAG} sendChatMessage — START computerId=${redactIdentifierForLog(args.computerId)}`
    )

    await requireAccessToken(args.accessToken, args.userId)

    const computer = await ctx.runQuery(internal.computers.getInternal, {
      computerId: args.computerId,
    })

    if (!computer || computer.userId !== args.userId) {
      throw new Error('Computer not found')
    }

    if (
      computer.status !== 'ready' ||
      !computer.hetznerServerIp ||
      !computer.gatewayToken
    ) {
      throw new Error('Computer is not ready')
    }

    const message = args.message.trim()
    if (!message) {
      throw new Error('Message cannot be empty')
    }

    // ── Subscription enforcement ──────────────────────────────────────────
    const entitlements = await ctx.runQuery(internal.usage.getEntitlementsInternal, { userId: args.userId })
    if (entitlements) {
      const { tier, creditsUsed, creditsTotal } = entitlements
      const creditsTotalCents = creditsTotal * 100
      const remainingCents = creditsTotalCents - creditsUsed
      console.log(
        `${TAG} sendChatMessage — entitlement check tier=${tier} hasCredits=${remainingCents > 0 ? 'yes' : 'no'}`
      )
      if (tier === 'free') {
        throw new Error('Computer chat requires a Pro or Max subscription.')
      }
      if (remainingCents <= 0) {
        throw new Error('No credits remaining. Please check your subscription to continue using Computer.')
      }
    }

    await ctx.runMutation(internal.computers.logEvent, {
      computerId: args.computerId,
      type: 'chat_user',
      message,
    })

    try {
      const sessionKey = getComputerSessionKey(args.userId, args.computerId)
      const selectedModelId = args.modelId?.trim() || DEFAULT_MODEL_ID
      const modelCandidates = getComputerModelCandidates(selectedModelId)
      let content = ''
      const failures: string[] = []
      let succeededModelRef: string | null = null
      let succeededModelId: string | null = null
      let succeededData: unknown = null

      for (const candidate of modelCandidates) {
        let pendingModelOverrideRetry = false

        try {
          await applySessionModelOverride({
            ip: computer.hetznerServerIp,
            gatewayToken: computer.gatewayToken,
            sessionKey,
            model: candidate.ref,
          })
        } catch (error) {
          pendingModelOverrideRetry = true
          console.warn(
            `${TAG} sendChatMessage — model override deferred for ${candidate.id}: ${summarizeErrorForLog(error)}`
          )
        }

        const response = await fetch(
          `http://${computer.hetznerServerIp}:18789/v1/chat/completions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${computer.gatewayToken}`,
              'Content-Type': 'application/json',
              'x-openclaw-agent-id': 'default',
              'x-openclaw-session-key': sessionKey,
            },
            body: JSON.stringify({
              model: 'openclaw:default',
              user: sessionKey,
              stream: false,
              messages: [
                {
                  role: 'user',
                  content: message,
                },
              ],
            }),
            signal: AbortSignal.timeout(180_000),
          },
        )

        if (!response.ok) {
          const responseText = await response.text()

          if (response.status === 404) {
            throw new Error(
              'This computer was provisioned before Overlay chat support. Delete and recreate it to enable in-page OpenClaw chat.'
            )
          }

          if (response.status === 401) {
            throw new Error('OpenClaw gateway authentication failed.')
          }

          const failure = `${candidate.id}: HTTP ${response.status} body_length=${responseText.length}`
          failures.push(failure)
          console.warn(`${TAG} sendChatMessage — candidate failed ${failure}`)

          if (response.status >= 500) {
            continue
          }

          throw new Error(`Gateway returned HTTP ${response.status}`)
        }

        const data = await response.json()
        const candidateContent = extractAssistantContent(data)

        if (!candidateContent) {
          failures.push(`${candidate.id}: empty response ${summarizeToolOutputForLog(data)}`)
          continue
        }

        content = candidateContent
        succeededModelRef = candidate.ref
        succeededModelId = candidate.id
        succeededData = data

        if (pendingModelOverrideRetry) {
          try {
            await applySessionModelOverride({
              ip: computer.hetznerServerIp,
              gatewayToken: computer.gatewayToken,
              sessionKey,
              model: candidate.ref,
            })
            console.log(
              `${TAG} sendChatMessage — model override applied after session bootstrap computerId=${redactIdentifierForLog(args.computerId)} model=${candidate.id}`
            )
          } catch (retryError) {
            console.warn(
              `${TAG} sendChatMessage — model override retry failed for ${candidate.id}: ${summarizeErrorForLog(retryError)}`
            )
          }
        }

        break
      }

      if (!content) {
        throw new Error(buildComputerChatFailureMessage(selectedModelId, failures))
      }

      await ctx.runMutation(internal.computers.logEvent, {
        computerId: args.computerId,
        type: 'chat_assistant',
        message: content,
      })

      // ── Usage recording ───────────────────────────────────────────────────
      if (succeededModelId) {
        const gatewayUsage = extractGatewayUsage(succeededData)
        const costDollars = calculateTokenCost(
          succeededModelId,
          gatewayUsage.promptTokens,
          gatewayUsage.cachedTokens,
          gatewayUsage.completionTokens
        )
        const costCents = Math.round(costDollars * 100)
        console.log(
          `${TAG} sendChatMessage — usage recorded model=${succeededModelId} input=${gatewayUsage.promptTokens} cached=${gatewayUsage.cachedTokens} output=${gatewayUsage.completionTokens} cost_cents=${costCents}`
        )
        if (costCents > 0) {
          await ctx.runMutation(api.usage.recordBatch, {
            accessToken: args.accessToken,
            userId: args.userId,
            events: [{
              type: 'ask',
              modelId: succeededModelId,
              inputTokens: gatewayUsage.promptTokens,
              outputTokens: gatewayUsage.completionTokens,
              cachedTokens: gatewayUsage.cachedTokens,
              cost: costCents,
              timestamp: Date.now(),
            }],
          })
          const updated = await ctx.runQuery(internal.usage.getEntitlementsInternal, { userId: args.userId })
          if (updated) {
            console.log(
              `${TAG} sendChatMessage — usage state updated hasRemainingCredits=${updated.creditsUsed < updated.creditsTotal * 100 ? 'yes' : 'no'}`
            )
          }
        } else {
          console.log(`${TAG} sendChatMessage — ⚠️  Cost is 0¢ for model=${succeededModelId} — free model or no token data`)
        }
      }

      if (succeededModelRef && succeededModelRef !== modelCandidates[0]?.ref) {
        await ctx.runMutation(internal.computers.logEvent, {
          computerId: args.computerId,
          type: 'status_change',
          message: `Selected model was unavailable. OpenClaw replied using fallback model ${succeededModelRef}.`,
        })
      }

      console.log(`${TAG} sendChatMessage — SUCCESS computerId=${redactIdentifierForLog(args.computerId)}`)
      return { content }
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'OpenClaw request timed out after 3 minutes.'
          : error instanceof Error
            ? error.message
            : 'Failed to reach OpenClaw'

      await ctx.runMutation(internal.computers.logEvent, {
        computerId: args.computerId,
        type: 'chat_error',
        message: `Error: ${message}`,
      })

      console.error(
        `${TAG} sendChatMessage — ERROR computerId=${redactIdentifierForLog(args.computerId)} message=${summarizeTextForLog(message)}`
      )
      throw new Error(message)
    }
  },
})

export const deleteComputer = internalMutation({
  args: { computerId: v.id('computers') },
  handler: async (ctx, { computerId }) => {
    console.warn(`${TAG} deleteComputer — START computerId=${redactIdentifierForLog(computerId)}`)
    const computer = await ctx.db.get(computerId)
    if (!computer) {
      console.warn(`${TAG} deleteComputer — SKIP: computer not found`)
      return { deleted: false, reason: 'not_found' as const }
    }

    const events = await ctx.db
      .query('computerEvents')
      .withIndex('by_computerId_createdAt', (q) => q.eq('computerId', computerId))
      .collect()

    for (const event of events) {
      await ctx.db.delete(event._id)
    }

    await ctx.db.delete(computerId)
    console.warn(
      `${TAG} deleteComputer — DONE computerId=${redactIdentifierForLog(computerId)} eventsDeleted=${events.length}`
    )
    return { deleted: true, eventsDeleted: events.length }
  },
})

export const getByStripeSubscription = internalQuery({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('computers')
      .withIndex('by_stripeSubscriptionId', (q) =>
        q.eq('stripeSubscriptionId', args.stripeSubscriptionId)
      )
      .first()
  },
})

export const getInternal = internalQuery({
  args: { computerId: v.id('computers') },
  handler: async (ctx, args) => ctx.db.get(args.computerId),
})

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const provisionComputer = internalAction({
  args: { computerId: v.id('computers') },
  handler: async (ctx, { computerId }) => {
    console.log(`${TAG} provisionComputer — START computerId=${redactIdentifierForLog(computerId)}`)

    const computer = await ctx.runQuery(internal.computers.getInternal, { computerId })
    if (!computer) {
      console.error(`${TAG} provisionComputer — ABORT: computer not found`)
      throw new Error(`Computer ${computerId} not found`)
    }
    console.log(
      `${TAG} provisionComputer — loaded computer region=${computer.region} status=${computer.status} name=${summarizeTextForLog(computer.name)}`
    )

    const HETZNER_TOKEN = process.env.HETZNER_API_TOKEN!
    const CONVEX_HTTP_URL = process.env.CONVEX_HTTP_URL!
    const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY!
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

    if (!HETZNER_TOKEN) console.error(`${TAG} provisionComputer — WARNING: HETZNER_API_TOKEN is not set`)
    if (!CONVEX_HTTP_URL) console.error(`${TAG} provisionComputer — WARNING: CONVEX_HTTP_URL is not set`)
    if (!AI_GATEWAY_API_KEY) console.error(`${TAG} provisionComputer — WARNING: AI_GATEWAY_API_KEY is not set`)
    if (!AI_GATEWAY_API_KEY) throw new Error('AI_GATEWAY_API_KEY is not configured')

    const location = 'ash'
    console.log(`${TAG} provisionComputer — using Hetzner location=${location} for region=${computer.region}`)

    const userdata = buildCloudInit({
      gatewayToken: computer.gatewayToken!,
      hooksToken: deriveHooksToken(computer.gatewayToken!),
      readySecret: computer.readySecret!,
      computerId: computerId,
      convexHttpUrl: CONVEX_HTTP_URL,
      aiGatewayApiKey: AI_GATEWAY_API_KEY,
      openrouterApiKey: OPENROUTER_API_KEY,
    })
    console.log(`${TAG} provisionComputer — cloud-init built (${userdata.length} chars)`)

    try {
      await ctx.runMutation(internal.computers.setProvisioningStep, { computerId, step: 'creating_server' })

      // ── Step 1: Create firewall first so we can attach it at server creation ─
      console.log(`${TAG} provisionComputer — calling Hetzner POST /v1/firewalls (ports 22, 18789)`)
      const fwRes = await retryFetch(
        'https://api.hetzner.cloud/v1/firewalls',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${HETZNER_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `overlay-fw-${computerId}`.slice(0, 63),
            rules: [
              { direction: 'in', protocol: 'tcp', port: '22',    source_ips: ['0.0.0.0/0', '::/0'] },
              { direction: 'in', protocol: 'tcp', port: '18789', source_ips: ['0.0.0.0/0', '::/0'] },
            ],
          }),
        }
      )
      const fwData = await fwRes.json()
      const firewallId: number = fwData.firewall.id
      console.log(`${TAG} provisionComputer — firewall created`)

      // ── Step 2: Create server with firewall attached at creation time ────────
      console.log(`${TAG} provisionComputer — calling Hetzner POST /v1/servers (type=cpx21 location=${location})`)
      const serverRes = await retryFetch(
        'https://api.hetzner.cloud/v1/servers',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${HETZNER_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `overlay-computer-${computerId}`.slice(0, 63),
            server_type: 'cpx21',
            image: 'ubuntu-24.04',
            location,
            user_data: userdata,
            firewalls: [{ firewall: firewallId }],
            ssh_keys: process.env.HETZNER_SSH_KEY_ID
              ? [parseInt(process.env.HETZNER_SSH_KEY_ID)]
              : [],
          }),
        }
      )
      const serverData = await serverRes.json()
      const serverId: number = serverData.server.id
      const serverIp: string = serverData.server.public_net.ipv4.ip
      console.log(`${TAG} provisionComputer — Hetzner server created ip=${redactIpForLog(serverIp)}`)

      await ctx.runMutation(internal.computers.setProvisioningInfo, {
        computerId,
        hetznerServerId: serverId,
        hetznerServerIp: serverIp,
        hetznerFirewallId: firewallId,
      })
      await ctx.runMutation(internal.computers.setProvisioningStep, { computerId, step: 'server_created' })
      await ctx.runMutation(internal.computers.setProvisioningStep, { computerId, step: 'openclaw_starting' })
      await ctx.runMutation(internal.computers.logEvent, {
        computerId, type: 'provisioning_log',
        message: `Server created at ${serverIp}. Waiting for OpenClaw to start...`,
      })

      // ── Step 5: Schedule polling fallback ─────────────────────────────────
      console.log(`${TAG} provisionComputer — scheduling pollStatus fallback in 12 min`)
      await ctx.scheduler.runAfter(
        12 * 60 * 1000,
        internal.computers.pollStatus,
        { computerId, attempt: 0 }
      )

      console.log(
        `${TAG} provisionComputer — COMPLETE computerId=${redactIdentifierForLog(computerId)} waiting for VPS callback or poll fallback`
      )

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(
        `${TAG} provisionComputer — ERROR computerId=${redactIdentifierForLog(computerId)} message=${summarizeTextForLog(message)}`
      )
      await ctx.runMutation(internal.computers.setError, { computerId, message })
      await ctx.runMutation(internal.computers.logEvent, {
        computerId, type: 'error', message: `Provisioning failed: ${message}`,
      })
    }
  },
})

export const pollStatus = internalAction({
  args: {
    computerId: v.id('computers'),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, { computerId, attempt = 0 }) => {
    console.log(
      `${TAG} pollStatus — computerId=${redactIdentifierForLog(computerId)} attempt=${attempt}`
    )

    const computer = await ctx.runQuery(internal.computers.getInternal, { computerId })
    if (!computer || computer.status !== 'provisioning') {
      console.log(`${TAG} pollStatus — SKIP: status=${computer?.status ?? 'not found'} (already resolved or missing)`)
      return
    }

    const HETZNER_TOKEN = process.env.HETZNER_API_TOKEN!

    try {
      console.log(`${TAG} pollStatus — checking Hetzner server status`)
      const res = await retryFetch(
        `https://api.hetzner.cloud/v1/servers/${computer.hetznerServerId}`,
        { headers: { Authorization: `Bearer ${HETZNER_TOKEN}` } }
      )
      const data = await res.json()
      const serverStatus = data.server?.status
      console.log(`${TAG} pollStatus — Hetzner server status=${serverStatus}`)

      if (serverStatus === 'running') {
        console.log(
          `${TAG} pollStatus — probing OpenClaw health at ${redactIpForLog(computer.hetznerServerIp)}`
        )
        try {
          const healthRes = await fetch(`http://${computer.hetznerServerIp}:18789/healthz`, {
            signal: AbortSignal.timeout(5000),
            headers: { Authorization: `Bearer ${computer.gatewayToken}` },
          })
          console.log(`${TAG} pollStatus — health probe responded: status=${healthRes.status}`)
          if (healthRes.ok) {
            console.log(`${TAG} pollStatus — OpenClaw is healthy! Setting status=ready`)
            await ctx.runMutation(internal.computers.setReady, {
              computerId,
              readySecret: computer.readySecret!,
            })
            await ctx.runMutation(internal.computers.logEvent, {
              computerId, type: 'status_change',
              message: 'OpenClaw ready (detected by polling fallback)',
            })
            return
          }
        } catch (healthErr) {
          console.log(
            `${TAG} pollStatus — health probe failed (not ready yet): ${summarizeErrorForLog(healthErr)}`
          )
        }
      }
    } catch (apiErr) {
      console.error(`${TAG} pollStatus — Hetzner API error: ${summarizeErrorForLog(apiErr)}`)
    }

    if (attempt >= 15) {
      console.error(`${TAG} pollStatus — TIMEOUT after attempt ${attempt}, setting status=error`)
      await ctx.runMutation(internal.computers.setError, {
        computerId,
        message: 'Provisioning timed out after ~45 minutes. Please delete and recreate.',
      })
      return
    }

    console.log(`${TAG} pollStatus — rescheduling attempt ${attempt + 1} in 3 min`)
    await ctx.scheduler.runAfter(
      3 * 60 * 1000,
      internal.computers.pollStatus,
      { computerId, attempt: attempt + 1 }
    )
  },
})

export const teardownComputer = internalAction({
  args: { computerId: v.id('computers') },
  handler: async (ctx, { computerId }) => {
    console.log(`${TAG} teardownComputer — START computerId=${redactIdentifierForLog(computerId)}`)

    const computer = await ctx.runQuery(internal.computers.getInternal, { computerId })
    if (!computer || computer.status === 'deleted') {
      console.log(`${TAG} teardownComputer — SKIP: already deleted or not found`)
      return
    }
    console.log(`${TAG} teardownComputer — current status=${computer.status}`)
    await ctx.runMutation(internal.computers.markDeleted, { computerId })
    await ctx.runMutation(internal.computers.logEvent, {
      computerId, type: 'status_change',
      message: 'Computer teardown queued.',
    })
    await ctx.scheduler.runAfter(1000, internal.computers.deleteComputerResources, {
      computerId,
      attempt: 0,
    })
    console.log(`${TAG} teardownComputer — queued background cleanup`)
  },
})

export const deleteComputerInstance = action({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.string(),
  },
  handler: async (ctx, { computerId, userId, accessToken }) => {
    console.log(
      `${TAG} deleteComputerInstance — START computerId=${redactIdentifierForLog(computerId)}`
    )

    await requireAccessToken(accessToken, userId)

    const computer = await ctx.runQuery(internal.computers.getInternal, { computerId })
    if (!computer || computer.userId !== userId) {
      throw new Error('Computer not found')
    }

    if (computer.stripeSubscriptionId) {
      console.log(`${TAG} deleteComputerInstance — canceling Stripe subscription`)
      try {
        await stripeClient.cancelSubscription(ctx, {
          stripeSubscriptionId: computer.stripeSubscriptionId,
          cancelAtPeriodEnd: false,
        })
        console.log(`${TAG} deleteComputerInstance — Stripe subscription canceled`)
      } catch (err) {
        console.warn(
          `${TAG} deleteComputerInstance — Stripe cancel failed: ${summarizeErrorForLog(err)}`
        )
      }
    } else {
      console.log(`${TAG} deleteComputerInstance — no stripeSubscriptionId, skipping Stripe cancel`)
    }

    await ctx.runMutation(internal.computers.markDeleted, { computerId })
    await ctx.scheduler.runAfter(
      1000,
      internal.computers.deleteComputerResources,
      { computerId, attempt: 0 }
    )

    console.log(
      `${TAG} deleteComputerInstance — queued background cleanup computerId=${redactIdentifierForLog(computerId)}`
    )
    return { queued: true }
  },
})

export const deleteComputerResources = internalAction({
  args: {
    computerId: v.id('computers'),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, { computerId, attempt = 0 }) => {
    console.log(
      `${TAG} deleteComputerResources — START computerId=${redactIdentifierForLog(computerId)} attempt=${attempt}`
    )

    const computer = await ctx.runQuery(internal.computers.getInternal, { computerId })
    if (!computer) {
      console.log(`${TAG} deleteComputerResources — SKIP: computer not found`)
      return
    }

    const HETZNER_TOKEN = process.env.HETZNER_API_TOKEN!
    if (!HETZNER_TOKEN) {
      throw new Error('HETZNER_API_TOKEN not configured')
    }

    if (computer.stripeSubscriptionId) {
      console.log(`${TAG} deleteComputerResources — canceling Stripe subscription`)
      try {
        await stripeClient.cancelSubscription(ctx, {
          stripeSubscriptionId: computer.stripeSubscriptionId,
          cancelAtPeriodEnd: false,
        })
        console.log(`${TAG} deleteComputerResources — Stripe subscription canceled`)
      } catch (err) {
        console.warn(
          `${TAG} deleteComputerResources — Stripe cancel failed: ${summarizeErrorForLog(err)}`
        )
      }
    } else {
      console.log(`${TAG} deleteComputerResources — no stripeSubscriptionId, skipping Stripe cancel`)
    }

    let serverDeleted = true
    if (computer.hetznerServerId) {
      serverDeleted = await ensureServerDeleted(computer.hetznerServerId, HETZNER_TOKEN)
    } else {
      console.log(`${TAG} deleteComputerResources — no hetznerServerId, skipping server deletion`)
    }

    if (!serverDeleted) {
      await ctx.runMutation(internal.computers.logEvent, {
        computerId,
        type: 'status_change',
        message: 'Waiting for Hetzner server deletion to finish before removing firewall...',
      })
      await ctx.scheduler.runAfter(30 * 1000, internal.computers.deleteComputerResources, {
        computerId,
        attempt: attempt + 1,
      })
      console.log(`${TAG} deleteComputerResources — server still deleting, rescheduled`)
      return
    }

    let firewallDeleted = true
    if (computer.hetznerFirewallId) {
      firewallDeleted = await ensureFirewallDeleted(computer.hetznerFirewallId, HETZNER_TOKEN)
    } else {
      console.log(`${TAG} deleteComputerResources — no hetznerFirewallId, skipping firewall deletion`)
    }

    if (!firewallDeleted) {
      await ctx.runMutation(internal.computers.logEvent, {
        computerId,
        type: 'status_change',
        message: 'Waiting for Hetzner firewall to detach before final cleanup...',
      })
      await ctx.scheduler.runAfter(30 * 1000, internal.computers.deleteComputerResources, {
        computerId,
        attempt: attempt + 1,
      })
      console.log(`${TAG} deleteComputerResources — firewall still in use, rescheduled`)
      return
    }

    await ctx.runMutation(internal.computers.deleteComputer, { computerId })
    console.log(
      `${TAG} deleteComputerResources — COMPLETE computerId=${redactIdentifierForLog(computerId)}`
    )
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS (module-local)
// ─────────────────────────────────────────────────────────────────────────────

interface RetryOptions {
  ignore404?: boolean
}

async function retryFetch(
  url: string,
  init: RequestInit,
  opts: RetryOptions = {},
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < maxAttempts; i++) {
    try {
      console.log(
        `${TAG} retryFetch — attempt ${i + 1}/${maxAttempts} ${init.method ?? 'GET'} ${summarizeUrlForLog(url)}`
      )
      const res = await fetch(url, init)
      if (opts.ignore404 && res.status === 404) {
        console.log(`${TAG} retryFetch — 404 ignored for ${summarizeUrlForLog(url)}`)
        return res
      }
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} from ${summarizeUrlForLog(url)}`)
        console.warn(`${TAG} retryFetch — ${res.status} error, retrying in ${baseDelayMs * 2 ** i}ms`)
        await sleep(baseDelayMs * 2 ** i)
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${summarizeUrlForLog(url)}`)
      console.log(`${TAG} retryFetch — OK ${res.status} ${summarizeUrlForLog(url)}`)
      return res
    } catch (err) {
      lastErr = err
      console.error(
        `${TAG} retryFetch — attempt ${i + 1} threw: ${summarizeErrorForLog(err)}`
      )
      if (i < maxAttempts - 1) await sleep(baseDelayMs * 2 ** i)
    }
  }
  throw lastErr
}

async function ensureServerDeleted(serverId: number, token: string): Promise<boolean> {
  console.log(`${TAG} ensureServerDeleted — requesting deletion for server=${redactIdentifierForLog(serverId)}`)
  await retryFetch(
    `https://api.hetzner.cloud/v1/servers/${serverId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    { ignore404: true }
  )

  for (let i = 0; i < 12; i++) {
    const res = await fetch(`https://api.hetzner.cloud/v1/servers/${serverId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 404) {
      console.log(`${TAG} ensureServerDeleted — server confirmed deleted`)
      return true
    }
    if (!res.ok) {
      throw new Error(`Failed to check server deletion: HTTP ${res.status}`)
    }
    await sleep(5000)
  }

  console.log(`${TAG} ensureServerDeleted — server still exists after wait window`)
  return false
}

async function ensureFirewallDeleted(firewallId: number, token: string): Promise<boolean> {
  console.log(
    `${TAG} ensureFirewallDeleted — requesting deletion for firewall=${redactIdentifierForLog(firewallId)}`
  )

  for (let i = 0; i < 12; i++) {
    const res = await fetch(`https://api.hetzner.cloud/v1/firewalls/${firewallId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.status === 404) {
      console.log(`${TAG} ensureFirewallDeleted — firewall already deleted`)
      return true
    }

    if (res.ok) {
      console.log(`${TAG} ensureFirewallDeleted — firewall deleted`)
      return true
    }

    if (res.status === 409) {
      console.log(`${TAG} ensureFirewallDeleted — firewall still in use, waiting`)
      await sleep(5000)
      continue
    }

    if (res.status === 429 || res.status >= 500) {
      console.log(`${TAG} ensureFirewallDeleted — firewall temporary error HTTP ${res.status}, waiting`)
      await sleep(5000)
      continue
    }

    throw new Error(`Failed to delete firewall: HTTP ${res.status}`)
  }

  console.log(`${TAG} ensureFirewallDeleted — firewall still in use after wait window`)
  return false
}

function getComputerSessionKey(userId: string, computerId: string): string {
  return `hook:computer:v1:${userId}:${computerId}`
}

function resolveOpenClawModelRef(modelId: string): string | null {
  const model = getModel(modelId)
  return model?.openClawRef ?? null
}

function getComputerModelCandidates(selectedModelId: string): Array<{ id: string; ref: string }> {
  const candidates = [selectedModelId, DEFAULT_MODEL_ID, 'openrouter/free']
  const seen = new Set<string>()
  const resolved: Array<{ id: string; ref: string }> = []

  for (const candidateId of candidates) {
    const ref = resolveOpenClawModelRef(candidateId)
    if (!ref || seen.has(ref)) {
      continue
    }
    seen.add(ref)
    resolved.push({ id: candidateId, ref })
  }

  return resolved
}

function buildComputerChatFailureMessage(selectedModelId: string, failures: string[]): string {
  const detail = failures.length > 0 ? failures.join(' | ') : 'no fallback details'
  return `OpenClaw could not reply to this request using the selected model "${selectedModelId}". Retried the configured fallback models, but all attempts failed. Details: ${detail}`
}

function deriveHooksToken(gatewayToken: string): string {
  return `hooks_${gatewayToken}`
}

function buildComputerModelsAllowlistJson(): string {
  const entries = Object.fromEntries(
    AVAILABLE_MODELS.map((model) => {
      return [model.openClawRef, { alias: model.name }]
    })
  )

  return JSON.stringify(entries)
}

async function applySessionModelOverride(params: {
  ip: string
  gatewayToken: string
  sessionKey: string
  model: string
}) {
  const response = await fetch(`http://${params.ip}:18789/tools/invoke`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.gatewayToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tool: 'session_status',
      sessionKey: params.sessionKey,
      args: {
        sessionKey: params.sessionKey,
        model: params.model,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    throw new Error(`Failed to apply computer model override: HTTP ${response.status}`)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractGatewayUsage(data: unknown): {
  promptTokens: number
  cachedTokens: number
  completionTokens: number
} {
  const DEFAULT = { promptTokens: 0, cachedTokens: 0, completionTokens: 0 }
  if (!data || typeof data !== 'object') return DEFAULT
  const usageRaw = (data as Record<string, unknown>).usage
  if (!usageRaw || typeof usageRaw !== 'object') return DEFAULT
  const usage = usageRaw as Record<string, unknown>
  const promptTokens = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0
  const completionTokens = typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0
  let cachedTokens = 0
  const details = usage.prompt_tokens_details
  if (details && typeof details === 'object') {
    const d = details as Record<string, unknown>
    if (typeof d.cached_tokens === 'number') cachedTokens = d.cached_tokens
  }
  return { promptTokens, cachedTokens, completionTokens }
}

function extractAssistantContent(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return ''
  }

  const choices = (data as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) {
    return ''
  }

  const firstChoice = choices[0]
  if (!firstChoice || typeof firstChoice !== 'object') {
    return ''
  }

  const message = (firstChoice as { message?: unknown }).message
  if (!message || typeof message !== 'object') {
    return ''
  }

  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') {
    return content.trim()
  }

  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') {
        return ''
      }
      const text = (part as { text?: unknown }).text
      return typeof text === 'string' ? text : ''
    })
    .join('')
    .trim()
}

interface CloudInitParams {
  gatewayToken: string
  hooksToken: string
  readySecret: string
  computerId: string
  convexHttpUrl: string
  aiGatewayApiKey: string
  openrouterApiKey?: string
}

function buildCloudInit(p: CloudInitParams): string {
  return CLOUD_INIT_TEMPLATE
    .replaceAll('{{GATEWAY_TOKEN}}',    p.gatewayToken)
    .replaceAll('{{HOOKS_TOKEN}}',      p.hooksToken)
    .replaceAll('{{READY_SECRET}}',     p.readySecret)
    .replaceAll('{{COMPUTER_ID}}',      p.computerId)
    .replaceAll('{{CONVEX_HTTP_URL}}',  p.convexHttpUrl)
    .replaceAll('{{AI_GATEWAY_API_KEY}}', p.aiGatewayApiKey)
    .replaceAll('{{OPENROUTER_API_KEY}}', p.openrouterApiKey ?? '')
    .replaceAll('{{MODEL_ALLOWLIST_JSON}}', buildComputerModelsAllowlistJson())
}

const CLOUD_INIT_TEMPLATE = `#cloud-config
package_update: true
packages:
  - curl
  - ca-certificates
  - python3

write_files:
  - path: /root/openclaw-deploy/.env
    permissions: '0600'
    content: |
      AI_GATEWAY_API_KEY={{AI_GATEWAY_API_KEY}}
      OPENROUTER_API_KEY={{OPENROUTER_API_KEY}}
      OPENCLAW_GATEWAY_TOKEN={{GATEWAY_TOKEN}}
      OPENCLAW_HOOKS_TOKEN={{HOOKS_TOKEN}}

  - path: /root/openclaw-deploy/docker-compose.yml
    permissions: '0644'
    content: |
      services:
        openclaw-gateway:
          image: ghcr.io/openclaw/openclaw:main
          restart: unless-stopped
          env_file: /root/openclaw-deploy/.env
          environment:
            - HOME=/home/node
            - NODE_ENV=production
            - TERM=xterm-256color
            - AI_GATEWAY_API_KEY=\${AI_GATEWAY_API_KEY}
            - OPENROUTER_API_KEY=\${OPENROUTER_API_KEY}
            - OPENCLAW_SKIP_CHANNELS=1
            - OPENCLAW_SKIP_CRON=1
            - OPENCLAW_SKIP_GMAIL_WATCHER=1
            - OPENCLAW_SKIP_CANVAS_HOST=1
            - PATH=/home/linuxbrew/.linuxbrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
          volumes:
            - /root/.openclaw:/home/node/.openclaw
            - /root/.openclaw/workspace:/home/node/.openclaw/workspace
          ports:
            - "0.0.0.0:18789:18789"
          command:
            ["openclaw", "gateway", "run"]

  - path: /usr/local/bin/openclaw
    permissions: '0755'
    content: |
      #!/usr/bin/env bash
      set -euo pipefail
      cd /root/openclaw-deploy
      if [ -t 0 ] && [ -t 1 ]; then
        exec docker compose exec openclaw-gateway openclaw "$@"
      fi
      exec docker compose exec -T openclaw-gateway openclaw "$@"

  - path: /root/provision.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      set -eo pipefail
      COMPUTER_ID="{{COMPUTER_ID}}"
      READY_SECRET="{{READY_SECRET}}"
      CONVEX_URL="{{CONVEX_HTTP_URL}}"

      # Redirect all output to log file so the UI can stream it
      exec > /root/provision.log 2>&1

      # Background: ship new log lines to Convex every 8s
      (
        last_line=0
        while true; do
          sleep 8
          current_line=$(wc -l < /root/provision.log 2>/dev/null || echo 0)
          if [ "$current_line" -gt "$last_line" ]; then
            chunk=$(sed -n "$((last_line+1)),$current_line p" /root/provision.log | head -50)
            if [ -n "$chunk" ]; then
              escaped=$(python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" <<< "$chunk" 2>/dev/null || true)
              if [ -n "$escaped" ]; then
                curl -sf -X POST "$CONVEX_URL/computer/log" \\
                  -H "Content-Type: application/json" \\
                  -d "{\\"computerId\\":\\"$COMPUTER_ID\\",\\"readySecret\\":\\"$READY_SECRET\\",\\"message\\":$escaped}" > /dev/null 2>&1 || true
              fi
            fi
            last_line=$current_line
          fi
        done
      ) > /dev/null 2>&1 &

      clog() {
        curl -sf -X POST "$CONVEX_URL/computer/log" \\
          -H "Content-Type: application/json" \\
          -d "{\\"computerId\\":\\"$COMPUTER_ID\\",\\"readySecret\\":\\"$READY_SECRET\\",\\"message\\":\\"$1\\"}" > /dev/null 2>&1 || true
      }

      docker_openclaw() {
        docker run --rm \\
          --env-file /root/openclaw-deploy/.env \\
          -e HOME=/home/node \\
          -e NODE_ENV=production \\
          -e TERM=xterm-256color \\
          -e OPENCLAW_SKIP_CHANNELS=1 \\
          -e OPENCLAW_SKIP_CRON=1 \\
          -e OPENCLAW_SKIP_GMAIL_WATCHER=1 \\
          -e OPENCLAW_SKIP_CANVAS_HOST=1 \\
          -v /root/.openclaw:/home/node/.openclaw \\
          ghcr.io/openclaw/openclaw:main \\
          "$@"
      }

      clog "VPS setup started"

      # Step 1: Install Docker CE
      curl -fsSL https://get.docker.com | sh
      systemctl enable --now docker
      clog "Docker CE installed and daemon started"

      # Step 2: Prepare directories
      mkdir -p /root/.openclaw/workspace
      chown -R 1000:1000 /root/.openclaw
      clog "Installed host openclaw wrapper"

      # Step 3: Pull the prebuilt OpenClaw image and configure it through the CLI
      clog "Pulling prebuilt OpenClaw image..."
      cd /root/openclaw-deploy
      set -a
      . /root/openclaw-deploy/.env
      set +a
      docker compose pull
      clog "OpenClaw image pulled. Running CLI onboarding..."

      docker_openclaw openclaw onboard --non-interactive \\
        --accept-risk \\
        --mode local \\
        --auth-choice ai-gateway-api-key \\
        --secret-input-mode ref \\
        --gateway-port 18789 \\
        --gateway-bind lan \\
        --gateway-auth token \\
        --gateway-token-ref-env OPENCLAW_GATEWAY_TOKEN \\
        --skip-channels \\
        --skip-skills \\
        --skip-daemon \\
        --skip-health

      clog "OpenClaw onboarding complete. Applying computer config..."

      docker_openclaw openclaw config set agents.defaults.models '{{MODEL_ALLOWLIST_JSON}}' --strict-json
      docker_openclaw openclaw models set vercel-ai-gateway/anthropic/claude-sonnet-4.6

      docker_openclaw openclaw config set gateway.http.endpoints.chatCompletions.enabled true --strict-json
      docker_openclaw openclaw config set gateway.controlUi.enabled true --strict-json
      docker_openclaw openclaw config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true --strict-json
      docker_openclaw openclaw config set hooks.enabled true --strict-json
      docker_openclaw openclaw config set hooks.path /hooks
      docker_openclaw openclaw config set hooks.token "$OPENCLAW_HOOKS_TOKEN"
      docker_openclaw openclaw config set hooks.defaultSessionKey hook:computer:default
      docker_openclaw openclaw config set hooks.allowRequestSessionKey true --strict-json
      docker_openclaw openclaw config set hooks.allowedSessionKeyPrefixes '["hook:computer:"]' --strict-json
      docker_openclaw openclaw config set hooks.allowedAgentIds '["default"]' --strict-json
      docker_openclaw openclaw config set cron.enabled false --strict-json
      docker_openclaw openclaw config validate

      clog "OpenClaw config validated. Starting container..."

      docker compose up -d
      clog "Docker container started. Waiting for healthz..."

      # Step 4: Wait for OpenClaw to be healthy (90 x 5s = 7.5 min)
      for i in $(seq 1 90); do
        if curl -sf --max-time 5 http://localhost:18789/healthz > /dev/null 2>&1; then
          curl -s -X POST "$CONVEX_URL/computer/ready" \\
            -H "Content-Type: application/json" \\
            -d "{\\"computerId\\":\\"$COMPUTER_ID\\",\\"readySecret\\":\\"{{READY_SECRET}}\\"}"
          exit 0
        fi
        if (( i % 6 == 0 )); then
          clog "Health check $i/90 - not ready yet"
        fi
        sleep 5
      done

      clog "Health check timed out. Dumping docker diagnostics..."
      docker compose ps || true
      docker compose logs --tail 200 || true
      clog "Health check timed out after bootstrap."

runcmd:
  - /root/provision.sh
`
