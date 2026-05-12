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
import type { IQueue } from './queue/interface'
import type { ISearch } from './search/interface'
import type { IAudit } from './audit/interface'
import { ConvexDatabase } from './db/convex'
import { PostgresDatabase } from './db/postgres'
import { OIDCAuth } from './auth/oidc'
import { SAMLAuth } from './auth/saml'
import { WorkOSAuth, type WorkOSAuthHandlers } from './auth/workos'
import type { UserRole } from './auth/types'

export interface ProviderInstances {
  registry: ProviderRegistry
  database: IDatabase
  auth: IAuth
  storage?: IStorage
  ai?: IAI
  billing?: IBilling
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

  registry.register('database', database.providerId ?? config.providers.database, database)
  registry.register('auth', auth.providerId ?? config.providers.auth, auth)

  return {
    registry,
    database,
    auth,
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

function assertNever(value: never): never {
  throw new Error(`Unsupported provider: ${String(value)}`)
}
