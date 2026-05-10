// @enterprise-future — not wired to production

export type ProfileName = 'saas' | 'on-prem' | 'hybrid'

export interface ProviderChoices {
  database: string
  auth: string
  aiGateway: string
  storage: string
  billing: string
  queue: string
  search: string
  audit: string
}

export const profiles: Record<ProfileName, ProviderChoices> = {
  saas: {
    database: 'convex',
    auth: 'workos',
    aiGateway: 'vercel-ai',
    storage: 'r2',
    billing: 'stripe',
    queue: 'convex',
    search: 'convex',
    audit: 'convex',
  },
  'on-prem': {
    database: 'postgres',
    auth: 'keycloak',
    aiGateway: 'ollama',
    storage: 'minio',
    billing: 'disabled',
    queue: 'bullmq',
    search: 'meilisearch',
    audit: 'postgres',
  },
  hybrid: {
    database: 'postgres',
    auth: 'keycloak',
    aiGateway: 'vercel-ai',
    storage: 'minio',
    billing: 'stripe',
    queue: 'bullmq',
    search: 'meilisearch',
    audit: 'postgres',
  },
}

export const providerEnvVars: Record<string, string[]> = {
  convex: ['NEXT_PUBLIC_CONVEX_URL', 'CONVEX_DEPLOY_KEY'],
  workos: ['WORKOS_CLIENT_ID', 'WORKOS_API_KEY'],
  stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  'vercel-ai': ['AI_GATEWAY_URL', 'AI_GATEWAY_KEY'],
  r2: ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'],
  postgres: ['DATABASE_URL'],
  keycloak: ['KEYCLOAK_URL', 'KEYCLOAK_REALM', 'KEYCLOAK_CLIENT_ID', 'KEYCLOAK_CLIENT_SECRET'],
  ollama: ['OLLAMA_BASE_URL'],
  minio: ['MINIO_ENDPOINT', 'MINIO_ROOT_USER', 'MINIO_ROOT_PASSWORD'],
  meilisearch: ['MEILISEARCH_URL', 'MEILISEARCH_API_KEY'],
  bullmq: ['REDIS_URL'],
}

export function getRequiredEnvVars(choices: ProviderChoices): string[] {
  const vars = new Set<string>()
  for (const provider of Object.values(choices)) {
    const required = providerEnvVars[provider]
    if (required) {
      for (const v of required) vars.add(v)
    }
  }
  // Always generated
  vars.add('JWT_SECRET')
  vars.add('COOKIE_SECRET')
  vars.add('ENCRYPTION_KEY')
  return Array.from(vars)
}
