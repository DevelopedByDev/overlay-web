import { v } from 'convex/values'
import {
  action, mutation, query, internalMutation, internalQuery, internalAction
} from './_generated/server'
import { internal, components } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'
import { validateAccessToken } from './lib/auth'

const TAG = '[Computer]'
const stripeClient = new StripeSubscriptions(components.stripe, {})

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
    console.log(`${TAG} create — userId=${args.userId} name="${args.name}" region=${args.region}`)
    if (!validateAccessToken(args.accessToken)) {
      console.error(`${TAG} create — REJECTED: invalid accessToken for userId=${args.userId}`)
      throw new Error('Unauthorized')
    }
    const gatewayToken =
      crypto.randomUUID().replace(/-/g, '') +
      crypto.randomUUID().replace(/-/g, '')
    const readySecret = crypto.randomUUID().replace(/-/g, '')
    const id = await ctx.db.insert('computers', {
      userId: args.userId,
      name: args.name,
      setupType: 'managed',
      region: args.region,
      status: 'pending_payment',
      gatewayToken,
      readySecret,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    console.log(`${TAG} create — SUCCESS: computerId=${id} status=pending_payment`)
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
    console.log(`${TAG} setStripeInfo — computerId=${args.computerId} subId=${args.stripeSubscriptionId} customerId=${args.stripeCustomerId}`)
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
    console.log(`${TAG} setProvisioningInfo — computerId=${args.computerId} serverId=${args.hetznerServerId} ip=${args.hetznerServerIp} firewallId=${args.hetznerFirewallId}`)
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
    console.log(`${TAG} setProvisioningStep — computerId=${args.computerId} step=${args.step}`)
    await ctx.db.patch(args.computerId, {
      provisioningStep: args.step,
      updatedAt: Date.now(),
    })
  },
})

export const setReady = internalMutation({
  args: { computerId: v.id('computers'), readySecret: v.string() },
  handler: async (ctx, args) => {
    console.log(`${TAG} setReady — computerId=${args.computerId}`)
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
      console.error(`${TAG} setReady — FAILED: invalid readySecret for computerId=${args.computerId}`)
      throw new Error('Invalid readySecret')
    }
    await ctx.db.patch(args.computerId, {
      status: 'ready',
      readySecret: undefined,
      provisioningStep: undefined,
      updatedAt: Date.now(),
    })
    console.log(`${TAG} setReady — SUCCESS: computerId=${args.computerId} status=ready readySecret cleared`)
  },
})

export const setError = internalMutation({
  args: { computerId: v.id('computers'), message: v.string() },
  handler: async (ctx, args) => {
    console.error(`${TAG} setError — computerId=${args.computerId} message="${args.message}"`)
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
    console.warn(`${TAG} setPastDue — computerId=${args.computerId} teardown scheduled in 7 days`)
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
    console.log(`${TAG} markDeleted — computerId=${args.computerId}`)
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
    console.log(`${TAG} event [${args.type}] computerId=${args.computerId} — ${args.message}`)
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
    accessToken: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validateAccessToken(args.accessToken)) return null
    const computer = await ctx.db.get(args.computerId)
    if (!computer || computer.userId !== args.userId) return null
    return { ...computer, gatewayToken: undefined, readySecret: undefined }
  },
})

