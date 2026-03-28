import { v } from 'convex/values'
import {
  action, mutation, query, internalMutation, internalQuery, internalAction
} from './_generated/server'
import { api, internal, components } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'
import { requireAccessToken, sha256Hex, validateServerSecret } from './lib/auth'
import {
  redactIdentifierForLog,
  redactIpForLog,
  summarizeErrorForLog,
  summarizeTextForLog,
} from './lib/logging'
import {
  buildComputerReleaseManifest,
  DEFAULT_COMPUTER_UPDATER_POLL_SECONDS,
  DEFAULT_COMPUTER_UPDATE_CHANNEL,
  DEFAULT_COMPUTER_UPDATER_VERSION,
  parseComputerReleaseManifest,
} from '../src/lib/computer-release'
import {
  OPENCLAW_OVERLAY_PLUGIN_ID,
} from '../src/lib/openclaw-overlay-plugin-bundle'
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID, getModel } from '../src/lib/models'
import { calculateTokenCost } from '../src/lib/model-pricing'
import type { Id } from './_generated/dataModel'

const TAG = '[Computer]'
const stripeClient = new StripeSubscriptions(components.stripe, {})
const textEncoder = new TextEncoder()

function generateGatewayToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
}

function generateReadySecret(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

function generateComputerApiToken(): string {
  return `ocpt_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`
}

function getRequiredHetznerSshKeyId(): number {
  const raw = process.env.HETZNER_SSH_KEY_ID?.trim()
  if (!raw) {
    throw new Error('HETZNER_SSH_KEY_ID is required to provision computers')
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    throw new Error('HETZNER_SSH_KEY_ID must be a valid integer')
  }

  return parsed
}

function getRequiredHetznerSshSourceIps(): string[] {
  const raw = process.env.HETZNER_SSH_ALLOWED_CIDRS?.trim()
  if (!raw) {
    throw new Error('HETZNER_SSH_ALLOWED_CIDRS is required to provision computers')
  }

  const cidrs = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  if (cidrs.length === 0) {
    throw new Error('HETZNER_SSH_ALLOWED_CIDRS must include at least one CIDR')
  }

  return cidrs
}

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

async function assertComputerPublicApiSupportsPluginBundle(baseUrl: string) {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/computer/v1/plugin/bundle`
  let response: Response

  try {
    response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    throw new Error(
      `COMPUTER_PUBLIC_API_BASE_URL is unreachable for managed computer bootstrap: ${summarizeUrlForLog(url)} (${summarizeErrorForLog(error)}).`,
    )
  }

  if (response.status === 404) {
    throw new Error(
      `COMPUTER_PUBLIC_API_BASE_URL does not serve /api/computer/v1/plugin/bundle: ${summarizeUrlForLog(url)}. Deploy the current web app or point the env var at a reachable deployment that includes the machine plugin routes.`,
    )
  }
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

type ComputerUpdateChannel = 'stable' | 'canary'
type ComputerReleaseUpdateStrategy = 'in_place' | 'reprovision_required'
type ComputerUpdateStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'applying'
  | 'restarting'
  | 'verifying'
  | 'ready'
  | 'reprovision_required'
  | 'error'

type ComputerReleaseRecord = {
  _id: Id<'computerReleases'>
  version: string
  channel: ComputerUpdateChannel
  openclawImage: string
  toolBundleVersion: string
  overlayPluginVersion?: string
  configVersion: string
  updateStrategy: ComputerReleaseUpdateStrategy
  minUpdaterVersion: string
  manifestJson: string
  createdAt: number
  rolledBackFromVersion?: string
}

type ReleaseVersionIndexQuery = {
  eq: (field: 'version', value: string) => unknown
}

type ReleaseDbAccessor = {
  query: (table: 'computerReleases') => {
    withIndex: {
      (
        index: 'by_version',
        builder: (query: ReleaseVersionIndexQuery) => unknown,
      ): {
        first: () => Promise<ComputerReleaseRecord | null>
      }
      (
        index: 'by_createdAt',
      ): {
        order: (direction: 'asc' | 'desc') => {
          collect: () => Promise<ComputerReleaseRecord[]>
        }
      }
    }
  }
  insert: (
    table: 'computerReleases',
    value: Omit<ComputerReleaseRecord, '_id'>,
  ) => Promise<Id<'computerReleases'>>
}

function isReleaseAvailableToChannel(
  releaseChannel: ComputerUpdateChannel,
  computerChannel: ComputerUpdateChannel,
): boolean {
  if (computerChannel === 'canary') {
    return releaseChannel === 'canary' || releaseChannel === 'stable'
  }
  return releaseChannel === 'stable'
}

function withNormalizedRelease<T extends Omit<ComputerReleaseRecord, 'overlayPluginVersion'> & { overlayPluginVersion?: string }>(
  release: T,
): T & { overlayPluginVersion: string } {
  const manifest = parseComputerReleaseManifest(release.manifestJson)
  return {
    ...release,
    overlayPluginVersion: release.overlayPluginVersion?.trim() || manifest.overlayPluginVersion,
  }
}

function resolveOverlayPluginVersion(release: { overlayPluginVersion?: string; manifestJson: string }): string {
  return release.overlayPluginVersion?.trim() || parseComputerReleaseManifest(release.manifestJson).overlayPluginVersion
}

function sanitizeComputerRecord<T extends Record<string, unknown>>(computer: T): T {
  return {
    ...computer,
    gatewayToken: undefined,
    readySecret: undefined,
    computerApiToken: undefined,
    computerApiTokenHash: undefined,
  }
}

async function ensureDefaultStableReleaseInDb(ctx: { db: unknown }) {
  const db = ctx.db as ReleaseDbAccessor
  const existing = await db
    .query('computerReleases')
    .withIndex('by_version', (q) => q.eq('version', buildComputerReleaseManifest().version))
    .first()

  if (existing) {
    return withNormalizedRelease(existing as ComputerReleaseRecord)
  }

  const manifest = buildComputerReleaseManifest()
  const createdAt = Date.now()
  const releaseId = await db.insert('computerReleases', {
    version: manifest.version,
    channel: manifest.channel,
    openclawImage: manifest.openclawImage,
    toolBundleVersion: manifest.toolBundleVersion,
    overlayPluginVersion: manifest.overlayPluginVersion,
    configVersion: manifest.configVersion,
    updateStrategy: manifest.updateStrategy,
    minUpdaterVersion: manifest.minUpdaterVersion,
    manifestJson: JSON.stringify(manifest),
    createdAt,
  })

  return withNormalizedRelease({
    _id: releaseId,
    version: manifest.version,
    channel: manifest.channel,
    openclawImage: manifest.openclawImage,
    toolBundleVersion: manifest.toolBundleVersion,
    overlayPluginVersion: manifest.overlayPluginVersion,
    configVersion: manifest.configVersion,
    updateStrategy: manifest.updateStrategy,
    minUpdaterVersion: manifest.minUpdaterVersion,
    manifestJson: JSON.stringify(manifest),
    createdAt,
  } satisfies ComputerReleaseRecord)
}

function buildDefaultReleaseRecord(): Omit<ComputerReleaseRecord, '_id'> {
  const manifest = buildComputerReleaseManifest()
  return {
    version: manifest.version,
    channel: manifest.channel,
    openclawImage: manifest.openclawImage,
    toolBundleVersion: manifest.toolBundleVersion,
    overlayPluginVersion: manifest.overlayPluginVersion,
    configVersion: manifest.configVersion,
    updateStrategy: manifest.updateStrategy,
    minUpdaterVersion: manifest.minUpdaterVersion,
    manifestJson: JSON.stringify(manifest),
    createdAt: Date.now(),
  }
}

async function getLatestReleaseForChannelFromDb(
  ctx: { db: unknown },
  channel: ComputerUpdateChannel,
) {
  const db = ctx.db as ReleaseDbAccessor
  const releases = await db
    .query('computerReleases')
    .withIndex('by_createdAt')
    .order('desc')
    .collect()

  const available = releases.find((release: ComputerReleaseRecord) =>
    isReleaseAvailableToChannel(release.channel, channel),
  )

  return available ? withNormalizedRelease(available as ComputerReleaseRecord) : null
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    region: v.union(v.literal('eu-central'), v.literal('us-east')),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  returns: v.id('computers'),
  handler: async (ctx, args) => {
    console.log(
      `${TAG} create — region=${args.region} name=${summarizeTextForLog(args.name)}`
    )
    await authorizeUserAccess({
      accessToken: args.accessToken,
      serverSecret: args.serverSecret,
      userId: args.userId,
    })
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
    const gatewayToken = generateGatewayToken()
    const readySecret = generateReadySecret()
    const computerApiToken = generateComputerApiToken()
    const computerApiTokenHash = await sha256Hex(computerApiToken)
    const defaultRelease = await ensureDefaultStableReleaseInDb(ctx)
    const now = Date.now()
    const id = await ctx.db.insert('computers', {
      userId: args.userId,
      name: trimmedName,
      setupType: 'managed',
      region: args.region,
      updateChannel: DEFAULT_COMPUTER_UPDATE_CHANNEL,
      desiredReleaseVersion: defaultRelease.version,
      desiredOverlayPluginVersion: resolveOverlayPluginVersion(defaultRelease),
      updateStatus: 'idle',
      reprovisionRequired: false,
      overlayPluginHealthStatus: 'unknown',
      status: 'pending_payment',
      gatewayToken,
      readySecret,
      computerApiToken,
      computerApiTokenHash,
      computerApiTokenIssuedAt: now,
      computerApiTokenVersion: 1,
      createdAt: now,
      updatedAt: now,
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

export const beginProvisioning: ReturnType<typeof internalMutation> = internalMutation({
  args: { computerId: v.id('computers') },
  handler: async (ctx, { computerId }): Promise<boolean> => {
    console.log(`${TAG} beginProvisioning — computerId=${redactIdentifierForLog(computerId)}`)
    const computer = await ctx.db.get(computerId)
    if (!computer) {
      throw new Error('Computer not found')
    }
    const isBootstrapReprovision =
      computer.status === 'provisioning' && computer.provisioningStep === 'creating_server'
    if (computer.status !== 'pending_payment' && !isBootstrapReprovision) {
      console.log(`${TAG} beginProvisioning — SKIP status=${computer.status}`)
      return false
    }
    await ctx.db.patch(computerId, {
      status: 'provisioning',
      provisioningStep: 'creating_server',
      updatedAt: Date.now(),
    })
    console.log(`${TAG} beginProvisioning — DONE status=provisioning step=creating_server`)
    return true
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
      updateStatus: computer.appliedReleaseVersion ? 'ready' : computer.updateStatus ?? 'idle',
      readySecret: undefined,
      provisioningStep: undefined,
      errorMessage: undefined,
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
      updateStatus: 'error',
      errorMessage: args.message,
      lastUpdateError: args.message,
      updatedAt: Date.now(),
    })
  },
})

export const resetForRepair = internalMutation({
  args: { computerId: v.id('computers') },
  returns: v.object({
    oldHetznerServerId: v.optional(v.number()),
    oldHetznerFirewallId: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    console.warn(`${TAG} resetForRepair — computerId=${redactIdentifierForLog(args.computerId)}`)
    const computer = await ctx.db.get(args.computerId)
    if (!computer) {
      throw new Error('Computer not found')
    }

    const oldHetznerServerId = computer.hetznerServerId
    const oldHetznerFirewallId = computer.hetznerFirewallId

    const nextComputerApiToken = generateComputerApiToken()
    const nextComputerApiTokenHash = await sha256Hex(nextComputerApiToken)
    const nextDesiredRelease =
      (await getLatestReleaseForChannelFromDb(
        ctx,
        (computer.updateChannel as ComputerUpdateChannel | undefined) ?? DEFAULT_COMPUTER_UPDATE_CHANNEL,
      )) ??
      (await ensureDefaultStableReleaseInDb(ctx))

    await ctx.db.patch(args.computerId, {
      status: 'provisioning',
      provisioningStep: 'creating_server',
      errorMessage: undefined,
      hetznerServerId: undefined,
      hetznerServerIp: undefined,
      hetznerFirewallId: undefined,
      gatewayToken: generateGatewayToken(),
      readySecret: generateReadySecret(),
      computerApiToken: nextComputerApiToken,
      computerApiTokenHash: nextComputerApiTokenHash,
      computerApiTokenIssuedAt: Date.now(),
      computerApiTokenLastUsedAt: undefined,
      computerApiTokenVersion: (computer.computerApiTokenVersion ?? 1) + 1,
      desiredReleaseVersion: nextDesiredRelease.version,
      desiredOverlayPluginVersion: resolveOverlayPluginVersion(nextDesiredRelease),
      previousReleaseVersion: computer.appliedReleaseVersion,
      appliedReleaseVersion: undefined,
      updateStatus: 'idle',
      lastUpdateError: undefined,
      overlayPluginInstalledVersion: undefined,
      overlayPluginHealthStatus: 'unknown',
      overlayPluginLastHealthCheckAt: undefined,
      overlayPluginLastError: undefined,
      lastUpdateCheckAt: undefined,
      lastUpdateStartedAt: undefined,
      lastUpdateCompletedAt: undefined,
      reprovisionRequired: false,
      chatSessionKey: undefined,
      chatRequestedModelRef: undefined,
      chatEffectiveModel: undefined,
      chatEffectiveProvider: undefined,
      chatModelResolvedAt: undefined,
      updatedAt: Date.now(),
    })

    return { oldHetznerServerId, oldHetznerFirewallId }
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
      computerApiToken: undefined,
      computerApiTokenHash: undefined,
      computerApiTokenIssuedAt: undefined,
      computerApiTokenLastUsedAt: undefined,
      computerApiTokenVersion: undefined,
      reprovisionRequired: false,
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
    sessionKey: v.optional(v.string()),
    sessionTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log(
      `${TAG} event [${args.type}] computerId=${redactIdentifierForLog(args.computerId)} message=${summarizeTextForLog(args.message)}`
    )
    await ctx.db.insert('computerEvents', {
      computerId: args.computerId,
      type: args.type,
      message: args.message,
      sessionKey: args.sessionKey,
      sessionTitle: args.sessionTitle,
      createdAt: Date.now(),
    })
  },
})

export const patchUpdateTargetState = internalMutation({
  args: {
    computerId: v.id('computers'),
    desiredReleaseVersion: v.string(),
    desiredOverlayPluginVersion: v.string(),
    updateStatus: v.union(
      v.literal('idle'),
      v.literal('checking'),
      v.literal('downloading'),
      v.literal('applying'),
      v.literal('restarting'),
      v.literal('verifying'),
      v.literal('ready'),
      v.literal('reprovision_required'),
      v.literal('error'),
    ),
    reprovisionRequired: v.boolean(),
    lastUpdateError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.computerId, {
      desiredReleaseVersion: args.desiredReleaseVersion,
      desiredOverlayPluginVersion: args.desiredOverlayPluginVersion,
      updateStatus: args.updateStatus,
      reprovisionRequired: args.reprovisionRequired,
      lastUpdateError: args.lastUpdateError,
      lastUpdateCheckAt: Date.now(),
      updatedAt: Date.now(),
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
    return sanitizeComputerRecord(computer)
  },
})

export const activatePaidComputer: ReturnType<typeof action> = action({
  args: {
    computerId: v.id('computers'),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    serverSecret: v.string(),
  },
  returns: v.object({
    status: v.string(),
  }),
  handler: async (ctx, args): Promise<{ status: string }> => {
    if (!validateServerSecret(args.serverSecret)) {
      throw new Error('Unauthorized')
    }

    const existingComputer = await ctx.runQuery(internal.computers.getInternal, {
      computerId: args.computerId,
    }) as { status: string } | null

    if (!existingComputer) {
      throw new Error('Computer not found')
    }

    await ctx.runMutation(internal.computers.setStripeInfo, {
      computerId: args.computerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeCustomerId: args.stripeCustomerId,
    })

    if (existingComputer.status === 'pending_payment') {
      await ctx.runAction(internal.computers.provisionComputer, {
        computerId: args.computerId,
      })
    }

    const updatedComputer = await ctx.runQuery(internal.computers.getInternal, {
      computerId: args.computerId,
    }) as { status?: string } | null

    return {
      status: updatedComputer?.status ?? existingComputer.status,
    }
  },
})

export const repairComputerInstance = action({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  returns: v.object({
    queued: v.boolean(),
    status: v.string(),
  }),
  handler: async (ctx, { computerId, userId, accessToken, serverSecret }) => {
    console.warn(
      `${TAG} repairComputerInstance — START computerId=${redactIdentifierForLog(computerId)}`
    )

    await authorizeUserAccess({
      accessToken,
      serverSecret,
      userId,
    })

    const computer = await ctx.runQuery(internal.computers.getInternal, { computerId })
    if (!computer || computer.userId !== userId) {
      throw new Error('Computer not found')
    }

    if (computer.status === 'deleted') {
      throw new Error('Computer has been deleted')
    }

    const reset = await ctx.runMutation(internal.computers.resetForRepair, {
      computerId,
    })

    await ctx.runMutation(internal.computers.logEvent, {
      computerId,
      type: 'status_change',
      message: 'Reprovisioning this computer now.',
    })

    if (reset.oldHetznerServerId || reset.oldHetznerFirewallId) {
      await ctx.scheduler.runAfter(
        1000,
        internal.computers.cleanupDetachedComputerResources,
        {
          computerId,
          hetznerServerId: reset.oldHetznerServerId,
          hetznerFirewallId: reset.oldHetznerFirewallId,
        }
      )
    }

    await ctx.runAction(internal.computers.provisionComputer, { computerId })

    console.warn(
      `${TAG} repairComputerInstance — QUEUED computerId=${redactIdentifierForLog(computerId)}`
    )
    return { queued: true, status: 'provisioning' }
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
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      await authorizeUserAccess(args)
    } catch {
      return []
    }
    const computers = await ctx.db
      .query('computers')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .filter((q) => q.neq(q.field('status'), 'deleted'))
      .collect()
    return computers.map((c) => sanitizeComputerRecord(c))
  },
})

export const listForServer = query({
  args: {
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validateServerSecret(args.serverSecret)) {
      throw new Error('Unauthorized')
    }

    const computers = await ctx.db
      .query('computers')
      .filter((q) => q.neq(q.field('status'), 'deleted'))
      .collect()

    return computers.map((computer) => sanitizeComputerRecord(computer))
  },
})

export const getReleaseByVersionInternal = internalQuery({
  args: { version: v.string() },
  handler: async (ctx, args) => {
    const release = await ctx.db
      .query('computerReleases')
      .withIndex('by_version', (q) => q.eq('version', args.version))
      .first()
    return release ? withNormalizedRelease(release as ComputerReleaseRecord) : null
  },
})

export const getLatestReleaseForChannelInternal = internalQuery({
  args: {
    channel: v.union(v.literal('stable'), v.literal('canary')),
  },
  handler: async (ctx, args) => {
    const latest = await getLatestReleaseForChannelFromDb(ctx, args.channel)
    if (latest) {
      return withNormalizedRelease(latest)
    }
    return buildDefaultReleaseRecord()
  },
})

export const getResolvedComputerRelease = query({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess(args)

    const computer = await ctx.db.get(args.computerId)
    if (!computer || computer.userId !== args.userId) {
      throw new Error('Computer not found')
    }

    const latestRelease =
      (await getLatestReleaseForChannelFromDb(
        ctx,
        (computer.updateChannel as ComputerUpdateChannel | undefined) ?? DEFAULT_COMPUTER_UPDATE_CHANNEL,
      )) ?? buildDefaultReleaseRecord()
    const desiredVersion = computer.desiredReleaseVersion?.trim() || null
    const desiredRelease =
      (desiredVersion
        ? await ctx.db
            .query('computerReleases')
            .withIndex('by_version', (q) => q.eq('version', desiredVersion))
            .first()
        : null) ?? latestRelease
    const parsedManifest = parseComputerReleaseManifest(desiredRelease?.manifestJson)

    return {
      computerId: computer._id,
      update: {
        updateChannel: computer.updateChannel ?? DEFAULT_COMPUTER_UPDATE_CHANNEL,
        desiredReleaseVersion: computer.desiredReleaseVersion ?? desiredRelease.version,
        appliedReleaseVersion: computer.appliedReleaseVersion ?? null,
        previousReleaseVersion: computer.previousReleaseVersion ?? null,
        updateStatus: (computer.updateStatus ?? 'idle') as ComputerUpdateStatus,
        reprovisionRequired: Boolean(computer.reprovisionRequired),
        lastUpdateCheckAt: computer.lastUpdateCheckAt ?? null,
        lastUpdateStartedAt: computer.lastUpdateStartedAt ?? null,
        lastUpdateCompletedAt: computer.lastUpdateCompletedAt ?? null,
        lastUpdateError: computer.lastUpdateError ?? null,
        pollIntervalSeconds: DEFAULT_COMPUTER_UPDATER_POLL_SECONDS,
      },
      desiredRelease: desiredRelease
        ? {
            version: desiredRelease.version,
            channel: desiredRelease.channel,
            openclawImage: desiredRelease.openclawImage,
            toolBundleVersion: desiredRelease.toolBundleVersion,
            overlayPluginVersion: resolveOverlayPluginVersion(desiredRelease),
            configVersion: desiredRelease.configVersion,
            updateStrategy: desiredRelease.updateStrategy,
            minUpdaterVersion: desiredRelease.minUpdaterVersion,
            manifest: parsedManifest,
          }
        : null,
      latestRelease: latestRelease
        ? {
            version: latestRelease.version,
            channel: latestRelease.channel,
          }
        : null,
    }
  },
})

export const markComputerUpdateCheck = mutation({
  args: {
    computerId: v.id('computers'),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validateServerSecret(args.serverSecret)) {
      throw new Error('Unauthorized')
    }

    await ctx.db.patch(args.computerId, {
      lastUpdateCheckAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const reportOverlayPluginHealth = mutation({
  args: {
    computerId: v.id('computers'),
    serverSecret: v.string(),
    status: v.union(
      v.literal('unknown'),
      v.literal('installing'),
      v.literal('installed'),
      v.literal('missing'),
      v.literal('error'),
    ),
    installedVersion: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    if (!validateServerSecret(args.serverSecret)) {
      throw new Error('Unauthorized')
    }

    const computer = await ctx.db.get(args.computerId)
    if (!computer || computer.status === 'deleted') {
      throw new Error('Computer not found')
    }

    const now = Date.now()
    const message = args.message?.trim() || undefined

    await ctx.db.patch(args.computerId, {
      overlayPluginInstalledVersion: args.installedVersion?.trim() || computer.overlayPluginInstalledVersion,
      overlayPluginHealthStatus: args.status,
      overlayPluginLastHealthCheckAt: now,
      overlayPluginLastError:
        args.status === 'error' || args.status === 'missing'
          ? (message ?? 'Overlay plugin is unavailable.')
          : undefined,
      updatedAt: now,
    })

    await ctx.db.insert('computerEvents', {
      computerId: args.computerId,
      type: 'status_change',
      message:
        message ??
        `Overlay plugin status updated to ${args.status}${args.installedVersion ? ` (${args.installedVersion})` : ''}.`,
      createdAt: now,
    })

    return { ok: true }
  },
})

export const reportComputerUpdate = mutation({
  args: {
    computerId: v.id('computers'),
    serverSecret: v.string(),
    status: v.union(
      v.literal('checking'),
      v.literal('downloading'),
      v.literal('applying'),
      v.literal('restarting'),
      v.literal('verifying'),
      v.literal('ready'),
      v.literal('reprovision_required'),
      v.literal('error'),
    ),
    targetVersion: v.string(),
    message: v.optional(v.string()),
    step: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.boolean(),
    nextAction: v.union(v.literal('none'), v.literal('retry_later'), v.literal('reprovision')),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; nextAction: 'none' | 'retry_later' | 'reprovision' }> => {
    if (!validateServerSecret(args.serverSecret)) {
      throw new Error('Unauthorized')
    }

    const computer = await ctx.db.get(args.computerId)
    if (!computer || computer.status === 'deleted') {
      throw new Error('Computer not found')
    }

    const now = Date.now()
    const message = args.message?.trim() || null
    const currentApplied = computer.appliedReleaseVersion
    const nextPatch: Record<string, unknown> = {
      updateStatus: args.status,
      updatedAt: now,
      lastUpdateCheckAt: now,
    }

    if (args.startedAt) {
      nextPatch.lastUpdateStartedAt = args.startedAt
    } else if (args.status !== 'ready' && args.status !== 'error' && args.status !== 'reprovision_required') {
      nextPatch.lastUpdateStartedAt = computer.lastUpdateStartedAt ?? now
    }

    if (args.status === 'ready') {
      nextPatch.status = 'ready'
      nextPatch.errorMessage = undefined
      nextPatch.reprovisionRequired = false
      nextPatch.previousReleaseVersion =
        currentApplied && currentApplied !== args.targetVersion ? currentApplied : computer.previousReleaseVersion
      nextPatch.appliedReleaseVersion = args.targetVersion
      nextPatch.lastUpdateCompletedAt = args.completedAt ?? now
      nextPatch.lastUpdateError = undefined
    } else if (args.status === 'reprovision_required') {
      nextPatch.reprovisionRequired = true
      nextPatch.lastUpdateCompletedAt = args.completedAt ?? now
      nextPatch.lastUpdateError = message ?? 'This release requires reprovisioning.'
    } else if (args.status === 'error') {
      nextPatch.status = 'error'
      nextPatch.errorMessage = message ?? 'Computer update failed.'
      nextPatch.lastUpdateError = message ?? 'Computer update failed.'
      nextPatch.lastUpdateCompletedAt = args.completedAt ?? now
    } else {
      nextPatch.lastUpdateError = undefined
    }

    await ctx.db.patch(args.computerId, nextPatch)
    await ctx.db.insert('computerEvents', {
      computerId: args.computerId,
      type: 'status_change',
      message:
        message ??
        `Computer update ${args.status.replaceAll('_', ' ')} for release ${args.targetVersion}.`,
      createdAt: now,
    })

    return {
      ok: true,
      nextAction:
        args.status === 'reprovision_required'
          ? 'reprovision'
          : args.status === 'error'
            ? 'retry_later'
            : 'none',
    }
  },
})

export const upsertComputerRelease = mutation({
  args: {
    serverSecret: v.string(),
    version: v.string(),
    channel: v.union(v.literal('stable'), v.literal('canary')),
    openclawImage: v.string(),
    toolBundleVersion: v.string(),
    overlayPluginVersion: v.string(),
    configVersion: v.string(),
    updateStrategy: v.union(v.literal('in_place'), v.literal('reprovision_required')),
    minUpdaterVersion: v.string(),
    manifestJson: v.optional(v.string()),
    rolledBackFromVersion: v.optional(v.string()),
    assignToChannel: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!validateServerSecret(args.serverSecret)) {
      throw new Error('Unauthorized')
    }

    const manifest = buildComputerReleaseManifest({
      version: args.version,
      channel: args.channel,
      openclawImage: args.openclawImage,
      toolBundleVersion: args.toolBundleVersion,
      overlayPluginVersion: args.overlayPluginVersion,
      configVersion: args.configVersion,
      updateStrategy: args.updateStrategy,
      minUpdaterVersion: args.minUpdaterVersion,
    })
    const manifestJson = args.manifestJson?.trim() || JSON.stringify(manifest)
    const existing = await ctx.db
      .query('computerReleases')
      .withIndex('by_version', (q) => q.eq('version', args.version))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        channel: args.channel,
        openclawImage: args.openclawImage,
        toolBundleVersion: args.toolBundleVersion,
        overlayPluginVersion: args.overlayPluginVersion,
        configVersion: args.configVersion,
        updateStrategy: args.updateStrategy,
        minUpdaterVersion: args.minUpdaterVersion,
        manifestJson,
        rolledBackFromVersion: args.rolledBackFromVersion,
      })
    } else {
      await ctx.db.insert('computerReleases', {
        version: args.version,
        channel: args.channel,
        openclawImage: args.openclawImage,
        toolBundleVersion: args.toolBundleVersion,
        overlayPluginVersion: args.overlayPluginVersion,
        configVersion: args.configVersion,
        updateStrategy: args.updateStrategy,
        minUpdaterVersion: args.minUpdaterVersion,
        manifestJson,
        rolledBackFromVersion: args.rolledBackFromVersion,
        createdAt: Date.now(),
      })
    }

    if (args.assignToChannel !== false) {
      const computers = await ctx.db.query('computers').collect()
      const targetChannel = args.channel
      const now = Date.now()
      for (const computer of computers) {
        if (computer.status === 'deleted') continue
        if (computer.updateChannel !== targetChannel) continue
        await ctx.db.patch(computer._id, {
          desiredReleaseVersion: args.version,
          desiredOverlayPluginVersion: args.overlayPluginVersion,
          reprovisionRequired: args.updateStrategy === 'reprovision_required',
          updateStatus:
            args.updateStrategy === 'reprovision_required'
              ? 'reprovision_required'
              : computer.updateStatus === 'error'
                ? 'error'
                : 'idle',
          lastUpdateError:
            args.updateStrategy === 'reprovision_required'
              ? `Release ${args.version} requires reprovisioning.`
              : undefined,
          updatedAt: now,
        })
      }
    }

    return { ok: true }
  },
})

export const promoteComputerRelease = mutation({
  args: {
    serverSecret: v.string(),
    version: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validateServerSecret(args.serverSecret)) {
      throw new Error('Unauthorized')
    }

    const release = await ctx.db
      .query('computerReleases')
      .withIndex('by_version', (q) => q.eq('version', args.version))
      .first()
    if (!release) {
      throw new Error('Release not found')
    }

    await ctx.db.patch(release._id, {
      channel: 'stable',
    })

    const computers = await ctx.db.query('computers').collect()
    const now = Date.now()
    for (const computer of computers) {
      if (computer.status === 'deleted') continue
      if (computer.updateChannel !== 'stable') continue
      await ctx.db.patch(computer._id, {
        desiredReleaseVersion: release.version,
        desiredOverlayPluginVersion: resolveOverlayPluginVersion(release),
        reprovisionRequired: release.updateStrategy === 'reprovision_required',
        updateStatus:
          release.updateStrategy === 'reprovision_required' ? 'reprovision_required' : computer.updateStatus,
        updatedAt: now,
      })
    }

    return { ok: true }
  },
})

export const assignComputerReleaseOverride = mutation({
  args: {
    serverSecret: v.string(),
    computerId: v.id('computers'),
    version: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validateServerSecret(args.serverSecret)) {
      throw new Error('Unauthorized')
    }

    const release = await ctx.db
      .query('computerReleases')
      .withIndex('by_version', (q) => q.eq('version', args.version))
      .first()
    if (!release) {
      throw new Error('Release not found')
    }

    await ctx.db.patch(args.computerId, {
      desiredReleaseVersion: release.version,
      desiredOverlayPluginVersion: resolveOverlayPluginVersion(release),
      reprovisionRequired: release.updateStrategy === 'reprovision_required',
      updateStatus: release.updateStrategy === 'reprovision_required' ? 'reprovision_required' : 'idle',
      lastUpdateError:
        release.updateStrategy === 'reprovision_required'
          ? `Release ${release.version} requires reprovisioning.`
          : undefined,
      updatedAt: Date.now(),
    })

    return { ok: true }
  },
})

export const updateComputerSoftware = action({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    targetVersion: v.optional(v.string()),
    checkOnly: v.optional(v.boolean()),
  },
  returns: v.object({
    queued: v.boolean(),
    desiredReleaseVersion: v.string(),
    appliedReleaseVersion: v.optional(v.string()),
    updateStatus: v.string(),
    reprovisionRequired: v.boolean(),
    message: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    queued: boolean
    desiredReleaseVersion: string
    appliedReleaseVersion?: string
    updateStatus: string
    reprovisionRequired: boolean
    message: string
  }> => {
    await authorizeUserAccess(args)

    const computer = await ctx.runQuery(internal.computers.getInternal, {
      computerId: args.computerId,
    })
    if (!computer || computer.userId !== args.userId) {
      throw new Error('Computer not found')
    }
    if (computer.status === 'deleted') {
      throw new Error('Computer has been deleted')
    }

    const targetRelease: ComputerReleaseRecord | Omit<ComputerReleaseRecord, '_id'> =
      (args.targetVersion
        ? await ctx.runQuery(internal.computers.getReleaseByVersionInternal, {
            version: args.targetVersion,
          })
        : await ctx.runQuery(internal.computers.getLatestReleaseForChannelInternal, {
            channel:
              (computer.updateChannel as ComputerUpdateChannel | undefined) ??
              DEFAULT_COMPUTER_UPDATE_CHANNEL,
          })) ??
      buildDefaultReleaseRecord()

    const targetVersion = targetRelease.version
    const updateStrategy = targetRelease.updateStrategy
    const nextStatus: ComputerUpdateStatus =
      updateStrategy === 'reprovision_required'
        ? 'reprovision_required'
        : args.checkOnly
          ? ((computer.updateStatus as ComputerUpdateStatus | undefined) ?? 'idle')
          : 'checking'
    const nextError =
      updateStrategy === 'reprovision_required'
        ? `Release ${targetVersion} requires reprovisioning.`
        : undefined

    await ctx.runMutation(internal.computers.patchUpdateTargetState, {
      computerId: args.computerId,
      desiredReleaseVersion: targetVersion,
      desiredOverlayPluginVersion: resolveOverlayPluginVersion(targetRelease),
      updateStatus: nextStatus,
      reprovisionRequired: updateStrategy === 'reprovision_required',
      lastUpdateError: nextError,
    })

    await ctx.runMutation(internal.computers.logEvent, {
      computerId: args.computerId,
      type: 'status_change',
      message:
        updateStrategy === 'reprovision_required'
          ? `Release ${targetVersion} requires reprovisioning.`
          : args.checkOnly
            ? `Checked for software updates. Desired release is ${targetVersion}.`
            : `Software update to release ${targetVersion} queued. The updater will apply it on the next poll.`,
    })

    return {
      queued: !args.checkOnly,
      desiredReleaseVersion: targetVersion,
      appliedReleaseVersion: computer.appliedReleaseVersion,
      updateStatus: nextStatus,
      reprovisionRequired: updateStrategy === 'reprovision_required',
      message:
        updateStrategy === 'reprovision_required'
          ? `Release ${targetVersion} requires reprovisioning.`
          : args.checkOnly
            ? `Desired release is ${targetVersion}.`
            : `Release ${targetVersion} has been queued and will apply within ${Math.floor(DEFAULT_COMPUTER_UPDATER_POLL_SECONDS / 60)} minutes or after the next boot.`,
    }
  },
})

export const listEvents = query({
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
        sessionKey: event.sessionKey,
        sessionTitle: event.sessionTitle,
        createdAt: event.createdAt,
        isError: event.type === 'chat_error',
      }))
  },
})

export const listSessionEvents = query({
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
      return []
    }

    const computer = await ctx.db.get(args.computerId)
    if (!computer || computer.userId !== args.userId) return []

    const events = await ctx.db
      .query('computerEvents')
      .withIndex('by_computerId_createdAt', (q) => q.eq('computerId', args.computerId))
      .order('asc')
      .collect()

    return events.filter((event) =>
      Boolean(event.sessionKey) ||
      event.type === 'chat_user' ||
      event.type === 'chat_assistant' ||
      event.type === 'chat_error'
    )
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
      hooksToken: await deriveHooksToken(computer.gatewayToken),
      hetznerServerIp: computer.hetznerServerIp,
    }
  },
})

export const getTerminalAccess = query({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  returns: v.object({ terminalUrl: v.string() }),
  handler: async (ctx, args): Promise<{ terminalUrl: string }> => {
    await authorizeUserAccess(args)
    const computer = await ctx.runQuery(internal.computers.getInternal, { computerId: args.computerId })
    if (!computer || computer.userId !== args.userId) {
      throw new Error('Computer not found')
    }
    if (computer.status !== 'ready' || !computer.hetznerServerIp || !computer.gatewayToken) {
      throw new Error('Computer is not ready')
    }
    const terminalToken = computer.gatewayToken.slice(0, 32)
    return {
      terminalUrl: `http://overlay:${terminalToken}@${computer.hetznerServerIp}:18790/`,
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
    sessionKey: v.optional(v.string()),
    sessionTitle: v.optional(v.string()),
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
      sessionKey: args.sessionKey,
      sessionTitle: args.sessionTitle,
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
    sessionKey: v.optional(v.string()),
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
      sessionKey: args.sessionKey,
      createdAt: Date.now(),
    })

    return { ok: true }
  },
})

