import assert from 'node:assert/strict'
import { ConvexDatabase } from '../packages/overlay-core/src/db/convex.ts'
import { PostgresDatabase } from '../packages/overlay-core/src/db/postgres.ts'
import { createProviders } from '../packages/overlay-core/src/factory.ts'
import { parseOverlayConfig } from '../packages/overlay-core/src/config/overlay-config.ts'
import { OIDCAuth } from '../packages/overlay-core/src/auth/oidc.ts'
import { SAMLAuth } from '../packages/overlay-core/src/auth/saml.ts'
import { WorkOSAuth } from '../packages/overlay-core/src/auth/workos.ts'

async function main() {
const calls: Array<{ type: string; path: string }> = []
const convexClient = {
  query: async <T>(path: string): Promise<T | null> => {
    calls.push({ type: 'query', path })
    return ({ pong: true }) as T
  },
  mutation: async <T>(path: string): Promise<T | null> => {
    calls.push({ type: 'mutation', path })
    return ({ id: 'stub' }) as T
  },
  action: async <T>(path: string): Promise<T | null> => {
    calls.push({ type: 'action', path })
    return ({ id: 'stub' }) as T
  },
}

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

const convexConfig = parseOverlayConfig({
  version: '1.0',
  deployment: { mode: 'saas', domain: 'http://localhost:3000' },
  providers: {
    database: 'convex',
    auth: 'workos',
    storage: 'r2',
    aiGateway: 'vercel-ai',
    billing: 'stripe',
    queue: 'convex',
    search: 'convex',
  },
})

const convexProviders = createProviders(convexConfig, { convexClient, workosHandlers })
assert.ok(convexProviders.database instanceof ConvexDatabase)
assert.ok(convexProviders.auth instanceof WorkOSAuth)
assert.equal((await convexProviders.database.health()).ok, true)
assert.equal(calls.some((call) => call.path === 'health:ping'), true)

const postgresConfig = parseOverlayConfig({
  version: '1.0',
  deployment: { mode: 'self-hosted', domain: 'http://localhost:3000' },
  providers: {
    database: 'postgres',
    auth: 'oidc',
    storage: 'minio',
    aiGateway: 'ollama',
    billing: 'disabled',
    queue: 'redis',
    search: 'meilisearch',
  },
  database: { postgres: { url: 'postgres://overlay:overlay@localhost:5432/overlay' } },
  auth: {
    oidc: {
      issuer: 'http://localhost:8080/realms/overlay',
      clientId: 'overlay',
    },
  },
})

const postgresProviders = createProviders(postgresConfig)
assert.ok(postgresProviders.database instanceof PostgresDatabase)
assert.ok(postgresProviders.auth instanceof OIDCAuth)

const samlConfig = parseOverlayConfig({
  ...convexConfig,
  providers: { ...convexConfig.providers, auth: 'saml' },
  auth: { saml: { entryPoint: 'https://idp.example.test/sso' } },
})
const samlProviders = createProviders(samlConfig, { convexClient })
assert.ok(samlProviders.auth instanceof SAMLAuth)

assert.throws(() =>
  parseOverlayConfig({
    version: '1.0',
    deployment: { mode: 'self-hosted' },
    providers: { database: 'convex' },
  }),
)

console.log('[verify-phase13-14] provider factory, config validation, and auth/db adapters verified.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