export const list = query({
  args: { userId: v.string(), accessToken: v.string() },
  handler: async (ctx, args) => {
    if (!validateAccessToken(args.accessToken)) return []
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
    if (!validateAccessToken(args.accessToken)) return []
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
    if (!validateAccessToken(args.accessToken)) return []
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

export const sendChatMessage = action({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`${TAG} sendChatMessage — START computerId=${args.computerId} userId=${args.userId}`)

    if (!validateAccessToken(args.accessToken)) {
      throw new Error('Unauthorized')
    }

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

    await ctx.runMutation(internal.computers.logEvent, {
      computerId: args.computerId,
      type: 'chat_user',
      message,
    })

    try {
      const response = await fetch(
        `http://${computer.hetznerServerIp}:18789/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${computer.gatewayToken}`,
            'Content-Type': 'application/json',
            'x-openclaw-agent-id': 'default',
          },
          body: JSON.stringify({
            model: 'openclaw:default',
            user: `overlay:${args.userId}:computer:${args.computerId}`,
            stream: false,
            messages: [
              {
                role: 'user',
                content: message,
              },
            ],
          }),
          signal: AbortSignal.timeout(120_000),
        },
      )

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            'This computer was provisioned before Overlay chat support. Delete and recreate it to enable in-page OpenClaw chat.'
          )
        }

        if (response.status === 401) {
          throw new Error('OpenClaw gateway authentication failed.')
        }

        throw new Error(`Gateway returned ${response.status}: ${await response.text()}`)
      }

      const data = await response.json()
      const content = extractAssistantContent(data)

      if (!content) {
        throw new Error(`Gateway returned an empty response: ${JSON.stringify(data)}`)
      }

      await ctx.runMutation(internal.computers.logEvent, {
        computerId: args.computerId,
        type: 'chat_assistant',
        message: content,
      })

      console.log(`${TAG} sendChatMessage — SUCCESS computerId=${args.computerId}`)
      return { content }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to reach OpenClaw'

      await ctx.runMutation(internal.computers.logEvent, {
        computerId: args.computerId,
        type: 'chat_error',
        message: `Error: ${message}`,
      })

      console.error(`${TAG} sendChatMessage — ERROR: ${message}`)
      throw new Error(message)
    }
  },
})