export const recordSessionEvent = mutation({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    type: v.string(),
    message: v.string(),
    sessionKey: v.string(),
    sessionTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess(args)

    const computer = await ctx.db.get(args.computerId)
    if (!computer || computer.userId !== args.userId) {
      throw new Error('Computer not found')
    }

    await ctx.db.insert('computerEvents', {
      computerId: args.computerId,
      type: args.type,
      message: args.message,
      sessionKey: args.sessionKey,
      sessionTitle: args.sessionTitle,
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

export const resolveComputerApiToken = query({
  args: {
    tokenHash: v.string(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validateServerSecret(args.serverSecret)) {
      throw new Error('Unauthorized')
    }
    const computer = await ctx.db
      .query('computers')
      .withIndex('by_computerApiTokenHash', (q) => q.eq('computerApiTokenHash', args.tokenHash))
      .first()

    if (!computer || computer.status === 'deleted') {
      return null
    }

    return {
      computerId: computer._id,
      userId: computer.userId,
      tokenVersion: computer.computerApiTokenVersion ?? 1,
      status: computer.status,
      name: computer.name,
      region: computer.region,
      provisioningStep: computer.provisioningStep ?? null,
    }
  },
})

export const touchComputerApiTokenUse = mutation({
  args: {
    computerId: v.id('computers'),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validateServerSecret(args.serverSecret)) {
      throw new Error('Unauthorized')
    }
    await ctx.db.patch(args.computerId, {
      computerApiTokenLastUsedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
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

    const isBootstrapReprovision =
      computer.status === 'provisioning' && computer.provisioningStep === 'creating_server'
    if (computer.status !== 'pending_payment' && !isBootstrapReprovision) {
      console.log(`${TAG} provisionComputer — SKIP status=${computer.status}`)
      return
    }

    try {
      const claimed = await ctx.runMutation(internal.computers.beginProvisioning, { computerId }) as boolean
      if (!claimed) {
        console.log(`${TAG} provisionComputer — SKIP: computer already claimed for provisioning`)
        return
      }

      const HETZNER_TOKEN = process.env.HETZNER_API_TOKEN!
      const CONVEX_HTTP_URL = process.env.CONVEX_HTTP_URL!
      const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY!
      const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
      const OVERLAY_API_BASE_URL = (
        process.env.COMPUTER_PUBLIC_API_BASE_URL?.trim() ||
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        process.env.DEV_NEXT_PUBLIC_APP_URL?.trim() ||
        'https://www.getoverlay.io'
      ).replace(/\/+$/, '')

      if (!HETZNER_TOKEN) console.error(`${TAG} provisionComputer — WARNING: HETZNER_API_TOKEN is not set`)
      if (!CONVEX_HTTP_URL) console.error(`${TAG} provisionComputer — WARNING: CONVEX_HTTP_URL is not set`)
      if (!AI_GATEWAY_API_KEY) console.error(`${TAG} provisionComputer — WARNING: AI_GATEWAY_API_KEY is not set`)
      if (!AI_GATEWAY_API_KEY) throw new Error('AI_GATEWAY_API_KEY is not configured')

      const location = 'ash'
      const sshKeyId = getRequiredHetznerSshKeyId()
      const sshSourceIps = getRequiredHetznerSshSourceIps()
      const resourceSuffix = Date.now().toString(36)
      const desiredRelease =
        (computer.desiredReleaseVersion
          ? await ctx.runQuery(internal.computers.getReleaseByVersionInternal, {
              version: computer.desiredReleaseVersion,
            })
          : await ctx.runQuery(internal.computers.getLatestReleaseForChannelInternal, {
              channel:
                (computer.updateChannel as ComputerUpdateChannel | undefined) ??
                DEFAULT_COMPUTER_UPDATE_CHANNEL,
            })) ?? buildDefaultReleaseRecord()
      console.log(`${TAG} provisionComputer — using Hetzner location=${location} for region=${computer.region}`)
      await assertComputerPublicApiSupportsPluginBundle(OVERLAY_API_BASE_URL)

      const userdata = buildCloudInit({
        gatewayToken: computer.gatewayToken!,
        hooksToken: await deriveHooksToken(computer.gatewayToken!),
        readySecret: computer.readySecret!,
        computerApiToken: computer.computerApiToken!,
        computerId: computerId,
        updateChannel:
          (computer.updateChannel as ComputerUpdateChannel | undefined) ??
          DEFAULT_COMPUTER_UPDATE_CHANNEL,
        desiredReleaseVersion:
          computer.desiredReleaseVersion || desiredRelease.version,
        openclawImage: desiredRelease.openclawImage,
        toolBundleVersion: desiredRelease.toolBundleVersion,
        overlayPluginVersion: resolveOverlayPluginVersion(desiredRelease),
        configVersion: desiredRelease.configVersion,
        convexHttpUrl: CONVEX_HTTP_URL,
        overlayApiBaseUrl: OVERLAY_API_BASE_URL,
        aiGatewayApiKey: AI_GATEWAY_API_KEY,
        openrouterApiKey: OPENROUTER_API_KEY,
      })
      console.log(`${TAG} provisionComputer — cloud-init built (${userdata.length} chars)`)

      // ── Step 1: Create firewall first so we can attach it at server creation ─
      console.log(`${TAG} provisionComputer — calling Hetzner POST /v1/firewalls (ports 22, 18789, 18790)`)
      const fwRes = await retryFetch(
        'https://api.hetzner.cloud/v1/firewalls',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${HETZNER_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `overlay-fw-${computerId}-${resourceSuffix}`.slice(0, 63),
            rules: [
              { direction: 'in', protocol: 'tcp', port: '22',    source_ips: sshSourceIps },
              { direction: 'in', protocol: 'tcp', port: '18789', source_ips: ['0.0.0.0/0', '::/0'] },
              { direction: 'in', protocol: 'tcp', port: '18790', source_ips: ['0.0.0.0/0', '::/0'] },
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
            name: `overlay-computer-${computerId}-${resourceSuffix}`.slice(0, 63),
            server_type: 'cpx21',
            image: 'ubuntu-24.04',
            location,
            user_data: userdata,
            firewalls: [{ firewall: firewallId }],
            ssh_keys: [sshKeyId],
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

export const confirmGatewayReadyExternally = internalAction({
  args: {
    computerId: v.id('computers'),
    readySecret: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    console.log(
      `${TAG} confirmGatewayReadyExternally — START computerId=${redactIdentifierForLog(args.computerId)}`
    )

    const computer = await ctx.runQuery(internal.computers.getInternal, {
      computerId: args.computerId,
    })

    if (!computer) {
      throw new Error('Computer not found')
    }

    if (computer.readySecret !== args.readySecret) {
      throw new Error('Invalid readySecret')
    }

    if (!computer.hetznerServerIp || !computer.gatewayToken) {
      throw new Error('Computer is missing gateway connection details')
    }

    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        const response = await fetch(`http://${computer.hetznerServerIp}:18789/healthz`, {
          signal: AbortSignal.timeout(5000),
          headers: { Authorization: `Bearer ${computer.gatewayToken}` },
        })

        console.log(
          `${TAG} confirmGatewayReadyExternally — attempt=${attempt + 1} status=${response.status}`
        )

        if (response.ok) {
          await ctx.runMutation(internal.computers.setReady, {
            computerId: args.computerId,
            readySecret: args.readySecret,
          })
          await ctx.runMutation(internal.computers.logEvent, {
            computerId: args.computerId,
            type: 'status_change',
            message: 'OpenClaw gateway is externally reachable and ready.',
          })
          return { ok: true }
        }
      } catch (error) {
        console.warn(
          `${TAG} confirmGatewayReadyExternally — attempt=${attempt + 1} failed: ${summarizeErrorForLog(error)}`
        )
      }

      await sleep(5000)
    }

    await ctx.runMutation(internal.computers.logEvent, {
      computerId: args.computerId,
      type: 'status_change',
      message: 'Gateway reported local health but external reachability is still pending.',
    })
    return { ok: false }
  },
})

export const deleteComputerInstance = action({
  args: {
    computerId: v.id('computers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { computerId, userId, accessToken, serverSecret }) => {
    console.log(
      `${TAG} deleteComputerInstance — START computerId=${redactIdentifierForLog(computerId)}`
    )

    await authorizeUserAccess({
      accessToken,
      serverSecret,
      userId,
    })

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

export const cleanupDetachedComputerResources = internalAction({
  args: {
    computerId: v.id('computers'),
    hetznerServerId: v.optional(v.number()),
    hetznerFirewallId: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    console.log(
      `${TAG} cleanupDetachedComputerResources — START computerId=${redactIdentifierForLog(args.computerId)}`
    )

    const HETZNER_TOKEN = process.env.HETZNER_API_TOKEN!
    if (!HETZNER_TOKEN) {
      throw new Error('HETZNER_API_TOKEN not configured')
    }

    if (args.hetznerServerId) {
      await ensureServerDeleted(args.hetznerServerId, HETZNER_TOKEN)
    }

    if (args.hetznerFirewallId) {
      await ensureFirewallDeleted(args.hetznerFirewallId, HETZNER_TOKEN)
    }

    console.log(
      `${TAG} cleanupDetachedComputerResources — COMPLETE computerId=${redactIdentifierForLog(args.computerId)}`
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

async function deriveHooksToken(gatewayToken: string): Promise<string> {
  const salt = process.env.HOOKS_TOKEN_SALT?.trim()
  if (!salt) {
    throw new Error('HOOKS_TOKEN_SALT is not configured')
  }

  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(gatewayToken))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
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
  computerApiToken: string
  computerId: string
  updateChannel: ComputerUpdateChannel
  desiredReleaseVersion: string
  openclawImage: string
  toolBundleVersion: string
  overlayPluginVersion: string
  configVersion: string
  convexHttpUrl: string
  overlayApiBaseUrl: string
  aiGatewayApiKey: string
  openrouterApiKey?: string
}

function buildCloudInit(p: CloudInitParams): string {
  return CLOUD_INIT_TEMPLATE
    .replaceAll('{{GATEWAY_TOKEN}}',    p.gatewayToken)
    .replaceAll('{{HOOKS_TOKEN}}',      p.hooksToken)
    .replaceAll('{{READY_SECRET}}',     p.readySecret)
    .replaceAll('{{COMPUTER_API_TOKEN}}', p.computerApiToken)
    .replaceAll('{{COMPUTER_ID}}',      p.computerId)
    .replaceAll('{{UPDATE_CHANNEL}}',   p.updateChannel)
    .replaceAll('{{DESIRED_RELEASE_VERSION}}', p.desiredReleaseVersion)
    .replaceAll('{{OPENCLAW_IMAGE}}',   p.openclawImage)
    .replaceAll('{{TOOL_BUNDLE_VERSION}}', p.toolBundleVersion)
    .replaceAll('{{OVERLAY_PLUGIN_VERSION}}', p.overlayPluginVersion)
    .replaceAll('{{CONFIG_VERSION}}',   p.configVersion)
    .replaceAll('{{PLUGIN_ID}}', OPENCLAW_OVERLAY_PLUGIN_ID)
    .replaceAll('{{UPDATER_VERSION}}',  DEFAULT_COMPUTER_UPDATER_VERSION)
    .replaceAll('{{UPDATER_POLL_SECONDS}}', String(DEFAULT_COMPUTER_UPDATER_POLL_SECONDS))
    .replaceAll('{{CONVEX_HTTP_URL}}',  p.convexHttpUrl)
    .replaceAll('{{OVERLAY_API_BASE_URL}}', p.overlayApiBaseUrl)
    .replaceAll('{{AI_GATEWAY_API_KEY}}', p.aiGatewayApiKey)
    .replaceAll('{{OPENROUTER_API_KEY}}', p.openrouterApiKey ?? '')
    .replaceAll('{{MODEL_ALLOWLIST_JSON}}', buildComputerModelsAllowlistJson())
    .replaceAll('{{TERMINAL_TOKEN}}',   p.gatewayToken.slice(0, 32))
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
      OPENCLAW_IMAGE={{OPENCLAW_IMAGE}}
      OPENCLAW_GATEWAY_TOKEN={{GATEWAY_TOKEN}}
      OPENCLAW_HOOKS_TOKEN={{HOOKS_TOKEN}}
      OVERLAY_API_BASE_URL={{OVERLAY_API_BASE_URL}}
      OVERLAY_COMPUTER_API_TOKEN={{COMPUTER_API_TOKEN}}
      OVERLAY_UPDATER_VERSION={{UPDATER_VERSION}}
      OVERLAY_UPDATE_CHANNEL={{UPDATE_CHANNEL}}
      OVERLAY_UPDATE_POLL_SECONDS={{UPDATER_POLL_SECONDS}}
      OVERLAY_DESIRED_RELEASE_VERSION={{DESIRED_RELEASE_VERSION}}
      OVERLAY_TOOL_BUNDLE_VERSION={{TOOL_BUNDLE_VERSION}}
      OVERLAY_DESIRED_PLUGIN_VERSION={{OVERLAY_PLUGIN_VERSION}}
      OVERLAY_CONFIG_VERSION={{CONFIG_VERSION}}

  - path: /etc/ssh/sshd_config.d/99-overlay-hardening.conf
    permissions: '0644'
    content: |
      PasswordAuthentication no
      KbdInteractiveAuthentication no
      PermitRootLogin prohibit-password
      PubkeyAuthentication yes

  - path: /root/openclaw-deploy/docker-compose.yml
    permissions: '0644'
    content: |
      services:
        openclaw-gateway:
          image: \${OPENCLAW_IMAGE}
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

  - path: /etc/overlay-release.json
    permissions: '0644'
    content: |
      {
        "updaterVersion": "{{UPDATER_VERSION}}",
        "updateChannel": "{{UPDATE_CHANNEL}}",
        "lastAppliedRelease": null,
        "lastAttemptedRelease": "{{DESIRED_RELEASE_VERSION}}",
        "lastSuccessAt": null,
        "toolBundleVersion": "{{TOOL_BUNDLE_VERSION}}",
        "overlayPluginVersion": "{{OVERLAY_PLUGIN_VERSION}}",
        "configVersion": "{{CONFIG_VERSION}}"
      }

  - path: /etc/systemd/system/ttyd.service
    permissions: '0644'
    content: |
      [Unit]
      Description=Web terminal (ttyd)
      After=network.target

      [Service]
      Type=simple
      ExecStart=/usr/local/bin/ttyd -W --port 18790 -c overlay:{{TERMINAL_TOKEN}} /usr/local/bin/overlay-terminal-shell
      Restart=always
      RestartSec=5

      [Install]
      WantedBy=multi-user.target

  - path: /usr/local/bin/overlay-terminal-shell
    permissions: '0755'
    content: |
      #!/usr/bin/env bash
      set -euo pipefail
      cd /root/.openclaw/workspace
      exec /bin/bash -l

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

  - path: /usr/local/bin/docker-openclaw
    permissions: '0755'
    content: |
      #!/usr/bin/env bash
      set -euo pipefail
      cd /root/openclaw-deploy
      exec docker run --rm \\
        --env-file /root/openclaw-deploy/.env \\
        -e HOME=/home/node \\
        -e NODE_ENV=production \\
        -e TERM=xterm-256color \\
        -e OPENCLAW_GATEWAY_TOKEN="$OPENCLAW_GATEWAY_TOKEN" \\
        -e AI_GATEWAY_API_KEY="$AI_GATEWAY_API_KEY" \\
        -e OPENROUTER_API_KEY="$OPENROUTER_API_KEY" \\
        -e OPENCLAW_SKIP_CHANNELS=1 \\
        -e OPENCLAW_SKIP_CRON=1 \\
        -e OPENCLAW_SKIP_GMAIL_WATCHER=1 \\
        -e OPENCLAW_SKIP_CANVAS_HOST=1 \\
        -v /root/.openclaw:/home/node/.openclaw \\
        "$OPENCLAW_IMAGE" \\
        "$@"

  - path: /usr/local/bin/overlay-sync-plugin
    permissions: '0755'
    content: |
      #!/usr/bin/env python3
      import json
      import os
      import subprocess
      import urllib.error
      import urllib.parse
      import urllib.request

      BASE_URL = os.environ.get('OVERLAY_API_BASE_URL', '').rstrip('/')
      TOKEN = os.environ.get('OVERLAY_COMPUTER_API_TOKEN', '').strip()
      PLUGIN_DIR = '/root/.openclaw/extensions/{{PLUGIN_ID}}'

      def api_request(path: str):
        if not BASE_URL or not TOKEN:
          raise RuntimeError('Overlay plugin sync is missing API configuration.')
        request = urllib.request.Request(
          f'{BASE_URL}{path}',
          headers={'Authorization': f'Bearer {TOKEN}'},
          method='GET',
        )
        try:
          with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode('utf-8')
            return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
          body = exc.read().decode('utf-8', errors='ignore')
          raise RuntimeError(f'Overlay plugin bundle request failed: HTTP {exc.code} {body[:240]}') from exc

      def post_json(path: str, payload):
        if not BASE_URL or not TOKEN:
          return
        data = json.dumps(payload).encode('utf-8')
        request = urllib.request.Request(
          f'{BASE_URL}{path}',
          data=data,
          headers={
            'Authorization': f'Bearer {TOKEN}',
            'Content-Type': 'application/json',
          },
          method='POST',
        )
        try:
          with urllib.request.urlopen(request, timeout=30):
            return
        except Exception:
          return

      def write_bundle(bundle):
        os.makedirs(PLUGIN_DIR, exist_ok=True)
        files = bundle.get('files') or {}
        if not isinstance(files, dict) or not files:
          raise RuntimeError('Overlay plugin bundle did not include any files.')
        for relative_path, content in files.items():
          target_path = os.path.join(PLUGIN_DIR, relative_path)
          os.makedirs(os.path.dirname(target_path), exist_ok=True)
          with open(target_path, 'w', encoding='utf-8') as handle:
            handle.write(content if isinstance(content, str) else '')

      def run(command):
        subprocess.run(command, check=True)

      def main():
        desired_version = os.environ.get('OVERLAY_DESIRED_PLUGIN_VERSION', '').strip()
        query = ''
        if desired_version:
          query = f'?version={urllib.parse.quote(desired_version)}'
        bundle = api_request(f'/api/computer/v1/plugin/bundle{query}')
        bundle_version = (bundle.get('version') or '').strip()
        write_bundle(bundle)
        post_json('/api/computer/v1/plugin/health', {
          'status': 'installing',
          'installedVersion': bundle_version or None,
          'message': f'Installing Overlay plugin {bundle_version or "unknown"}.',
        })
        run(['docker-openclaw', 'sh', '-lc', 'cd /home/node/.openclaw/extensions/{{PLUGIN_ID}} && npm install --omit=dev --ignore-scripts'])
        run(['docker-openclaw', 'openclaw', 'config', 'set', 'plugins.entries.{{PLUGIN_ID}}.enabled', 'true', '--strict-json'])
        run(['docker-openclaw', 'openclaw', 'config', 'set', 'plugins.entries.{{PLUGIN_ID}}.hooks.allowPromptInjection', 'true', '--strict-json'])
        run([
          'docker-openclaw',
          'openclaw',
          'config',
          'set',
          'plugins.entries.{{PLUGIN_ID}}.config',
          json.dumps({
            'overlayApiBaseUrl': BASE_URL,
            'computerApiToken': TOKEN,
            'enabledToolGroups': ['notes', 'knowledge', 'files', 'memories', 'outputs', 'integrations'],
            'timeoutMs': 15000,
          }),
          '--strict-json',
        ])
        run(['docker-openclaw', 'openclaw', 'plugins', 'info', '{{PLUGIN_ID}}'])
        post_json('/api/computer/v1/plugin/health', {
          'status': 'installed',
          'installedVersion': bundle_version or None,
          'message': f'Overlay plugin {bundle_version or "unknown"} installed.',
        })

      try:
        main()
      except Exception as exc:
        post_json('/api/computer/v1/plugin/health', {
          'status': 'error',
          'installedVersion': None,
          'message': str(exc),
        })
        raise

  - path: /usr/local/bin/overlay-updater
    permissions: '0755'
    content: |
      #!/usr/bin/env python3
      import json
      import os
      import subprocess
      import sys
      import time
      import urllib.error
      import urllib.request

      BASE_URL = os.environ.get('OVERLAY_API_BASE_URL', '').rstrip('/')
      TOKEN = os.environ.get('OVERLAY_COMPUTER_API_TOKEN', '').strip()
      RELEASE_FILE = '/etc/overlay-release.json'
      ENV_FILE = '/root/openclaw-deploy/.env'
      COMPOSE_DIR = '/root/openclaw-deploy'
      WORKSPACE_DIR = '/root/.openclaw/workspace'
      UPDATER_VERSION = os.environ.get('OVERLAY_UPDATER_VERSION', '{{UPDATER_VERSION}}')

      def api_request(method: str, path: str, payload=None):
        if not BASE_URL or not TOKEN:
          raise RuntimeError('Overlay updater is missing required API configuration.')

        data = None
        headers = {
          'Authorization': f'Bearer {TOKEN}',
        }

        if payload is not None:
          data = json.dumps(payload).encode('utf-8')
          headers['Content-Type'] = 'application/json'

        request = urllib.request.Request(f'{BASE_URL}{path}', data=data, method=method, headers=headers)
        try:
          with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode('utf-8')
            return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
          body = exc.read().decode('utf-8', errors='ignore')
          raise RuntimeError(f'Overlay API {path} failed: HTTP {exc.code} {body[:240]}') from exc

      def read_release_file():
        try:
          with open(RELEASE_FILE, 'r', encoding='utf-8') as handle:
            return json.load(handle)
        except Exception:
          return {
            'updaterVersion': UPDATER_VERSION,
            'lastAppliedRelease': None,
            'lastAttemptedRelease': None,
            'lastSuccessAt': None,
          }

      def write_release_file(payload):
        with open(RELEASE_FILE, 'w', encoding='utf-8') as handle:
          json.dump(payload, handle, indent=2)
          handle.write('\\n')

      def update_env_file(updates):
        lines = []
        if os.path.exists(ENV_FILE):
          with open(ENV_FILE, 'r', encoding='utf-8') as handle:
            lines = handle.read().splitlines()

        env_map = {}
        order = []
        for line in lines:
          if '=' not in line:
            continue
          key, value = line.split('=', 1)
          env_map[key] = value
          order.append(key)

        for key, value in updates.items():
          env_map[key] = value
          if key not in order:
            order.append(key)

        with open(ENV_FILE, 'w', encoding='utf-8') as handle:
          for key in order:
            handle.write(f'{key}={env_map[key]}\\n')

      def run_command(command, *, cwd=None):
        subprocess.run(command, cwd=cwd, check=True)

      def report(status, target_version, *, message=None, step=None, started_at=None, completed_at=None):
        body = {
          'status': status,
          'targetVersion': target_version,
        }
        if message:
          body['message'] = message
        if step:
          body['step'] = step
        if started_at:
          body['startedAt'] = started_at
        if completed_at:
          body['completedAt'] = completed_at
        return api_request('POST', '/api/computer/v1/update/report', body)

      def wait_for_health(timeout_seconds=450):
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
          try:
            with urllib.request.urlopen('http://127.0.0.1:18789/healthz', timeout=5) as response:
              if response.status == 200:
                return
          except Exception:
            time.sleep(5)
        raise RuntimeError('OpenClaw health check timed out after restart.')

      def main():
        started_at = int(time.time() * 1000)
        target_version = os.environ.get('OVERLAY_DESIRED_RELEASE_VERSION', '').strip() or 'unknown'

        try:
          try:
            check = api_request('POST', '/api/computer/v1/update/check', {})
          except Exception as exc:
            message = str(exc)
            if 'HTTP 307' in message or 'HTTP 308' in message or 'HTTP 404' in message:
              print(f'Overlay update API unavailable at {BASE_URL}; skipping updater run.', file=sys.stderr)
              return 0
            raise
          update = check.get('update') or {}
          desired_release = check.get('desiredRelease') or {}
          manifest = desired_release.get('manifest') or {}

          target_version = update.get('desiredReleaseVersion') or desired_release.get('version') or target_version
          applied_release = update.get('appliedReleaseVersion')
          strategy = desired_release.get('updateStrategy') or manifest.get('updateStrategy') or 'in_place'
          image = manifest.get('openclawImage') or desired_release.get('openclawImage')
          tool_bundle_version = manifest.get('toolBundleVersion') or desired_release.get('toolBundleVersion')
          overlay_plugin_version = manifest.get('overlayPluginVersion') or desired_release.get('overlayPluginVersion')
          config_version = manifest.get('configVersion') or desired_release.get('configVersion')
          update_channel = update.get('updateChannel') or desired_release.get('channel') or os.environ.get('OVERLAY_UPDATE_CHANNEL', 'stable')

          if not desired_release:
            return 0

          release_state = read_release_file()
          release_state['updaterVersion'] = UPDATER_VERSION
          release_state['lastAttemptedRelease'] = target_version
          release_state['updateChannel'] = update_channel
          write_release_file(release_state)

          if applied_release == target_version and update.get('updateStatus') == 'ready':
            release_state['lastAppliedRelease'] = target_version
            release_state['lastSuccessAt'] = int(time.time() * 1000)
            write_release_file(release_state)
            report(
              'ready',
              target_version,
              message=f'Release {target_version} already applied.',
              started_at=started_at,
              completed_at=int(time.time() * 1000),
            )
            return 0

          if strategy == 'reprovision_required':
            report(
              'reprovision_required',
              target_version,
              message=f'Release {target_version} requires reprovisioning.',
              started_at=started_at,
              completed_at=int(time.time() * 1000),
            )
            return 0

          report('checking', target_version, message=f'Checking release {target_version}.', started_at=started_at)

          update_env_file({
            'OPENCLAW_IMAGE': image or os.environ.get('OPENCLAW_IMAGE', '{{OPENCLAW_IMAGE}}'),
            'OVERLAY_TOOL_BUNDLE_VERSION': tool_bundle_version or os.environ.get('OVERLAY_TOOL_BUNDLE_VERSION', '{{TOOL_BUNDLE_VERSION}}'),
            'OVERLAY_DESIRED_PLUGIN_VERSION': overlay_plugin_version or os.environ.get('OVERLAY_DESIRED_PLUGIN_VERSION', '{{OVERLAY_PLUGIN_VERSION}}'),
            'OVERLAY_CONFIG_VERSION': config_version or os.environ.get('OVERLAY_CONFIG_VERSION', '{{CONFIG_VERSION}}'),
            'OVERLAY_DESIRED_RELEASE_VERSION': target_version,
            'OVERLAY_UPDATE_CHANNEL': str(update_channel),
            'OVERLAY_UPDATER_VERSION': UPDATER_VERSION,
          })

          report('downloading', target_version, message=f'Pulling image for release {target_version}.', started_at=started_at)
          run_command(['docker', 'compose', 'pull', 'openclaw-gateway'], cwd=COMPOSE_DIR)

          report('applying', target_version, message='Applying updated Overlay computer configuration.', started_at=started_at)
          run_command(['/usr/local/bin/overlay-sync-plugin'])
          run_command(['docker', 'compose', 'up', '-d', '--force-recreate', 'openclaw-gateway'], cwd=COMPOSE_DIR)

          report('restarting', target_version, message='Restarting OpenClaw gateway.', started_at=started_at)
          wait_for_health()

          report('verifying', target_version, message='Verifying gateway and workspace health.', started_at=started_at)
          api_request('GET', '/api/computer/v1/context')
          run_command(['/usr/local/bin/openclaw', 'plugins', 'info', '{{PLUGIN_ID}}'])
          if not os.path.isdir(WORKSPACE_DIR):
            raise RuntimeError(f'Workspace path is missing: {WORKSPACE_DIR}')

          completed_at = int(time.time() * 1000)
          release_state = read_release_file()
          release_state['updaterVersion'] = UPDATER_VERSION
          release_state['lastAttemptedRelease'] = target_version
          release_state['lastAppliedRelease'] = target_version
          release_state['lastSuccessAt'] = completed_at
          release_state['toolBundleVersion'] = tool_bundle_version
          release_state['overlayPluginVersion'] = overlay_plugin_version
          release_state['configVersion'] = config_version
          release_state['updateChannel'] = update_channel
          write_release_file(release_state)

          report(
            'ready',
            target_version,
            message=f'Release {target_version} applied successfully.',
            started_at=started_at,
            completed_at=completed_at,
          )
          return 0
        except Exception as exc:
          completed_at = int(time.time() * 1000)
          try:
            report(
              'error',
              target_version,
              message=str(exc),
              started_at=started_at,
              completed_at=completed_at,
            )
          except Exception:
            pass
          print(str(exc), file=sys.stderr)
          return 1

      raise SystemExit(main())

  - path: /etc/systemd/system/overlay-updater.service
    permissions: '0644'
    content: |
      [Unit]
      Description=Overlay computer updater
      Wants=network-online.target docker.service
      After=network-online.target docker.service

      [Service]
      Type=oneshot
      EnvironmentFile=/root/openclaw-deploy/.env
      WorkingDirectory=/root/openclaw-deploy
      ExecStart=/usr/local/bin/overlay-updater

  - path: /etc/systemd/system/overlay-updater.timer
    permissions: '0644'
    content: |
      [Unit]
      Description=Run Overlay computer updater every {{UPDATER_POLL_SECONDS}} seconds

      [Timer]
      OnBootSec=120
      OnUnitActiveSec={{UPDATER_POLL_SECONDS}}
      Unit=overlay-updater.service

      [Install]
      WantedBy=timers.target

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

      clog "VPS setup started"

      # Step 1: Install Docker CE
      curl -fsSL https://get.docker.com | sh
      systemctl enable --now docker
      clog "Docker CE installed and daemon started"

      # Step 2: Install ttyd web terminal
      curl -fsSL https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 -o /usr/local/bin/ttyd
      chmod +x /usr/local/bin/ttyd
      systemctl daemon-reload
      systemctl enable ttyd
      systemctl start ttyd
      clog "ttyd web terminal started on port 18790"

      # Step 3: Prepare directories
      mkdir -p /root/.openclaw/workspace
      chown -R 1000:1000 /root/.openclaw
      clog "Installed host openclaw wrapper"

      # Step 4: Pull the prebuilt OpenClaw image and configure it through the CLI
      clog "Pulling prebuilt OpenClaw image..."
      cd /root/openclaw-deploy
      set -a
      . /root/openclaw-deploy/.env
      set +a
      docker compose pull
      clog "OpenClaw image pulled. Running CLI onboarding..."

      docker-openclaw openclaw onboard --non-interactive \\
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

      docker-openclaw openclaw config set agents.defaults.models '{{MODEL_ALLOWLIST_JSON}}' --strict-json
      docker-openclaw openclaw models set vercel-ai-gateway/anthropic/claude-sonnet-4.6

      docker-openclaw openclaw config set gateway.http.endpoints.chatCompletions.enabled true --strict-json
      docker-openclaw openclaw config set gateway.controlUi.enabled true --strict-json
      docker-openclaw openclaw config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true --strict-json
      docker-openclaw openclaw config set hooks.enabled true --strict-json
      docker-openclaw openclaw config set hooks.path /hooks
      docker-openclaw openclaw config set hooks.token "$OPENCLAW_HOOKS_TOKEN"
      docker-openclaw openclaw config set hooks.defaultSessionKey hook:computer:default
      docker-openclaw openclaw config set hooks.allowRequestSessionKey true --strict-json
      docker-openclaw openclaw config set hooks.allowedSessionKeyPrefixes '["hook:computer:"]' --strict-json
      docker-openclaw openclaw config set hooks.allowedAgentIds '["default"]' --strict-json
      docker-openclaw openclaw config set cron.enabled false --strict-json

      clog "Installing Overlay OpenClaw plugin..."
      /usr/local/bin/overlay-sync-plugin

      docker-openclaw openclaw config validate

      clog "OpenClaw config validated. Starting container..."

      docker compose up -d
      clog "Docker container started. Waiting for healthz..."

      # Step 5: Wait for OpenClaw to be healthy (90 x 5s = 7.5 min)
      for i in $(seq 1 90); do
        if curl -sf --max-time 5 http://localhost:18789/healthz > /dev/null 2>&1; then
          /usr/local/bin/openclaw plugins info {{PLUGIN_ID}} > /dev/null
          curl -s -X POST "$CONVEX_URL/computer/ready" \\
            -H "Content-Type: application/json" \\
            -d "{\\"computerId\\":\\"$COMPUTER_ID\\",\\"readySecret\\":\\"{{READY_SECRET}}\\"}"
          systemctl enable --now overlay-updater.timer || true
          systemctl start overlay-updater.service || true
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
  - systemctl restart ssh
  - /root/provision.sh
`
