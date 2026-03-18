const { execFile: execFileCb } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { promisify } = require('node:util')

const execFile = promisify(execFileCb)

type DeploymentTarget = 'dev' | 'prod'

type ServerRecord = {
  id: number
  public_net?: {
    ipv4?: {
      ip?: string
    }
  }
}

type FirewallRecord = {
  id: number
}

type SshKeyRecord = {
  id: number
}

type HetznerActionResponse<T> = {
  server?: T
  firewall?: T
  ssh_key?: T
}

type Config = {
  deployment: DeploymentTarget
  region: 'ash' | 'nbg'
  serverType: string
  image: string
  keep: boolean
  namePrefix: string
  healthTimeoutMs: number
  pollIntervalMs: number
  sshTimeoutMs: number
}

type SshContext = {
  privateKeyPath: string
  publicKeyPath: string
  hetznerSshKeyId: number
  cleanup: () => Promise<void>
}

async function main() {
  const config = readConfig()
  const logPrefix = '[openclaw-smoke]'

  log(logPrefix, `starting isolated Hetzner smoke in ${config.deployment} mode`)

  const hetznerToken = await resolveSecret('HETZNER_API_TOKEN', config.deployment)
  const openrouterApiKey = await resolveSecret('OPENROUTER_API_KEY', config.deployment)

  const gatewayToken = crypto.randomBytes(24).toString('hex')
  const resourceSuffix = crypto.randomUUID().slice(0, 8)
  const firewallName = `${config.namePrefix}-fw-${resourceSuffix}`.slice(0, 63)
  const serverName = `${config.namePrefix}-server-${resourceSuffix}`.slice(0, 63)
  const sshKeyName = `${config.namePrefix}-ssh-${resourceSuffix}`.slice(0, 63)

  let sshContext: SshContext | undefined
  let firewallId: number | undefined
  let serverId: number | undefined
  let serverIp: string | undefined

  try {
    log(logPrefix, 'creating temporary SSH key for guest diagnostics')
    sshContext = await createHetznerSshAccess(hetznerToken, sshKeyName)

    log(logPrefix, `creating firewall ${firewallName}`)
    const firewall = await createFirewall(hetznerToken, firewallName)
    firewallId = firewall.id
    log(logPrefix, `firewall created: ${firewallId}`)

    log(logPrefix, `creating server ${serverName}`)
    const server = await createServer(hetznerToken, {
      name: serverName,
      firewallId,
      region: config.region,
      serverType: config.serverType,
      image: config.image,
      userData: buildCloudInit({
        gatewayToken,
        openrouterApiKey,
      }),
      sshKeyIds: [sshContext.hetznerSshKeyId],
    })
    serverId = server.id
    serverIp = server.public_net?.ipv4?.ip

    if (!serverIp) {
      throw new Error(`Hetzner server ${server.id} did not return an IPv4 address`)
    }

    log(logPrefix, `server created: id=${serverId} ip=${serverIp}`)
    log(logPrefix, 'waiting for SSH to become reachable')
    await waitForSsh(serverIp, sshContext.privateKeyPath, config.sshTimeoutMs)

    log(logPrefix, 'waiting for cloud-init/bootstrap to finish')
    const cloudInitStatus = await sshExec(serverIp, sshContext.privateKeyPath, 'cloud-init status --wait --long || true', 35 * 60 * 1000)
    process.stdout.write(cloudInitStatus.stdout)
    if (cloudInitStatus.stderr.trim()) {
      process.stderr.write(cloudInitStatus.stderr)
    }

    log(logPrefix, 'waiting for OpenClaw healthz')
    try {
      await waitForHealth(serverIp, config.healthTimeoutMs, config.pollIntervalMs)
    } catch (error) {
      log(logPrefix, 'healthz failed, collecting guest diagnostics')
      await printDiagnostics(serverIp, sshContext.privateKeyPath)
      throw error
    }
    log(logPrefix, 'gateway is healthy')

    log(logPrefix, 'verifying chat through the OpenClaw HTTP API')
    const httpReply = await sendChatOverHttp(serverIp, gatewayToken, 'Reply with exactly: OK')
    log(logPrefix, `http chat reply: ${JSON.stringify(httpReply)}`)

    if (!httpReply || !/\bok\b/i.test(httpReply)) {
      throw new Error(`HTTP chat did not return the expected reply: ${JSON.stringify(httpReply)}`)
    }

    log(logPrefix, 'verifying chat through the host openclaw wrapper')
    const reply = await sendChatOverSsh(
      serverIp,
      sshContext.privateKeyPath,
      'Reply with exactly: OK',
    )
    log(logPrefix, `chat reply: ${JSON.stringify(reply)}`)

    if (!reply || !/\bok\b/i.test(reply)) {
      throw new Error(`Gateway chat did not return the expected reply: ${JSON.stringify(reply)}`)
    }

    log(logPrefix, 'verifying host openclaw wrapper')
    const wrapperCheck = await sshExec(
      serverIp,
      sshContext.privateKeyPath,
      'openclaw gateway status --json',
      60_000,
    )
    process.stdout.write(wrapperCheck.stdout)
    if (wrapperCheck.stderr.trim()) {
      process.stderr.write(wrapperCheck.stderr)
    }

    if (!config.keep) {
      log(logPrefix, 'chat succeeded, cleaning up resources')
      await cleanupResources(hetznerToken, { serverId, firewallId })
      serverId = undefined
      firewallId = undefined
      await sshContext.cleanup()
      sshContext = undefined
    } else {
      log(logPrefix, `keeping server alive at http://${serverIp}:18789`)
      log(logPrefix, `gateway token: ${gatewayToken}`)
      log(logPrefix, `ssh: ssh -i ${sshContext.privateKeyPath} root@${serverIp}`)
    }

    log(logPrefix, 'success')
  } catch (error) {
    log(logPrefix, `failure: ${error instanceof Error ? error.message : String(error)}`)
    if (!config.keep) {
      await cleanupResources(hetznerToken, { serverId, firewallId })
    }
    if (sshContext) {
      if (config.keep) {
        log(
          logPrefix,
          `keeping failed resources for inspection serverId=${serverId ?? 'n/a'} firewallId=${firewallId ?? 'n/a'} ip=${serverIp ?? 'n/a'}`,
        )
        log(logPrefix, `gateway token: ${gatewayToken}`)
        log(logPrefix, `ssh: ssh -i ${sshContext.privateKeyPath} root@${serverIp ?? 'UNKNOWN_IP'}`)
      } else {
        await sshContext.cleanup().catch(() => {})
      }
    }
    throw error
  }
}

