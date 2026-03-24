import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { WorkOS } from '@workos-inc/node'
import { getBaseUrl } from './url'

const isDev = process.env.NODE_ENV === 'development'
const workosApiKey = isDev 
  ? (process.env.DEV_WORKOS_API_KEY || process.env.WORKOS_API_KEY)
  : process.env.WORKOS_API_KEY
const clientId = isDev
  ? (process.env.DEV_WORKOS_CLIENT_ID || process.env.WORKOS_CLIENT_ID || '')
  : (process.env.WORKOS_CLIENT_ID || '')

const SESSION_COOKIE_NAME = 'overlay_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30
const DEFAULT_AUTH_REDIRECT = '/account'
export const MOBILE_AUTH_REDIRECT_PATH = '/auth/mobile-complete'

function getWorkOS(requireApiKey = false): WorkOS {
  if (requireApiKey && !workosApiKey) {
    throw new Error(
      isDev
        ? 'WorkOS API key is not configured. Set DEV_WORKOS_API_KEY or WORKOS_API_KEY for server-side auth.'
        : 'WorkOS API key is not configured. Set WORKOS_API_KEY for server-side auth.'
    )
  }

  if (workosApiKey) {
    return new WorkOS({ apiKey: workosApiKey })
  }

  if (clientId) {
    return new WorkOS({ clientId })
  }

  throw new Error(
    isDev
      ? 'WorkOS is not configured. Set DEV_WORKOS_CLIENT_ID/WORKOS_CLIENT_ID and DEV_WORKOS_API_KEY/WORKOS_API_KEY.'
      : 'WorkOS is not configured. Set WORKOS_CLIENT_ID and WORKOS_API_KEY.'
  )
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim()
  if (!secret) {
    throw new Error('SESSION_SECRET is not configured')
  }
  return secret
}

function signPayload(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('hex')
}

function verifySignedCookie(cookieValue: string): string | null {
  const separatorIndex = cookieValue.lastIndexOf('.')
  if (separatorIndex === -1) return null

  const payload = cookieValue.substring(0, separatorIndex)
  const signature = cookieValue.substring(separatorIndex + 1)

  const expectedSignature = signPayload(payload)

  try {
    const sigBuf = Buffer.from(signature, 'hex')
    const expectedBuf = Buffer.from(expectedSignature, 'hex')
    if (sigBuf.length !== expectedBuf.length) return null
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null
  } catch {
    return null
  }

  return payload
}

export interface AuthUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  profilePictureUrl?: string
  emailVerified: boolean
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  user: AuthUser
  expiresAt: number
}

export { getBaseUrl }

function toAuthUser(user: {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  profilePictureUrl?: string | null
  emailVerified: boolean
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName || undefined,
    lastName: user.lastName || undefined,
    profilePictureUrl: user.profilePictureUrl || undefined,
    emailVerified: user.emailVerified,
  }
}

export function normalizeAuthRedirect(redirectUri?: string | null): string | null {
  if (redirectUri == null) {
    return DEFAULT_AUTH_REDIRECT
  }

  const trimmed = redirectUri.trim()
  if (!trimmed) {
    return DEFAULT_AUTH_REDIRECT
  }

  if (trimmed.startsWith('overlay://')) {
    return MOBILE_AUTH_REDIRECT_PATH
  }

  if (trimmed.startsWith('/')) {
    return trimmed.startsWith('//') ? null : trimmed
  }

  try {
    const baseUrl = new URL(getBaseUrl())
    const candidate = new URL(trimmed)
    if (candidate.origin !== baseUrl.origin) {
      return null
    }
    return `${candidate.pathname}${candidate.search}${candidate.hash}` || DEFAULT_AUTH_REDIRECT
  } catch {
    return null
  }
}

// Generate authorization URL for SSO providers
export function getAuthorizationUrl(
  provider: 'GoogleOAuth' | 'AppleOAuth' | 'MicrosoftOAuth',
  redirectUri?: string,
  forceSignIn?: boolean
): string {
  if (!clientId) {
    throw new Error('WorkOS client ID is not configured')
  }

  const workos = getWorkOS()
  const baseRedirectUri = `${getBaseUrl()}/api/auth/callback`
  const normalizedRedirectUri = normalizeAuthRedirect(redirectUri)
  if (redirectUri && normalizedRedirectUri === null) {
    throw new Error('Invalid redirect URI')
  }
  // Build authorization URL options
  const options: Parameters<typeof workos.userManagement.getAuthorizationUrl>[0] = {
    provider,
    clientId,
    redirectUri: baseRedirectUri,
    state:
      normalizedRedirectUri && normalizedRedirectUri !== DEFAULT_AUTH_REDIRECT
        ? Buffer.from(normalizedRedirectUri).toString('base64')
        : undefined,
  }
  
  // Force sign-in screen when coming from desktop app
  // This prevents auto-redirecting if the user has an existing OAuth session
  if (forceSignIn) {
    options.screenHint = 'sign-in'
  }
  
  let authorizationUrl: string
  try {
    authorizationUrl = workos.userManagement.getAuthorizationUrl(options)
  } catch {
    // Fallback: try without screenHint if it causes issues
    delete options.screenHint
    authorizationUrl = workos.userManagement.getAuthorizationUrl(options)

    if (forceSignIn) {
      const url = new URL(authorizationUrl)
      url.searchParams.set('prompt', 'login')
      authorizationUrl = url.toString()
    }
  }

  return authorizationUrl
}

