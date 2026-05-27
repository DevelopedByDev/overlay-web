import { generateObject } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { z } from 'zod'
import {
  callConvex,
  getInternalApiSecret,
  loadLocalEnv,
  readArg,
  resolveTargets,
  type DeploymentTarget,
} from './convex-admin-utils.ts'

const TITLE_MODEL = 'nvidia/nemotron-nano-9b-v2'
const FALLBACK_TITLE = 'New Chat'

const titleSchema = z.object({
  title: z.string().describe('A concise chat title, 3 to 6 words, natural title case, no trailing punctuation'),
})

type ConversationRecord = {
  _id: string
  title: string
  projectId?: string
  userId: string
  lastModified: number
  createdAt: number
}

type MessagePart = {
  type: string
  text?: string
  fileName?: string
}

type MessageRecord = {
  _id: string
  conversationId: string
  role: 'user' | 'assistant'
  content?: string
  parts?: MessagePart[]
  createdAt: number
  status?: string
}

function readBooleanArg(name: string, fallback: boolean): boolean {
  const value = readArg(name)
  if (value == null) return fallback
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes'
}

function extractMessageText(message: MessageRecord): string {
  const direct = (message.content || '').trim()
  if (direct) return direct
  if (Array.isArray(message.parts)) {
    const partText = message.parts
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => (part.text || '').trim())
      .filter(Boolean)
      .join(' ')
    if (partText) return partText
    const fileNames = message.parts
      .map((part) => part?.fileName)
      .filter((name): name is string => typeof name === 'string' && name.length > 0)
    if (fileNames.length > 0) return fileNames.join(', ')
  }
  return ''
}

function sanitizeTitle(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'`""]+|["'`""]+$/g, '')
    .replace(/[.!?,;:]+$/g, '')
    .trim()
    .slice(0, 60)
    .trim()
}

function snippet(text: string, max = 60): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed
}

async function processTarget(target: DeploymentTarget, args: {
  serverSecret: string
  userId: string
  dryRun: boolean
  maxCount: number
  apiKey: string
  gatewayUrl: string
}) {
  const { serverSecret, userId, dryRun, maxCount, apiKey, gatewayUrl } = args

  const gateway = createOpenAICompatible({
    name: 'gateway',
    apiKey,
    baseURL: gatewayUrl,
  })
  const model = gateway(TITLE_MODEL)

  console.log(`\n[${target.toUpperCase()}] backfill${dryRun ? ' (dry run)' : ''}`)

  const conversations = await callConvex<ConversationRecord[]>(
    target,
    'query',
    'chat/conversations:listAllForUserAdmin',
    { serverSecret, userId },
  )

  const candidates = conversations
    .filter((conversation) => conversation.title === FALLBACK_TITLE)
    .slice(0, maxCount)

  console.log(`Found ${conversations.length} total conversations; ${candidates.length} match "${FALLBACK_TITLE}" (cap ${Number.isFinite(maxCount) ? maxCount : 'none'})`)

  let updated = 0
  let skippedNoMessage = 0
  let skippedEmptyText = 0
  let skippedEmptyTitle = 0
  let failed = 0

  for (const conversation of candidates) {
    const messages = await callConvex<MessageRecord[]>(
      target,
      'query',
      'chat/conversations:getMessages',
      { serverSecret, userId, conversationId: conversation._id },
    )
    const firstUser = messages.find((message) => message.role === 'user')
    if (!firstUser) {
      console.log(`  SKIP ${conversation._id} — no user message`)
      skippedNoMessage++
      continue
    }
    const text = extractMessageText(firstUser)
    if (!text) {
      console.log(`  SKIP ${conversation._id} — empty user message`)
      skippedEmptyText++
      continue
    }

    let generatedTitle: string
    try {
      const result = await generateObject({
        model,
        schema: titleSchema,
        system:
          'You write short, precise chat titles. Capture the actual topic, not the first words.',
        temperature: 0.2,
        maxOutputTokens: 80,
        prompt: `Generate a concise title for a conversation that starts with this message:\n\n${text.slice(0, 1200)}`,
      })
      generatedTitle = sanitizeTitle(result.object.title || '')
    } catch (error) {
      console.error(`  FAIL ${conversation._id} — title generation: ${error instanceof Error ? error.message : String(error)}`)
      failed++
      continue
    }

    if (!generatedTitle || generatedTitle === FALLBACK_TITLE) {
      console.log(`  SKIP ${conversation._id} — model produced empty title`)
      skippedEmptyTitle++
      continue
    }

    console.log(`  ${dryRun ? 'WOULD' : 'WILL'} retitle ${conversation._id}${conversation.projectId ? ' (in project)' : ''}`)
    console.log(`    to:   "${generatedTitle}"`)
    console.log(`    seed: "${snippet(text)}"`)

    if (!dryRun) {
      try {
        await callConvex(
          target,
          'mutation',
          'chat/conversations:update',
          { serverSecret, userId, conversationId: conversation._id, title: generatedTitle },
        )
        updated++
      } catch (error) {
        console.error(`  FAIL ${conversation._id} — update mutation: ${error instanceof Error ? error.message : String(error)}`)
        failed++
      }
    } else {
      updated++
    }
  }

  console.log(`\n[${target.toUpperCase()}] summary: ${updated} ${dryRun ? 'would be ' : ''}updated, ${skippedNoMessage + skippedEmptyText + skippedEmptyTitle} skipped (${skippedNoMessage} no-msg, ${skippedEmptyText} empty-text, ${skippedEmptyTitle} empty-title), ${failed} failed`)
}

async function resolveUserId(target: DeploymentTarget, serverSecret: string, explicitId: string | undefined): Promise<string> {
  if (explicitId) return explicitId
  const subs = await callConvex<Array<{ userId: string; email: string }>>(
    target,
    'query',
    'auth/users:listSubscriptionUserIdsAdmin',
    { serverSecret },
  )
  if (subs.length === 0) {
    throw new Error(`No subscription rows found on ${target}. Pass --user-id=<id> explicitly.`)
  }
  if (subs.length > 1) {
    const list = subs.map((sub) => `  - ${sub.userId} (${sub.email})`).join('\n')
    throw new Error(
      `Multiple users on ${target} (${subs.length}). Pass --user-id=<id> to disambiguate. Available:\n${list}`,
    )
  }
  console.log(`[${target.toUpperCase()}] auto-detected user: ${subs[0].userId} (${subs[0].email})`)
  return subs[0].userId
}

async function main() {
  loadLocalEnv()
  const serverSecret = getInternalApiSecret()
  const explicitUserId = readArg('user-id')
  const dryRun = readBooleanArg('dry-run', true)
  const limitArg = readArg('limit')
  const maxCount = limitArg ? Math.max(1, Number(limitArg)) : Number.POSITIVE_INFINITY
  const envArg = readArg('env', 'prod')
  const targets = resolveTargets(envArg)

  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Missing AI_GATEWAY_API_KEY in env')
  }
  const gatewayUrl =
    process.env.AI_GATEWAY_URL?.trim() || 'https://ai-gateway.vercel.sh/v1/chat/completions'

  for (const target of targets) {
    const userId = await resolveUserId(target, serverSecret, explicitUserId)
    await processTarget(target, { serverSecret, userId, dryRun, maxCount, apiKey, gatewayUrl })
  }

  if (dryRun) {
    console.log('\nDry run complete. Re-run with --dry-run=false to apply.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