function readConfig(): Config {
  const args = new Set(process.argv.slice(2))
  const deployment: DeploymentTarget = args.has('--prod') ? 'prod' : 'dev'
  const region = args.has('--region=nbg') ? 'nbg' : 'ash'
  const keep = args.has('--keep')

  return {
    deployment,
    region,
    serverType: 'cpx21',
    image: 'ubuntu-24.04',
    keep,
    namePrefix: 'overlay-smoke',
    healthTimeoutMs: 15 * 60 * 1000,
    pollIntervalMs: 10 * 1000,
    sshTimeoutMs: 10 * 60 * 1000,
  }
}

async function resolveSecret(name: string, deployment: DeploymentTarget): Promise<string> {
  const direct = process.env[name]?.trim()
  if (direct) return direct
  const fromConvex = await getConvexEnv(name, deployment)
  if (fromConvex) return fromConvex
  throw new Error(`Missing required secret ${name}`)
}

async function getConvexEnv(name: string, deployment: DeploymentTarget): Promise<string> {
  const args =
    deployment === 'prod'
      ? ['convex', 'env', 'get', name, '--prod']
      : ['convex', 'env', 'get', name]
  try {
    const { stdout } = await execFile('npx', args, {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 1024 * 1024,
    })
    return stdout.trim()
  } catch {
    return ''
  }
}

async function createHetznerSshAccess(token: string, name: string): Promise<SshContext> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-hetzner-ssh-'))
  const privateKeyPath = path.join(tempDir, 'id_ed25519')
  const publicKeyPath = `${privateKeyPath}.pub`

  await execFile('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', privateKeyPath], {
    cwd: process.cwd(),
    env: process.env,
  })

  const publicKey = await fs.readFile(publicKeyPath, 'utf8')
  const sshKey = await createHetznerSshKey(token, name, publicKey.trim())

  return {
    privateKeyPath,
    publicKeyPath,
    hetznerSshKeyId: sshKey.id,
    cleanup: async () => {
      await deleteHetznerSshKey(token, sshKey.id).catch(() => {})
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    },
  }
}