// Authenticate with email and password
export async function authenticateWithPassword(
  email: string,
  password: string
): Promise<{ success: boolean; user?: AuthUser; error?: string; pendingEmailVerification?: boolean }> {
  try {
    const workos = getWorkOS(true)
    const response = await workos.userManagement.authenticateWithPassword({
      clientId,
      email,
      password,
    })

    const user = toAuthUser(response.user)

    // Create session
    await createSession({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user,
      expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
    })

    return { success: true, user }
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err.code === 'email_verification_required') {
      return { success: false, pendingEmailVerification: true, error: 'Please verify your email before signing in.' }
    }
    return { success: false, error: err.message || 'Authentication failed' }
  }
}

// Create a new user with email and password
export async function createUser(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
): Promise<{ success: boolean; user?: AuthUser; error?: string; pendingEmailVerification?: boolean }> {
  try {
    const workos = getWorkOS(true)
    const user = await workos.userManagement.createUser({
      email,
      password,
      firstName,
      lastName,
      emailVerified: false,
    })

    // Send verification email
    await workos.userManagement.sendVerificationEmail({
      userId: user.id,
    })

    return {
      success: true,
      pendingEmailVerification: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        profilePictureUrl: user.profilePictureUrl || undefined,
        emailVerified: user.emailVerified,
      },
    }
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err.code === 'user_already_exists') {
      return { success: false, error: 'An account with this email already exists.' }
    }
    return { success: false, error: err.message || 'Failed to create account' }
  }
}

// Handle OAuth callback - exchange code for session
export async function handleCallback(
  code: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const workos = getWorkOS(true)
    const response = await workos.userManagement.authenticateWithCode({
      clientId,
      code,
    })

    const user = toAuthUser(response.user)

    // Create session
    await createSession({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user,
      expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
    })

    return { success: true, user }
  } catch (error: unknown) {
    const err = error as { message?: string }
    return { success: false, error: err.message || 'Authentication failed' }
  }
}

// Send password reset email
export async function sendPasswordResetEmail(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const workos = getWorkOS(true)
    // WorkOS User Management API - create password reset challenge
    await workos.userManagement.createPasswordReset({
      email,
    })
    return { success: true }
  } catch {
    // Don't reveal if email exists or not for security
    return { success: true } // Always return success to prevent email enumeration
  }
}

// Reset password with token
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const workos = getWorkOS(true)
    await workos.userManagement.resetPassword({
      token,
      newPassword,
    })
    return { success: true }
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err.code === 'password_reset_token_expired') {
      return { success: false, error: 'Reset link has expired. Please request a new one.' }
    }
    return { success: false, error: err.message || 'Failed to reset password' }
  }
}

// Verify email with code
export async function verifyEmail(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const workos = getWorkOS(true)
    await workos.userManagement.verifyEmail({
      userId,
      code,
    })
    return { success: true }
  } catch (error: unknown) {
    const err = error as { message?: string }
    return { success: false, error: err.message || 'Failed to verify email' }
  }
}

// Resend verification email
export async function resendVerificationEmail(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const workos = getWorkOS(true)
    await workos.userManagement.sendVerificationEmail({
      userId,
    })
    return { success: true }
  } catch (error: unknown) {
    const err = error as { message?: string }
    return { success: false, error: err.message || 'Failed to send verification email' }
  }
}

export async function createSession(session: AuthSession): Promise<void> {
  const cookieStore = await cookies()
  const payload = Buffer.from(JSON.stringify(session)).toString('base64')
  const signature = signPayload(payload)
  const signedCookie = `${payload}.${signature}`
  
  cookieStore.set(SESSION_COOKIE_NAME, signedCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  
  if (!sessionCookie) {
    return null
  }

  try {
    // Try HMAC-signed format first
    const payload = verifySignedCookie(sessionCookie.value)
    if (!payload) {
      await clearSession()
      return null
    }

    const session: AuthSession = JSON.parse(
      Buffer.from(payload, 'base64').toString('utf-8')
    )
    if (session.expiresAt < Date.now()) {
      await clearSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

// Refresh session token if needed
export async function refreshSessionIfNeeded(): Promise<AuthSession | null> {
  const session = await getSession()
  if (!session) {
    return null
  }

  // Refresh if less than 1 day until expiration
  const oneDayFromNow = Date.now() + 24 * 60 * 60 * 1000
  if (session.expiresAt > oneDayFromNow) {
    return session
  }

  if (!workosApiKey) {
    return session
  }

  try {
    const workos = getWorkOS(true)
    const response = await workos.userManagement.authenticateWithRefreshToken({
      clientId,
      refreshToken: session.refreshToken,
    })

    const newSession: AuthSession = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: session.user,
      expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
    }

    await createSession(newSession)
    return newSession
  } catch {
    await clearSession()
    return null
  }
}

export async function refreshSessionFromRefreshToken(
  refreshToken: string,
  expectedUserId?: string
): Promise<AuthSession | null> {
  if (!refreshToken) {
    return null
  }

  try {
    const workos = getWorkOS(true)
    const response = await workos.userManagement.authenticateWithRefreshToken({
      clientId,
      refreshToken,
    })

    if (expectedUserId && response.user.id !== expectedUserId) {
      return null
    }

    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: toAuthUser(response.user),
      expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
    }
  } catch {
    return null
  }
}
