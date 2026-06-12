import { publicEnv } from '@/shared/env/public-env'

/**
 * Client-side TTFT milestones when NEXT_PUBLIC_TTFT_DEBUG=true.
 * Pair with server TTFT_DEBUG=true on /api/v1/conversations/act.
 */

let originMs: number | null = null
let turnId: string | null = null
let firstTextLogged = false
const milestones: Record<string, number> = {}

export function isTtftClientDebugEnabled(): boolean {
  return publicEnv.ttftDebug
}

export function beginTtftClientTurn(meta?: {
  turnId?: string
  model?: string
  isFirstMessage?: boolean
  parallelCreate?: boolean
}) {
  if (!isTtftClientDebugEnabled()) return
  originMs = performance.now()
  turnId = meta?.turnId ?? null
  firstTextLogged = false
  for (const key of Object.keys(milestones)) delete milestones[key]
  console.info('[TTFT][client] send', {
    turnId,
    ms: 0,
    ...meta,
  })
}

export function setTtftClientTurnId(id: string) {
  if (!isTtftClientDebugEnabled()) return
  turnId = id
}

export function markTtftClientMilestone(
  name: string,
  extra?: Record<string, unknown>,
) {
  if (!isTtftClientDebugEnabled() || originMs === null) return
  if (milestones[name] != null) return
  const ms = performance.now() - originMs
  milestones[name] = ms
  console.info(`[TTFT][client] ${name}`, {
    turnId,
    ms: +ms.toFixed(1),
    ...extra,
  })
}

export function tryLogTtftClientFirstText(): boolean {
  if (!isTtftClientDebugEnabled() || originMs === null || firstTextLogged) {
    return false
  }
  firstTextLogged = true
  const totalMs = performance.now() - originMs
  const milestoneSummary = Object.fromEntries(
    Object.entries(milestones).map(([key, value]) => [key, +value.toFixed(1)]),
  )
  console.info('[TTFT][client] first_text_visible', {
    turnId,
    total_ms: +totalMs.toFixed(1),
    milestones: milestoneSummary,
  })
  return true
}

export function wrapUiMessageStreamForTtft<T>(stream: ReadableStream<T>): ReadableStream<T> {
  if (!isTtftClientDebugEnabled()) return stream
  const decoder = new TextDecoder()
  let buf = ''
  let firstByteMarked = false
  let firstTextMarked = false
  return stream.pipeThrough(
    new TransformStream<T, T>({
      transform(chunk, controller) {
        if (!firstByteMarked) {
          firstByteMarked = true
          markTtftClientMilestone('first_sse_byte')
        }
        if (!firstTextMarked && typeof chunk === 'object' && chunk !== null) {
          const typed = chunk as { type?: string }
          if (typed.type === 'text-delta' || typed.type === 'text') {
            firstTextMarked = true
            markTtftClientMilestone('first_text_chunk')
          }
        }
        if (!firstTextMarked) {
          try {
            const asString = typeof chunk === 'string'
              ? chunk
              : chunk instanceof Uint8Array
                ? decoder.decode(chunk, { stream: true })
                : JSON.stringify(chunk)
            buf += asString
            if (/"type"\s*:\s*"text(?:-delta)?"/.test(buf)) {
              firstTextMarked = true
              markTtftClientMilestone('first_text_chunk')
              buf = ''
            }
          } catch {
            // ignore non-serializable chunks
          }
        }
        controller.enqueue(chunk)
      },
    }),
  )
}