async function createHetznerSshKey(token: string, name: string, publicKey: string): Promise<SshKeyRecord> {
  const res = await fetch('https://api.hetzner.cloud/v1/ssh_keys', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      public_key: publicKey,
    }),
  })

  if (!res.ok) {
    throw new Error(`Failed to create SSH key: HTTP ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as HetznerActionResponse<SshKeyRecord>
  if (!data.ssh_key) {
    throw new Error('Hetzner SSH key create response did not include ssh_key')
  }
  return data.ssh_key
}

async function deleteHetznerSshKey(token: string, sshKeyId: number) {
  await fetch(`https://api.hetzner.cloud/v1/ssh_keys/${sshKeyId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}

async function createFirewall(token: string, name: string): Promise<FirewallRecord> {
  const res = await fetch('https://api.hetzner.cloud/v1/firewalls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      rules: [
        { direction: 'in', protocol: 'tcp', port: '22', source_ips: ['0.0.0.0/0', '::/0'] },
        { direction: 'in', protocol: 'tcp', port: '18789', source_ips: ['0.0.0.0/0', '::/0'] },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Failed to create firewall: HTTP ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as HetznerActionResponse<FirewallRecord>
  if (!data.firewall) {
    throw new Error('Hetzner firewall create response did not include firewall')
  }
  return data.firewall
}

async function createServer(
  token: string,
  params: {
    name: string
    firewallId: number
    region: string
    serverType: string
    image: string
    userData: string
    sshKeyIds: number[]
  }
): Promise<ServerRecord> {
  const res = await fetch('https://api.hetzner.cloud/v1/servers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: params.name,
      server_type: params.serverType,
      image: params.image,
      location: params.region,
      user_data: params.userData,
      firewalls: [{ firewall: params.firewallId }],
      ssh_keys: params.sshKeyIds,
    }),
  })

  if (!res.ok) {
    throw new Error(`Failed to create server: HTTP ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as HetznerActionResponse<ServerRecord>
  if (!data.server) {
    throw new Error('Hetzner server create response did not include server')
  }
  return data.server
}

async function waitForSsh(ip: string, privateKeyPath: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  let lastError = 'ssh did not run'

  while (Date.now() < deadline) {
    try {
      await sshExec(ip, privateKeyPath, 'true', 15_000)
      return
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await sleep(5_000)
  }

  throw new Error(`Timed out waiting for SSH on ${ip} (${lastError})`)
}

async function waitForHealth(ip: string, timeoutMs: number, intervalMs: number) {
  const deadline = Date.now() + timeoutMs
  let lastError = 'health check did not run'

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://${ip}:18789/healthz`, {
        signal: AbortSignal.timeout(5_000),
      })
      if (res.ok) {
        return
      }
      lastError = `HTTP ${res.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    await sleep(intervalMs)
  }

  throw new Error(`Timed out waiting for healthz on ${ip}:18789 (${lastError})`)
}

async function sendChatOverSsh(
  ip: string,
  privateKeyPath: string,
  message: string,
): Promise<string> {
  const runId = crypto.randomUUID()
  const sendRes = await sshGatewayCall(ip, privateKeyPath, 'chat.send', {
    sessionKey: 'main',
    message,
    idempotencyKey: runId,
  })

  if (sendRes?.status !== 'started') {
    throw new Error(`chat.send did not start: ${JSON.stringify(sendRes)}`)
  }

  const waitRes = await sshGatewayCall(ip, privateKeyPath, 'agent.wait', {
    runId,
    timeoutMs: 180_000,
  })

  if (waitRes?.status !== 'ok') {
    throw new Error(`agent.wait did not finish successfully: ${JSON.stringify(waitRes)}`)
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const historyRes = await sshGatewayCall(ip, privateKeyPath, 'chat.history', {
      sessionKey: 'main',
    })
    const messages = Array.isArray(historyRes?.messages) ? historyRes.messages : []
    const text = extractLatestAssistantText(messages)
    if (text) {
      return text
    }
    await sleep(2_000)
  }

  throw new Error('chat.history did not return an assistant reply')
}

async function sendChatOverHttp(ip: string, gatewayToken: string, message: string): Promise<string> {
  const response = await fetch(`http://${ip}:18789/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gatewayToken}`,
      'Content-Type': 'application/json',
      'x-openclaw-agent-id': 'default',
    },
    body: JSON.stringify({
      model: 'openclaw:default',
      user: 'overlay-smoke-http',
      stream: false,
      messages: [{ role: 'user', content: message }],
    }),
    signal: AbortSignal.timeout(180_000),
  })

  if (!response.ok) {
    throw new Error(`HTTP chat failed: ${response.status} ${await response.text()}`)
  }

  return extractAssistantTextFromCompletion(await response.json())
}