export const deleteComputer = internalMutation({
  args: { computerId: v.id('computers') },
  handler: async (ctx, { computerId }) => {
    console.warn(`${TAG} deleteComputer — START computerId=${computerId}`)
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
    console.warn(`${TAG} deleteComputer — DONE computerId=${computerId} eventsDeleted=${events.length}`)
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
    console.log(`${TAG} provisionComputer — START computerId=${computerId}`)

    const computer = await ctx.runQuery(internal.computers.getInternal, { computerId })
    if (!computer) {
      console.error(`${TAG} provisionComputer — ABORT: computer not found`)
      throw new Error(`Computer ${computerId} not found`)
    }
    console.log(`${TAG} provisionComputer — loaded computer name="${computer.name}" region=${computer.region} status=${computer.status}`)

    const HETZNER_TOKEN = process.env.HETZNER_API_TOKEN!
    const CONVEX_HTTP_URL = process.env.CONVEX_HTTP_URL!
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!

    if (!HETZNER_TOKEN) console.error(`${TAG} provisionComputer — WARNING: HETZNER_API_TOKEN is not set`)
    if (!CONVEX_HTTP_URL) console.error(`${TAG} provisionComputer — WARNING: CONVEX_HTTP_URL is not set`)
    if (!OPENROUTER_API_KEY) console.error(`${TAG} provisionComputer — WARNING: OPENROUTER_API_KEY is not set`)
    if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not configured')

    const location = 'ash'
    console.log(`${TAG} provisionComputer — using Hetzner location=${location} for region=${computer.region}`)

    const userdata = buildCloudInit({
      gatewayToken: computer.gatewayToken!,
      readySecret: computer.readySecret!,
      computerId: computerId,
      convexHttpUrl: CONVEX_HTTP_URL,
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
      console.log(`${TAG} provisionComputer — firewall created: firewallId=${firewallId}`)

      // ── Step 2: Create server with firewall attached at creation time ────────
      console.log(`${TAG} provisionComputer — calling Hetzner POST /v1/servers (type=cpx21 location=${location} firewall=${firewallId})`)
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
      console.log(`${TAG} provisionComputer — Hetzner server created: serverId=${serverId} ip=${serverIp}`)

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

      console.log(`${TAG} provisionComputer — COMPLETE: server=${serverIp} waiting for VPS callback or poll fallback`)

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`${TAG} provisionComputer — ERROR: ${message}`)
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
    console.log(`${TAG} pollStatus — computerId=${computerId} attempt=${attempt}`)

    const computer = await ctx.runQuery(internal.computers.getInternal, { computerId })
    if (!computer || computer.status !== 'provisioning') {
      console.log(`${TAG} pollStatus — SKIP: status=${computer?.status ?? 'not found'} (already resolved or missing)`)
      return
    }

    const HETZNER_TOKEN = process.env.HETZNER_API_TOKEN!

    try {
      console.log(`${TAG} pollStatus — checking Hetzner server ${computer.hetznerServerId} status`)
      const res = await retryFetch(
        `https://api.hetzner.cloud/v1/servers/${computer.hetznerServerId}`,
        { headers: { Authorization: `Bearer ${HETZNER_TOKEN}` } }
      )
      const data = await res.json()
      const serverStatus = data.server?.status
      console.log(`${TAG} pollStatus — Hetzner server status=${serverStatus}`)

      if (serverStatus === 'running') {
        console.log(`${TAG} pollStatus — probing OpenClaw health at http://${computer.hetznerServerIp}:18789/healthz`)
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
          console.log(`${TAG} pollStatus — health probe failed (not ready yet): ${healthErr instanceof Error ? healthErr.message : healthErr}`)
        }
      }
    } catch (apiErr) {
      console.error(`${TAG} pollStatus — Hetzner API error: ${apiErr instanceof Error ? apiErr.message : apiErr}`)
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
    console.log(`${TAG} teardownComputer — START computerId=${computerId}`)

    const computer = await ctx.runQuery(internal.computers.getInternal, { computerId })
    if (!computer || computer.status === 'deleted') {
      console.log(`${TAG} teardownComputer — SKIP: already deleted or not found`)
      return
    }
    console.log(`${TAG} teardownComputer — current status=${computer.status} serverId=${computer.hetznerServerId} firewallId=${computer.hetznerFirewallId}`)
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
    console.log(`${TAG} deleteComputerInstance — START computerId=${computerId} userId=${userId}`)

    if (!validateAccessToken(accessToken)) {
      throw new Error('Unauthorized')
    }

    const computer = await ctx.runQuery(internal.computers.getInternal, { computerId })
    if (!computer || computer.userId !== userId) {
      throw new Error('Computer not found')
    }

    if (computer.stripeSubscriptionId) {
      console.log(`${TAG} deleteComputerInstance — canceling Stripe subscription ${computer.stripeSubscriptionId}`)
      try {
        await stripeClient.cancelSubscription(ctx, {
          stripeSubscriptionId: computer.stripeSubscriptionId,
          cancelAtPeriodEnd: false,
        })
        console.log(`${TAG} deleteComputerInstance — Stripe subscription canceled ${computer.stripeSubscriptionId}`)
      } catch (err) {
        console.warn(`${TAG} deleteComputerInstance — Stripe cancel failed for ${computer.stripeSubscriptionId}: ${err instanceof Error ? err.message : err}`)
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

    console.log(`${TAG} deleteComputerInstance — queued background cleanup computerId=${computerId}`)
    return { queued: true }
  },
})

export const deleteComputerResources = internalAction({
  args: {
    computerId: v.id('computers'),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, { computerId, attempt = 0 }) => {
    console.log(`${TAG} deleteComputerResources — START computerId=${computerId} attempt=${attempt}`)

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
      console.log(`${TAG} deleteComputerResources — canceling Stripe subscription ${computer.stripeSubscriptionId}`)
      try {
        await stripeClient.cancelSubscription(ctx, {
          stripeSubscriptionId: computer.stripeSubscriptionId,
          cancelAtPeriodEnd: false,
        })
        console.log(`${TAG} deleteComputerResources — Stripe subscription canceled ${computer.stripeSubscriptionId}`)
      } catch (err) {
        console.warn(`${TAG} deleteComputerResources — Stripe cancel failed for ${computer.stripeSubscriptionId}: ${err instanceof Error ? err.message : err}`)
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
    console.log(`${TAG} deleteComputerResources — COMPLETE computerId=${computerId}`)
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
      console.log(`${TAG} retryFetch — attempt ${i + 1}/${maxAttempts} ${init.method ?? 'GET'} ${url}`)
      const res = await fetch(url, init)
      if (opts.ignore404 && res.status === 404) {
        console.log(`${TAG} retryFetch — 404 ignored for ${url}`)
        return res
      }
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} from ${url}`)
        console.warn(`${TAG} retryFetch — ${res.status} error, retrying in ${baseDelayMs * 2 ** i}ms`)
        await sleep(baseDelayMs * 2 ** i)
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}: ${await res.text()}`)
      console.log(`${TAG} retryFetch — OK ${res.status} ${url}`)
      return res
    } catch (err) {
      lastErr = err
      console.error(`${TAG} retryFetch — attempt ${i + 1} threw: ${err instanceof Error ? err.message : err}`)
      if (i < maxAttempts - 1) await sleep(baseDelayMs * 2 ** i)
    }
  }
  throw lastErr
}

async function ensureServerDeleted(serverId: number, token: string): Promise<boolean> {
  console.log(`${TAG} ensureServerDeleted — requesting deletion for serverId=${serverId}`)
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
      console.log(`${TAG} ensureServerDeleted — serverId=${serverId} confirmed deleted`)
      return true
    }
    if (!res.ok) {
      throw new Error(`Failed to check server deletion for ${serverId}: HTTP ${res.status}`)
    }
    await sleep(5000)
  }

  console.log(`${TAG} ensureServerDeleted — serverId=${serverId} still exists after wait window`)
  return false
}

