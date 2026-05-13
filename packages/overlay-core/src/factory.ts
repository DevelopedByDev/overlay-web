// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: App initialization (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type { OverlayConfig } from './config/overlay-config'
import { createProviderRegistry, type ProviderRegistry } from './config/provider-registry'
import type { IDatabase } from './db/interface'
import type { IAuth } from './auth/interface'
import type { IStorage } from './storage/interface'
import type { IAI } from './ai/interface'
import type { IBilling } from './billing/interface'
import type { ICache } from './cache/interface'
import type { IQueue } from './queue/interface'
import type { ISearch } from './search/interface'
import type { IAudit } from './audit/interface'
import { ConvexDatabase } from './db/convex'
import { PostgresDatabase } from './db/postgres'
import { OIDCAuth } from './auth/oidc'
import { SAMLAuth } from './auth/saml'
import { WorkOSAuth, type WorkOSAuthHandlers } from './auth/workos'
import type { UserRole } from './auth/types'
import { LocalStorage } from './storage/local'
import { MinIOStorage, R2Storage, S3Storage } from './storage/s3-compatible'
import { OpenAICompatibleAIProvider } from './ai/openai-compatible'
import { DisabledBillingProvider, ManualBillingProvider, StripeBillingProvider } from './billing/providers'
import { MemoryCache } from './cache/memory'
import { RedisCache } from './cache/redis'

export interface ProviderInstances {
  registry: ProviderRegistry
  database: IDatabase
  auth: IAuth
  storage?: IStorage
  ai?: IAI
  billing?: IBilling
  cache?: ICache
  queue?: IQueue
  search?: ISearch
  audit?: IAudit
}

export interface CreateProvidersOptions {
  convexClient?: ConstructorParameters<typeof ConvexDatabase>[0]['client']
  workosHandlers?: WorkOSAuthHandlers
}

export function createProviders(config: OverlayConfig, options: CreateProvidersOptions = {}): ProviderInstances {
  const registry = createProviderRegistry()
  const database = createDatabaseProvider(config, options)
  const auth = createAuthProvider(config, options)
  const storage = createStorageProvider(config)
  const ai = createAIProvider(config)
  const billing = createBillingProvider(config)
  const cache = createCacheProvider(config)

  registry.register('database', database.providerId ?? config.providers.database, database)
  registry.register('auth', auth.providerId ?? config.providers.auth, auth)
  registry.register('storage', storage.providerId ?? config.providers.storage, storage)
  registry.register('aiGateway', ai.providerId ?? config.providers.aiGateway, ai)
  registry.register('billing', billing.providerId ?? config.providers.billing, billing)
  registry.register('cache', cache.providerId ?? config.providers.cache, cache)

  return {
    registry,
    database,
    auth,
    storage,
    ai,
    billing,
    cache,
  }
}

export function createDatabaseProvider(config: OverlayConfig, options: CreateProvidersOptions = {}): IDatabase {
  switch (config.providers.database) {
    case 'postgres':
      return new PostgresDatabase({
        url: config.database.postgres.url ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '',
        pool: config.database.postgres.pool,
        migrationsTable: config.database.postgres.migrationsTable,
        migrationMode: config.database.postgres.migrationMode,
      })
    case 'convex':
      if (!options.convexClient) {
        throw new Error('Convex database provider requires a convexClient adapter.')
      }
      return new ConvexDatabase({ client: options.convexClient })
    case 'sqlite':
    case 'memory':
      throw new Error(`${config.providers.database} database provider is registered in config but not implemented in Phase 13.`)
    default:
      return assertNever(config.providers.database)
  }
}

export function createAuthProvider(config: OverlayConfig, options: CreateProvidersOptions = {}): IAuth {
  const provider = config.providers.auth === 'ldap' ? 'oidc' : config.providers.auth
  switch (provider) {
    case 'workos':
      if (!options.workosHandlers) {
        throw new Error('WorkOS auth provider requires workosHandlers.')
      }
      return new WorkOSAuth(options.workosHandlers)
    case 'oidc':
      return new OIDCAuth({
        issuer: config.auth.oidc.issuer ?? process.env.OIDC_ISSUER ?? process.env.KEYCLOAK_ISSUER ?? '',
        clientId: config.auth.oidc.clientId ?? process.env.OIDC_CLIENT_ID ?? process.env.KEYCLOAK_CLIENT_ID ?? '',
        clientSecret: config.auth.oidc.clientSecret ?? process.env.OIDC_CLIENT_SECRET ?? process.env.KEYCLOAK_CLIENT_SECRET,
        redirectUri: `${config.deployment.domain.replace(/\/$/, '')}/api/auth/callback`,
        scopes: config.auth.oidc.scopes,
        groupClaim: config.auth.oidc.groupClaim,
        roleClaim: config.auth.oidc.roleClaim,
        roleMapping: config.auth.roleMapping as Record<string, UserRole>,
        defaultRole: config.auth.defaultRole,
      })
    case 'saml':
      return new SAMLAuth({
        metadataUrl: config.auth.saml.metadataUrl,
        metadataXml: config.auth.saml.metadataXml,
        entryPoint: config.auth.saml.entryPoint,
        issuer: config.auth.saml.issuer,
        cert: config.auth.saml.cert,
        callbackUrl: `${config.deployment.domain.replace(/\/$/, '')}/api/auth/callback`,
        groupAttribute: config.auth.saml.groupAttribute,
        roleAttribute: config.auth.saml.roleAttribute,
        roleMapping: config.auth.roleMapping as Record<string, UserRole>,
        defaultRole: config.auth.defaultRole,
      })
    case 'local':
      throw new Error('Local auth is reserved for a later self-hosted phase and is disabled by default.')
    default:
      return assertNever(provider)
  }
}