async function sshGatewayCall(
  ip: string,
  privateKeyPath: string,
  method: string,
  params: Record<string, unknown>,
): Promise<any> {
  const escapedParams = shellSingleQuote(JSON.stringify(params))
  const result = await sshExec(
    ip,
    privateKeyPath,
    `openclaw gateway call ${method} --params '${escapedParams}' --json`,
    5 * 60 * 1000,
  )

  return parseJsonOutput(result.stdout, `gateway call ${method}`)
}

function extractLatestAssistantText(messages: unknown[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    const text = extractTextFromHistoryMessage(message)
    if (text) {
      return text
    }
  }
  return undefined
}

function extractTextFromHistoryMessage(message: unknown): string | undefined {
  if (!message || typeof message !== 'object') {
    return undefined
  }

  const entry = message as { text?: unknown; content?: unknown }
  if (typeof entry.text === 'string' && entry.text.trim()) {
    return entry.text.trim()
  }

  if (!Array.isArray(entry.content)) {
    return undefined
  }

  for (const block of entry.content) {
    if (!block || typeof block !== 'object') {
      continue
    }
    const text = (block as { text?: unknown }).text
    if (typeof text === 'string' && text.trim()) {
      return text.trim()
    }
  }

  return undefined
}

function extractAssistantTextFromCompletion(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return ''
  }

  const choices = (data as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) {
    return ''
  }

  const message = (choices[0] as { message?: unknown } | undefined)?.message
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
      if (!part || typeof part !== 'object') return ''
      const text = (part as { text?: unknown }).text
      return typeof text === 'string' ? text : ''
    })
    .join('')
    .trim()
}

async function sshExec(
  ip: string,
  privateKeyPath: string,
  command: string,
  timeoutMs = 60_000,
): Promise<{ stdout: string; stderr: string }> {
  return await execFile(
    'ssh',
    [
      '-i',
      privateKeyPath,
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'UserKnownHostsFile=/dev/null',
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=10',
      `root@${ip}`,
      command,
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
      timeout: timeoutMs,
    },
  )
}

async function printDiagnostics(ip: string, privateKeyPath: string) {
  const sections = [
    {
      label: 'cloud-init',
      command: 'cloud-init status --long || true',
    },
    {
      label: 'bootstrap.log',
      command: 'sed -n "1,260p" /root/bootstrap.log || true',
    },
    {
      label: 'docker compose ps',
      command: 'cd /root/openclaw-deploy && docker compose ps || true',
    },
    {
      label: 'docker compose logs',
      command: 'cd /root/openclaw-deploy && docker compose logs --tail 200 || true',
    },
  ]

  for (const section of sections) {
    try {
      const result = await sshExec(ip, privateKeyPath, section.command, 120_000)
      process.stdout.write(`\n===== ${section.label} =====\n`)
      process.stdout.write(result.stdout)
      if (result.stderr.trim()) {
        process.stderr.write(result.stderr)
      }
    } catch (error) {
      process.stderr.write(`\n===== ${section.label} (failed) =====\n${String(error)}\n`)
    }
  }
}

