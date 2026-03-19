/**
 * model-routing-test.ts
 *
 * Verifies that the model selected in the Overlay computer chat dropdown is
 * actually the model OpenClaw uses — not a fallback.
 *
 * Mirrors the current computer-chat hook path:
 *   1. Call /hooks/agent with the desired model ref.
 *   2. Wait for the assistant reply in session history.
 *   3. Read provider/model metadata from the assistant transcript entry.
 *   4. Compare expected vs actual.
 *
 * Usage:
 *   GATEWAY_IP=1.2.3.4 GATEWAY_TOKEN=abc node --experimental-strip-types scripts/model-routing-test.ts
 *   node --experimental-strip-types scripts/model-routing-test.ts --ip 1.2.3.4 --token abc
 *   node --experimental-strip-types scripts/model-routing-test.ts --ip 1.2.3.4 --token abc --models vercel-ai-gateway/anthropic/claude-sonnet-4.6,openrouter/free
 *
 * (Node 22+: --experimental-strip-types; older: npx ts-node scripts/model-routing-test.ts)
 */

// All models mirroring overlay-landing/src/lib/models.ts + resolveOpenClawModelRef logic.
// Format: name → expected model ref sent to session_status.
const ALL_MODELS: Array<{ name: string; ref: string }> = [
  // Vercel AI Gateway — Google
  { name: 'Gemini 3.1 Pro',       ref: 'vercel-ai-gateway/google/gemini-3.1-pro-preview' },
  { name: 'Gemini 3 Flash',       ref: 'vercel-ai-gateway/google/gemini-3-flash' },
  { name: 'Gemini 2.5 Flash',     ref: 'vercel-ai-gateway/google/gemini-2.5-flash' },
  { name: 'Gemini 2.5 Flash Lite',ref: 'vercel-ai-gateway/google/gemini-2.5-flash-lite' },
  // Vercel AI Gateway — OpenAI
  { name: 'GPT-5.2 Pro',          ref: 'vercel-ai-gateway/openai/gpt-5.2-pro' },
  { name: 'GPT-5.2',              ref: 'vercel-ai-gateway/openai/gpt-5.2' },
  { name: 'GPT-5 Mini',           ref: 'vercel-ai-gateway/openai/gpt-5-mini' },
  { name: 'GPT-5 Nano',           ref: 'vercel-ai-gateway/openai/gpt-5-nano' },
  { name: 'GPT-4.1',              ref: 'vercel-ai-gateway/openai/gpt-4.1' },
  // Vercel AI Gateway — Anthropic
  { name: 'Claude Opus 4.6',      ref: 'vercel-ai-gateway/anthropic/claude-opus-4.6' },
  { name: 'Claude Sonnet 4.6',    ref: 'vercel-ai-gateway/anthropic/claude-sonnet-4.6' },
  { name: 'Claude Haiku 4.5',     ref: 'vercel-ai-gateway/anthropic/claude-haiku-4.5' },
  // Vercel AI Gateway — xAI
  { name: 'Grok 4.1 Fast',        ref: 'vercel-ai-gateway/xai/grok-4.1-fast-reasoning' },
  // Vercel AI Gateway — Groq
  { name: 'Llama 3.3 70B',        ref: 'vercel-ai-gateway/meta/llama-3.3-70b' },
  { name: 'Kimi K2',              ref: 'vercel-ai-gateway/moonshotai/kimi-k2-0905' },
  { name: 'GPT OSS 120B',         ref: 'vercel-ai-gateway/openai/gpt-oss-120b' },
  { name: 'GPT OSS 20B',          ref: 'vercel-ai-gateway/openai/gpt-oss-20b' },
  // OpenRouter
  { name: 'Free Router',          ref: 'openrouter/free' },
  { name: 'Hunter Alpha',         ref: 'openrouter/hunter-alpha' },
  { name: 'Healer Alpha',         ref: 'openrouter/healer-alpha' },
  { name: 'Trinity Large (Free)', ref: 'openrouter/arcee-ai/trinity-large-preview:free' },
]

// ---------- types ----------

type HookAgentResponse = {
  ok?: boolean
  runId?: string
  error?: string
}

type TranscriptMessage = {
  role?: string
  provider?: string
  model?: string
  content?: Array<{ type?: string; text?: string }>
}

type SessionHistoryResponse = {
  sessionKey?: string
  items?: TranscriptMessage[]
  messages?: TranscriptMessage[]
}

// ---------- gateway helpers ----------