export function createStorageProvider(config: OverlayConfig): IStorage {
  switch (config.providers.storage) {
    case 'r2': {
      const accountId = config.storage.r2.accountId ?? process.env.R2_ACCOUNT_ID
      const endpoint = config.storage.r2.endpoint ?? process.env.S3_API ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined)
      return new R2Storage({
        bucket: config.storage.r2.bucket ?? process.env.R2_BUCKET_NAME ?? '',
        endpoint,
        accessKeyId: config.storage.r2.accessKeyId ?? process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: config.storage.r2.secretAccessKey ?? process.env.R2_SECRET_ACCESS_KEY ?? '',
        presignTtlSeconds: config.storage.publicUrlTtlSeconds,
      })
    }
    case 's3':
      return new S3Storage({
        bucket: config.storage.s3.bucket ?? process.env.S3_BUCKET_NAME ?? '',
        endpoint: config.storage.s3.endpoint ?? process.env.S3_ENDPOINT,
        region: config.storage.s3.region ?? process.env.S3_REGION ?? 'us-east-1',
        accessKeyId: config.storage.s3.accessKeyId ?? process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: config.storage.s3.secretAccessKey ?? process.env.S3_SECRET_ACCESS_KEY ?? '',
        forcePathStyle: config.storage.s3.forcePathStyle,
        presignTtlSeconds: config.storage.publicUrlTtlSeconds,
      })
    case 'minio':
      return new MinIOStorage({
        bucket: config.storage.minio.bucket ?? process.env.MINIO_BUCKET_NAME ?? 'overlay',
        endpoint: config.storage.minio.endpoint ?? process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
        accessKeyId: config.storage.minio.accessKeyId ?? process.env.MINIO_ACCESS_KEY_ID ?? process.env.MINIO_ROOT_USER ?? '',
        secretAccessKey: config.storage.minio.secretAccessKey ?? process.env.MINIO_SECRET_ACCESS_KEY ?? process.env.MINIO_ROOT_PASSWORD ?? '',
        presignTtlSeconds: config.storage.publicUrlTtlSeconds,
      })
    case 'local':
    case 'memory':
      return new LocalStorage({
        rootDir: config.storage.local.rootDir ?? process.env.OVERLAY_STORAGE_DIR ?? './data/storage',
        publicBasePath: config.storage.local.publicBasePath,
        signingSecret: process.env.STORAGE_SIGNING_SECRET ?? process.env.SESSION_SECRET,
        presignTtlSeconds: config.storage.publicUrlTtlSeconds,
      })
    default:
      return assertNever(config.providers.storage)
  }
}

export function createAIProvider(config: OverlayConfig): IAI {
  switch (config.providers.aiGateway) {
    case 'vercel-ai':
      return new OpenAICompatibleAIProvider({
        providerId: 'vercel-ai',
        baseUrl: config.ai.vercel.baseUrl,
        apiKey: config.ai.vercel.apiKey ?? process.env.AI_GATEWAY_API_KEY,
        defaultModel: 'openai/gpt-4.1-mini',
        capabilities: { vision: true, toolCalling: true, image: true, video: true },
      })
    case 'openrouter':
      return new OpenAICompatibleAIProvider({
        providerId: 'openrouter',
        baseUrl: config.ai.openrouter.baseUrl,
        apiKey: config.ai.openrouter.apiKey ?? process.env.OPENROUTER_API_KEY,
        defaultModel: 'openrouter/free',
        capabilities: { vision: true, toolCalling: true },
      })
    case 'ollama':
      return new OpenAICompatibleAIProvider({
        providerId: 'ollama',
        baseUrl: config.ai.ollama.baseUrl,
        apiKey: process.env.OLLAMA_API_KEY,
        defaultModel: config.ai.ollama.defaultModel,
        imageEndpoint: config.ai.ollama.imageEndpoint,
        videoEndpoint: config.ai.ollama.videoEndpoint,
      })
    case 'vllm':
      return new OpenAICompatibleAIProvider({
        providerId: 'vllm',
        baseUrl: config.ai.vllm.baseUrl,
        apiKey: config.ai.vllm.apiKey ?? process.env.VLLM_API_KEY,
        defaultModel: config.ai.vllm.defaultModel,
        imageEndpoint: config.ai.vllm.imageEndpoint,
        videoEndpoint: config.ai.vllm.videoEndpoint,
      })
    case 'azure-openai':
      return new OpenAICompatibleAIProvider({
        providerId: 'azure-openai',
        baseUrl: process.env.AZURE_OPENAI_BASE_URL ?? 'https://example.invalid/openai',
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        defaultModel: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'default',
        capabilities: { vision: true, toolCalling: true },
      })
    default:
      return assertNever(config.providers.aiGateway)
  }
}

export function createBillingProvider(config: OverlayConfig): IBilling {
  switch (config.providers.billing) {
    case 'stripe':
      return new StripeBillingProvider()
    case 'disabled':
      return new DisabledBillingProvider(config.billing.disabled)
    case 'manual':
      return new ManualBillingProvider(config.billing.disabled)
    default:
      return assertNever(config.providers.billing)
  }
}

export function createCacheProvider(config: OverlayConfig): ICache {
  switch (config.providers.cache) {
    case 'redis':
      return new RedisCache({ providerId: 'redis', url: config.cache.redis.url ?? process.env.REDIS_URL ?? 'redis://localhost:6379' })
    case 'valkey':
      return new RedisCache({ providerId: 'valkey', url: config.cache.valkey.url ?? process.env.VALKEY_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379' })
    case 'memory':
      return new MemoryCache()
    default:
      return assertNever(config.providers.cache)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported provider: ${String(value)}`)
}