async function cleanupResources(
  token: string,
  resources: { serverId?: number; firewallId?: number }
) {
  if (resources.serverId) {
    await fetch(`https://api.hetzner.cloud/v1/servers/${resources.serverId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})

    for (let i = 0; i < 24; i += 1) {
      const res = await fetch(`https://api.hetzner.cloud/v1/servers/${resources.serverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null)
      if (!res || res.status === 404) {
        break
      }
      await sleep(5_000)
    }
  }

  if (resources.firewallId) {
    for (let i = 0; i < 24; i += 1) {
      const res = await fetch(`https://api.hetzner.cloud/v1/firewalls/${resources.firewallId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null)

      if (!res || res.status === 404 || res.ok) {
        break
      }

      await sleep(5_000)
    }
  }
}

function buildCloudInit(params: {
  gatewayToken: string
  openrouterApiKey: string
}): string {
  const configJson = JSON.stringify(
    {
      gateway: {
        mode: 'local',
        bind: 'lan',
        port: 18789,
        auth: {
          mode: 'token',
          token: params.gatewayToken,
        },
        http: {
          endpoints: {
            chatCompletions: {
              enabled: true,
            },
          },
        },
        controlUi: {
          enabled: true,
          dangerouslyAllowHostHeaderOriginFallback: true,
        },
      },
      agents: {
        defaults: {
          workspace: '/home/node/.openclaw/workspace',
          model: {
            primary: 'openrouter/anthropic/claude-sonnet-4-5',
          },
        },
        list: [
          {
            id: 'default',
            name: 'OpenClaw Assistant',
            workspace: '/home/node/.openclaw/workspace',
          },
        ],
      },
      cron: {
        enabled: false,
      },
    },
    null,
    2,
  )

  const compose = [
    'services:',
    '  openclaw-gateway:',
    '    image: ghcr.io/openclaw/openclaw:main',
    '    restart: unless-stopped',
    '    env_file:',
    '      - /root/openclaw-deploy/.env',
    '    environment:',
    '      - HOME=/home/node',
    '      - NODE_ENV=production',
    '      - TERM=xterm-256color',
    '      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}',
    '      - OPENCLAW_SKIP_CHANNELS=1',
    '      - OPENCLAW_SKIP_CRON=1',
    '      - OPENCLAW_SKIP_GMAIL_WATCHER=1',
    '      - OPENCLAW_SKIP_CANVAS_HOST=1',
    '      - PATH=/home/linuxbrew/.linuxbrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    '    volumes:',
    '      - /root/.openclaw:/home/node/.openclaw',
    '      - /root/.openclaw/workspace:/home/node/.openclaw/workspace',
    '    ports:',
    '      - "0.0.0.0:18789:18789"',
    '    command:',
    '      ["node", "openclaw.mjs", "gateway", "--bind", "lan", "--port", "18789"]',
  ].join('\n')

  const envFile = [
    `OPENROUTER_API_KEY=${params.openrouterApiKey}`,
  ].join('\n')

  const hostWrapper = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'cd /root/openclaw-deploy',
    'if [ -t 0 ] && [ -t 1 ]; then',
    '  exec docker compose exec openclaw-gateway openclaw "$@"',
    'fi',
    'exec docker compose exec -T openclaw-gateway openclaw "$@"',
  ].join('\n')

  const script = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'exec > >(tee -a /root/bootstrap.log) 2>&1',
    'echo "[$(date -Is)] installing docker"',
    'apt-get update -y',
    'apt-get install -y curl ca-certificates',
    'curl -fsSL https://get.docker.com | sh',
    'systemctl enable --now docker',
    'mkdir -p /root/openclaw-deploy /root/.openclaw/workspace',
    'chown -R 1000:1000 /root/.openclaw',
    'chmod +x /usr/local/bin/openclaw',
    'cd /root/openclaw-deploy',
    'echo "[$(date -Is)] pulling prebuilt OpenClaw image"',
    'docker compose pull',
    'echo "[$(date -Is)] starting OpenClaw gateway container"',
    'docker compose up -d',
    'echo "[$(date -Is)] waiting for gateway healthz"',
    'for i in $(seq 1 90); do',
    '  if curl -fsS http://127.0.0.1:18789/healthz >/dev/null 2>&1; then',
    '    echo "[$(date -Is)] gateway healthy"',
    '    exit 0',
    '  fi',
    '  sleep 5',
    'done',
    'echo "[$(date -Is)] gateway failed to become healthy"',
    'docker compose ps || true',
    'docker compose logs --tail 200 || true',
    'exit 1',
  ].join('\n')

  return [
    '#cloud-config',
    'package_update: true',
    'packages:',
    '  - curl',
    '  - ca-certificates',
    'write_files:',
    '  - path: /root/openclaw-deploy/.env',
    "    permissions: '0600'",
    '    content: |',
    indentBlock(envFile, 6),
    '  - path: /root/openclaw-deploy/docker-compose.yml',
    "    permissions: '0644'",
    '    content: |',
    indentBlock(compose, 6),
    '  - path: /root/.openclaw/openclaw.json',
    "    permissions: '0600'",
    '    content: |',
    indentBlock(configJson, 6),
    '  - path: /usr/local/bin/openclaw',
    "    permissions: '0755'",
    '    content: |',
    indentBlock(hostWrapper, 6),
    '  - path: /root/openclaw-deploy/bootstrap.sh',
    "    permissions: '0755'",
    '    content: |',
    indentBlock(script, 6),
    'runcmd:',
    '  - /root/openclaw-deploy/bootstrap.sh',
    '',
  ].join('\n')
}

function indentBlock(value: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return value
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n')
}

function parseJsonOutput(value: string, context: string): any {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${context} returned empty output`)
  }

  try {
    return JSON.parse(trimmed)
  } catch (error) {
    throw new Error(
      `${context} returned non-JSON output: ${trimmed}\n${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function shellSingleQuote(value: string): string {
  return value.replace(/'/g, `'\"'\"'`)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function log(prefix: string, message: string) {
  process.stdout.write(`${prefix} ${message}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`)
  process.exit(1)
})
