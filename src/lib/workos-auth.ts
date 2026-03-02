import { WorkOS } from '@workos-inc/node'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// Initialize WorkOS client with dev/prod environment support
const isDev = process.env.NODE_ENV === 'development'
const workosApiKey = isDev 
  ? (process.env.DEV_WORKOS_API_KEY || process.env.WORKOS_API_KEY)
  : process.env.WORKOS_API_KEY
const clientId = isDev
  ? (process.env.DEV_WORKOS_CLIENT_ID || process.env.WORKOS_CLIENT_ID || '')
  : (process.env.WORKOS_CLIENT_ID || '')

const workos = new WorkOS(workosApiKey)

// Session cookie configuration
const SESSION_COOKIE_NAME = 'overlay_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

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

// Get the base URL for redirects
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
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
  
  const baseRedirectUri = `${getBaseUrl()}/api/auth/callback`
  console.log('[WorkOS] Building auth URL:', { provider, baseRedirectUri, redirectUri, forceSignIn, clientId: clientId.substring(0, 15) + '...' })
  
  // Build authorization URL options
  const options: Parameters<typeof workos.userManagement.getAuthorizationUrl>[0] = {
    provider,
    clientId,
    redirectUri: baseRedirectUri,
    state: redirectUri ? Buffer.from(redirectUri).toString('base64') : undefined,
  }
  
  // Force sign-in screen when coming from desktop app
  // This prevents auto-redirecting if the user has an existing OAuth session
  if (forceSignIn) {
    options.screenHint = 'sign-in'
  }
  
  let authorizationUrl: string
  try {
    authorizationUrl = workos.userManagement.getAuthorizationUrl(options)
    console.log('[WorkOS] Generated URL successfully')
  } catch (error) {
    // Fallback: try without screenHint if it causes issues
    console.error('[WorkOS] Error with screenHint, trying without:', error)
    delete options.screenHint
    authorizationUrl = workos.userManagement.getAuthorizationUrl(options)
    
    // Add prompt=login manually to the URL to force re-authentication
    if (forceSignIn) {
      const url = new URL(authorizationUrl)
      url.searchParams.set('prompt', 'login')
      authorizationUrl = url.toString()
    }
    console.log('[WorkOS] Generated fallback URL successfully')
  }

  return authorizationUrl
}

// Generate authorization URL for email/password auth flow
export function getEmailAuthUrl(redirectUri?: string): string {
  const baseRedirectUri = `${getBaseUrl()}/api/auth/callback`
  
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: 'authkit',
    clientId,
    redirectUri: baseRedirectUri,
    state: redirectUri ? Buffer.from(redirectUri).toString('base64') : undefined,
  })

  return authorizationUrl
}

// Authenticate with email and password
export async function authenticateWithPassword(
  email: string,
  password: string
): Promise<{ success: boolean; user?: AuthUser; error?: string; pendingEmailVerification?: boolean }> {
  try {
    const response = await workos.userManagement.authenticateWithPassword({
      clientId,
      email,
      password,
    })

    const user: AuthUser = {
      id: response.user.id,
      email: response.user.email,
      firstName: response.user.firstName || undefined,
      lastName: response.user.lastName || undefined,
      profilePictureUrl: response.user.profilePictureUrl || undefined,
      emailVerified: response.user.emailVerified,
    }

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
    const response = await workos.userManagement.authenticateWithCode({
      clientId,
      code,
    })

    const user: AuthUser = {
      id: response.user.id,
      email: response.user.email,
      firstName: response.user.firstName || undefined,
      lastName: response.user.lastName || undefined,
      profilePictureUrl: response.user.profilePictureUrl || undefined,
      emailVerified: response.user.emailVerified,
    }

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
    await workos.userManagement.sendVerificationEmail({
      userId,
    })
    return { success: true }
  } catch (error: unknown) {
    const err = error as { message?: string }
    return { success: false, error: err.message || 'Failed to send verification email' }
  }
}

// Session management
export async function createSession(session: AuthSession): Promise<void> {
  const cookieStore = await cookies()
  const encryptedSession = Buffer.from(JSON.stringify(session)).toString('base64')
  
  cookieStore.set(SESSION_COOKIE_NAME, encryptedSession, {
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
    const session: AuthSession = JSON.parse(
      Buffer.from(sessionCookie.value, 'base64').toString('utf-8')
    )

    // Check if session is expired
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

export async function requireAuth(): Promise<AuthSession> {
  const session = await getSession()
  if (!session) {
    redirect('/auth/sign-in')
  }
  return session
}

// Get current user from session
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession()
  return session?.user || null
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

  try {
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