async function ensureFirewallDeleted(firewallId: number, token: string): Promise<boolean> {
  console.log(`${TAG} ensureFirewallDeleted — requesting deletion for firewallId=${firewallId}`)

  for (let i = 0; i < 12; i++) {
    const res = await fetch(`https://api.hetzner.cloud/v1/firewalls/${firewallId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.status === 404) {
      console.log(`${TAG} ensureFirewallDeleted — firewallId=${firewallId} already deleted`)
      return true
    }

    if (res.ok) {
      console.log(`${TAG} ensureFirewallDeleted — firewallId=${firewallId} deleted`)
      return true
    }

    if (res.status === 409) {
      console.log(`${TAG} ensureFirewallDeleted — firewallId=${firewallId} still in use, waiting`)
      await sleep(5000)
      continue
    }

    if (res.status === 429 || res.status >= 500) {
      console.log(`${TAG} ensureFirewallDeleted — firewallId=${firewallId} temporary error HTTP ${res.status}, waiting`)
      await sleep(5000)
      continue
    }

    throw new Error(`Failed to delete firewall ${firewallId}: HTTP ${res.status} ${await res.text()}`)
  }

  console.log(`${TAG} ensureFirewallDeleted — firewallId=${firewallId} still in use after wait window`)
  return false
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  readySecret: string
  computerId: string
  convexHttpUrl: string
  openrouterApiKey: string
}

function buildCloudInit(p: CloudInitParams): string {
  return CLOUD_INIT_TEMPLATE
    .replaceAll('{{GATEWAY_TOKEN}}',    p.gatewayToken)
    .replaceAll('{{READY_SECRET}}',     p.readySecret)
    .replaceAll('{{COMPUTER_ID}}',      p.computerId)
    .replaceAll('{{CONVEX_HTTP_URL}}',  p.convexHttpUrl)
    .replaceAll('{{OPENROUTER_API_KEY}}', p.openrouterApiKey)
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
      OPENROUTER_API_KEY={{OPENROUTER_API_KEY}}

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
            ["node", "openclaw.mjs", "gateway", "--bind", "lan", "--port", "18789"]

  - path: /root/.openclaw/openclaw.json
    permissions: '0600'
    content: |
      {
        "gateway": {
          "mode": "local",
          "bind": "lan",
          "port": 18789,
          "auth": {
            "mode": "token",
            "token": "{{GATEWAY_TOKEN}}"
          },
          "http": {
            "endpoints": {
              "chatCompletions": {
                "enabled": true
              }
            }
          },
          "controlUi": {
            "enabled": true,
            "dangerouslyAllowHostHeaderOriginFallback": true
          }
        },
        "agents": {
          "defaults": {
            "workspace": "/home/node/.openclaw/workspace",
            "model": {
              "primary": "openrouter/anthropic/claude-sonnet-4-5"
            }
          },
          "list": [
            {
              "id": "default",
              "name": "OpenClaw Assistant",
              "workspace": "/home/node/.openclaw/workspace"
            }
          ]
        },
        "cron": {
          "enabled": false
        }
      }

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
                  -d "{\\"computerId\\":\\"$COMPUTER_ID\\",\\"message\\":$escaped}" > /dev/null 2>&1 || true
              fi
            fi
            last_line=$current_line
          fi
        done
      ) > /dev/null 2>&1 &

      clog() {
        curl -sf -X POST "$CONVEX_URL/computer/log" \\
          -H "Content-Type: application/json" \\
          -d "{\\"computerId\\":\\"$COMPUTER_ID\\",\\"message\\":\\"$1\\"}" > /dev/null 2>&1 || true
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

      # Step 3: Pull the prebuilt OpenClaw image and start the configured gateway
      clog "Pulling prebuilt OpenClaw image..."
      cd /root/openclaw-deploy
      docker compose pull
      clog "OpenClaw image pulled. Starting container..."

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
