import {
  createProviders,
  type IAuth,
  type IAI,
  type IBilling,
  type ICache,
  type IDatabase,
  type OverlayConfig as CoreOverlayConfig,
  type ProviderInstances,
  type IStorage,
} from '@overlay/core'
import { convex } from '@/lib/convex'
import { getConfig } from '@/lib/config/singleton'
import type { OverlayConfigType } from '@/lib/config/schema'
import {
  authenticateNativeWithCode,
  clearSession,
  createUser,
  getAuthorizationUrl,
  getNativeAuthorizationUrl,
  getSession,
  handleCallback,
  refreshSessionFromRefreshToken,
  refreshSessionFromStoredSession,
  resendVerificationEmail,
  resetPassword,
  sendPasswordResetEmail,
  verifyEmail,
} from '@/lib/workos-auth'

let cachedProviders: ProviderInstances | null = null

export function getOverlayProviders(): ProviderInstances {
  if (!cachedProviders) {
    cachedProviders = createProviders(toCoreConfig(getConfig()), {
      convexClient: convex,
      workosHandlers: {
        getSession,
        createSignInUrl: (options) =>
          getAuthorizationUrl(toWorkOSProvider(options?.provider), {
            redirectUri: options?.redirectUri,
            codeChallenge: options?.codeChallenge,
          }),
        createSignUpUrl: (options) =>
          getAuthorizationUrl(toWorkOSProvider(options?.provider), {
            redirectUri: options?.redirectUri,
            codeChallenge: options?.codeChallenge,
          }),
        handleCallback: async (request) => {
          const code = new URL(request.url).searchParams.get('code')
          if (!code) throw new Error('Auth callback is missing code.')
          const result = await handleCallback(code)
          if (!result.success || !result.user) {
            throw new Error(result.error || 'Authentication failed')
          }
          const session = await getSession()
          if (!session) throw new Error('Authentication succeeded but no session was created.')
          return { session }
        },
        refreshSession: async (session) => {
          if (!session.refreshToken) throw new Error('Unable to refresh session without a refresh token.')
          const refreshed = await refreshSessionFromStoredSession(session as Parameters<typeof refreshSessionFromStoredSession>[0])
          if (!refreshed) throw new Error('Unable to refresh session.')
          return refreshed
        },
        signOut: async () => clearSession(),
        createNativeAuthorizationUrl: (options) =>
          getNativeAuthorizationUrl(toNativeWorkOSProvider(options.provider), {
            redirectUri: options.redirectUri || '/auth/mobile-complete',
            codeChallenge: options.codeChallenge || '',
            state: options.redirectUri || '/',
          }),
        exchangeNativeCode: async (code, codeVerifier) => authenticateNativeWithCode(code, codeVerifier || ''),
        refreshNativeSession: async (refreshToken) => {
          const refreshed = await refreshSessionFromRefreshToken(refreshToken)
          if (!refreshed) throw new Error('Unable to refresh native session.')
          return refreshed
        },
        createUser: async (params) => {
          const result = await createUser(params.email, params.password || '', params.firstName, params.lastName)
          if (!result.success || !result.user) throw new Error(result.error || 'Unable to create user.')
          return result.user
        },
        sendPasswordResetEmail: async (email) => {
          const result = await sendPasswordResetEmail(email)
          if (!result.success) throw new Error(result.error || 'Unable to send password reset email.')
        },
        resetPassword: async (token, password) => {
          const result = await resetPassword(token, password)
          if (!result.success) throw new Error(result.error || 'Unable to reset password.')
        },
        verifyEmail: async (token) => {
          const [userId, code] = token.split(':')
          if (!userId || !code) throw new Error('Email verification token must be userId:code.')
          const result = await verifyEmail(userId, code)
          if (!result.success) throw new Error(result.error || 'Unable to verify email.')
          const session = await getSession()
          if (!session) throw new Error('Email verified but no active session was found.')
          return session.user
        },
        resendVerificationEmail: async (emailOrUserId) => {
          const result = await resendVerificationEmail(emailOrUserId)
          if (!result.success) throw new Error(result.error || 'Unable to resend verification email.')
        },
      },
    })
  }

  return cachedProviders
}

