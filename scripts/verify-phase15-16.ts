import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DisabledBillingProvider,
  LocalStorage,
  MemoryCache,
  OpenAICompatibleAIProvider,
  RedisCache,
  createProviders,
  parseOverlayConfig,
} from '../packages/overlay-core/src/index.ts'

const workosHandlers = {
  getSession: async () => null,
  createSignInUrl: () => 'https://auth.example.test/sign-in',
  createSignUpUrl: () => 'https://auth.example.test/sign-up',
  handleCallback: async () => {
    throw new Error('not used')
  },
  refreshSession: async (session: any) => session,
  signOut: async () => {},
}

const convexClient = {
  query: async <T>(): Promise<T | null> => ({ pong: true }) as T,
  mutation: async <T>(): Promise<T | null> => ({ id: 'stub' }) as T,
  action: async <T>(): Promise<T | null> => ({ id: 'stub' }) as T,
}

async function main() {
  const tmp = await mkdtemp(join(tmpdir(), 'overlay-storage-'))
  try {
    const selfHosted = parseOverlayConfig({
      version: '1.0',
      deployment: { mode: 'self-hosted', domain: 'http://localhost:3000' },
      providers: {
        database: 'postgres',
        auth: 'oidc',
        storage: 'local',
        aiGateway: 'ollama',
        billing: 'disabled',
        cache: 'memory',
        queue: 'redis',
        search: 'memory',
      },
      database: { postgres: { url: 'postgres://overlay:overlay@localhost:5432/overlay' } },
      auth: { oidc: { issuer: 'http://localhost:8080/realms/overlay', clientId: 'overlay' } },
      storage: { local: { rootDir: tmp } },
      ai: { ollama: { baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3.1' } },
    })

    const providers = createProviders(selfHosted)
    assert.ok(providers.storage instanceof LocalStorage)
    assert.ok(providers.ai instanceof OpenAICompatibleAIProvider)
    assert.ok(providers.billing instanceof DisabledBillingProvider)
    assert.ok(providers.cache instanceof MemoryCache)

    await providers.storage!.init?.()
    await providers.storage!.upload('users/u/files/f/example.txt', 'hello', 'text/plain')
    assert.equal((await providers.storage!.download('users/u/files/f/example.txt')).toString('utf8'), 'hello')
    assert.equal((await providers.storage!.head('users/u/files/f/example.txt'))?.sizeBytes, 5)
    assert.equal(await providers.storage!.exists('users/u/files/f/example.txt'), true)
    const url = await providers.storage!.getPresignedDownloadUrl('users/u/files/f/example.txt', 60)
    assert.ok(url.includes('signature='))
    await providers.storage!.delete('users/u/files/f/example.txt')
    assert.equal(await providers.storage!.exists('users/u/files/f/example.txt'), false)

    await providers.cache!.set('phase15-16:key', { ok: true }, 60)
    assert.deepEqual(await providers.cache!.get('phase15-16:key'), { ok: true })
    assert.equal(await providers.cache!.incr('phase15-16:counter', 60), 1)

    const entitlements = await providers.billing!.getUserEntitlements('user_1')
    assert.equal(entitlements.tier, 'max')
    assert.equal(entitlements.autoTopUpEnabled, false)
    await assert.rejects(
      () => providers.ai!.generateImage({ modelId: 'local-image', prompt: 'test' }),
      /image generation requires/,
    )

    const redisConfig = parseOverlayConfig({
      ...selfHosted,
      providers: { ...selfHosted.providers, cache: 'redis' },
      cache: { redis: { url: 'redis://localhost:6379' } },
    })
    const redisProviders = createProviders(redisConfig)
    assert.ok(redisProviders.cache instanceof RedisCache)

    const saas = parseOverlayConfig({
      version: '1.0',
      deployment: { mode: 'saas', domain: 'http://localhost:3000' },
      providers: {
        database: 'convex',
        auth: 'workos',
        storage: 'r2',
        aiGateway: 'vercel-ai',
        billing: 'stripe',
        cache: 'memory',
        queue: 'convex',
        search: 'convex',
      },
      storage: {
        r2: {
          bucket: 'overlay',
          endpoint: 'https://example.r2.cloudflarestorage.com',
          accessKeyId: 'key',
          secretAccessKey: 'secret',
        },
      },
    })
    const saasProviders = createProviders(saas, { convexClient, workosHandlers })
    assert.equal(saasProviders.storage?.providerId, 'r2')
    assert.equal(saasProviders.ai?.providerId, 'vercel-ai')
    assert.equal(saasProviders.billing?.providerId, 'stripe')

    console.log('[verify-phase15-16] storage, AI, billing, cache, and provider factory verified.')
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