async function invokeHookAgent(
  ip: string,
  hooksToken: string,
  sessionKey: string,
  modelRef: string,
): Promise<boolean> {
  const res = await fetch(`http://${ip}:18789/hooks/agent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hooksToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      sessionKey,
      message: 'Reply with exactly: OK',
      name: 'Model Routing Test',
      deliver: false,
      timeoutSeconds: 180,
      model: modelRef,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    return false
  }

  const body = (await res.json()) as HookAgentResponse
  return body.ok === true
}

async function fetchSessionHistory(
  ip: string,
  token: string,
  sessionKey: string,
): Promise<{ sessionKey: string; messages: TranscriptMessage[] } | null> {
  const res = await fetch(`http://${ip}:18789/sessions/${encodeURIComponent(sessionKey)}/history`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    return null
  }

  const body = (await res.json()) as SessionHistoryResponse
  const messages = body.messages ?? body.items ?? []
  return {
    sessionKey: body.sessionKey?.trim() || sessionKey,
    messages: Array.isArray(messages) ? messages : [],
  }
}

async function waitForAssistantResult(params: {
  ip: string
  gatewayToken: string
  sessionKey: string
}): Promise<{ reply: string; actualRef: string | null }> {
  const deadline = Date.now() + 120_000

  while (Date.now() < deadline) {
    const history = await fetchSessionHistory(params.ip, params.gatewayToken, params.sessionKey)
    const assistant = [...(history?.messages ?? [])].reverse().find((message) => message.role === 'assistant')
    const reply = extractTranscriptText(assistant)

    if (assistant && reply) {
      const actualRef =
        assistant.provider && assistant.model
          ? `${assistant.provider}/${assistant.model}`
          : null
      return { reply, actualRef }
    }

    await sleep(3_000)
  }

  throw new Error('assistant reply did not appear in session history')
}

function extractTranscriptText(message: TranscriptMessage | undefined): string {
  if (!message?.content || !Array.isArray(message.content)) {
    return ''
  }

  return message.content
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text ?? '')
    .join('')
    .trim()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------- main ----------

async function main() {
  const argv = process.argv.slice(2)

  const ip = getArg(argv, '--ip') ?? process.env.GATEWAY_IP ?? ''
  const gatewayToken = getArg(argv, '--token') ?? process.env.GATEWAY_TOKEN ?? ''
  const hooksToken =
    getArg(argv, '--hooks-token') ?? process.env.HOOKS_TOKEN ?? `hooks_${gatewayToken}`
  const modelsArg = getArg(argv, '--models')

  if (!ip || !gatewayToken) {
    process.stderr.write(
      'Error: GATEWAY_IP and GATEWAY_TOKEN are required.\n' +
        'Usage: GATEWAY_IP=1.2.3.4 GATEWAY_TOKEN=abc node --experimental-strip-types scripts/model-routing-test.ts\n',
    )
    process.exit(1)
  }

  const modelsToTest = modelsArg
    ? ALL_MODELS.filter((m) => modelsArg.split(',').includes(m.ref))
    : ALL_MODELS

  log(`[model-routing-test] gateway: http://${ip}:18789`)
  log(`[model-routing-test] testing ${modelsToTest.length} model(s)\n`)

  let passed = 0
  let failed = 0
  let skipped = 0

  for (const m of modelsToTest) {
    const sessionKey = `hook:computer:test:${m.ref.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`
    log(`── ${m.name}`)
    log(`   ref:     ${m.ref}`)

    const overrideOk = await invokeHookAgent(ip, hooksToken, sessionKey, m.ref).catch(() => false)
    if (!overrideOk) {
      log(`   SKIP — gateway rejected model ref (not in catalog)`)
      skipped++
      continue
    }
    log(`   hook:     accepted`)

    let result: { reply: string; actualRef: string | null } | null = null
    try {
      result = await waitForAssistantResult({
        ip,
        gatewayToken,
        sessionKey: `agent:main:${sessionKey}`,
      })
      log(`   chat:     ${JSON.stringify(result.reply)}`)
    } catch (err) {
      log(`   FAIL — chat error: ${err instanceof Error ? err.message : String(err)}`)
      failed++
      continue
    }

    const actualRef = result.actualRef ?? '(unknown)'
    log(`   actual:   ${actualRef}`)

    if (actualRef === m.ref) {
      log(`   PASS`)
      passed++
    } else {
      log(`   FAIL — expected ${m.ref}`)
      failed++
    }
    log('')
  }

  log(`── Results: ${passed} passed, ${failed} failed, ${skipped} skipped`)
  if (failed > 0) process.exit(1)
}

function getArg(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name)
  return idx !== -1 && idx + 1 < argv.length ? argv[idx + 1] : undefined
}

function log(msg: string) {
  process.stdout.write(msg + '\n')
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`)
  process.exit(1)
})