export function getDatabaseProvider(): IDatabase {
  return getOverlayProviders().database
}

export function getAuthProvider(): IAuth {
  return getOverlayProviders().auth
}

export function resetOverlayProvidersForTests(): void {
  cachedProviders = null
}

function toCoreConfig(config: OverlayConfigType): CoreOverlayConfig {
  return {
    version: '1.0',
    deployment: {
      mode: config.deployment.mode,
      domain: config.deployment.domain,
      trustProxyHeaders: config.deployment.trustProxyHeaders,
    },
    providers: {
      database: config.providers.database,
      auth: normalizeAuthProvider(config.providers.auth),
      storage: config.providers.storage,
      aiGateway: normalizeAiProvider(config.providers.aiGateway),
      billing: config.providers.billing,
      cache: config.providers.cache,
      queue: config.providers.queue,
      search: config.providers.search,
    },
    database: config.database,
    auth: {
      workos: {},
      oidc: config.auth.oidc,
      saml: config.auth.saml,
      sessionTTLMinutes: config.auth.sessionTTLMinutes,
      roleMapping: config.auth.roleMapping as Record<string, 'superadmin' | 'admin' | 'user' | 'guest'>,
      defaultRole: config.auth.defaultRole,
    },
    storage: {
      publicUrlTtlSeconds: config.storage.publicUrlTtlSeconds,
      r2: config.storage.r2,
      s3: config.storage.s3,
      minio: config.storage.minio,
      local: config.storage.local,
    },
    ai: {
      vercel: config.ai.vercel,
      openrouter: config.ai.openrouter,
      ollama: config.ai.ollama,
      vllm: config.ai.vllm,
    },
    billing: {
      disabled: {
        tier: config.billing.provider === 'none' ? 'max' : 'max',
        budgetTotalCents: 1_000_000_000,
      },
    },
    cache: config.cache,
  }
}

function normalizeAuthProvider(provider: OverlayConfigType['providers']['auth']): CoreOverlayConfig['providers']['auth'] {
  if (provider === 'keycloak') return 'oidc'
  return provider as CoreOverlayConfig['providers']['auth']
}

function normalizeAiProvider(provider: OverlayConfigType['providers']['aiGateway']): CoreOverlayConfig['providers']['aiGateway'] {
  if (provider === 'vercel-ai') return 'vercel-ai'
  return provider as CoreOverlayConfig['providers']['aiGateway']
}

export function getStorageProvider(): IStorage {
  const storage = getOverlayProviders().storage
  if (!storage) throw new Error('Storage provider was not initialized.')
  return storage
}

export function getAIProvider(): IAI {
  const ai = getOverlayProviders().ai
  if (!ai) throw new Error('AI provider was not initialized.')
  return ai
}

export function getBillingProvider(): IBilling {
  const billing = getOverlayProviders().billing
  if (!billing) throw new Error('Billing provider was not initialized.')
  return billing
}

export function getCacheProvider(): ICache {
  const cache = getOverlayProviders().cache
  if (!cache) throw new Error('Cache provider was not initialized.')
  return cache
}

function toWorkOSProvider(provider?: string): 'GoogleOAuth' | 'AppleOAuth' | 'MicrosoftOAuth' {
  if (provider === 'apple') return 'AppleOAuth'
  if (provider === 'microsoft') return 'MicrosoftOAuth'
  return 'GoogleOAuth'
}

function toNativeWorkOSProvider(provider?: string): 'GoogleOAuth' | 'AppleOAuth' | 'MicrosoftOAuth' | 'authkit' {
  if (provider === 'apple') return 'AppleOAuth'
  if (provider === 'microsoft') return 'MicrosoftOAuth'
  if (provider === 'authkit') return 'authkit'
  return 'GoogleOAuth'
}
