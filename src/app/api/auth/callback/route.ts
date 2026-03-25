import { NextRequest, NextResponse } from 'next/server'
import {
  handleCallback,
  getBaseUrl,
  getSession,
  MOBILE_AUTH_REDIRECT_PATH,
  normalizeAuthRedirect,
} from '@/lib/workos-auth'
import { logAuthDebug, summarizeSessionForLog } from '@/lib/auth-debug'
import { convex as serverConvex } from '@/lib/convex'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'
import { createHash, randomBytes } from 'crypto'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { encryptSessionTransferPayload } from '@/lib/session-transfer-crypto'

// Use dev Convex URL in development
const IS_DEV = process.env.NODE_ENV === 'development'
const CONVEX_URL = IS_DEV
  ? (process.env.DEV_NEXT_PUBLIC_CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL!)
  : process.env.NEXT_PUBLIC_CONVEX_URL!

const SESSION_TRANSFER_TTL_MS = 90 * 1000

function hashTransferTokenForLog(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 12)
}

const convex = new ConvexHttpClient(CONVEX_URL)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors
  if (error) {
    const errorMsg = encodeURIComponent(errorDescription || error)
    return NextResponse.redirect(`${getBaseUrl()}/auth/sign-in?error=${errorMsg}`)
  }

  if (!code) {
    return NextResponse.redirect(`${getBaseUrl()}/auth/sign-in?error=No authorization code received`)
  }

  try {
    logAuthDebug('/api/auth/callback start', {
      hasCode: Boolean(code),
      hasState: Boolean(state),
    })
    const result = await handleCallback(code)

    if (!result.success || !result.user) {
      const errorMsg = encodeURIComponent(result.error || 'Authentication failed')
      return NextResponse.redirect(`${getBaseUrl()}/auth/sign-in?error=${errorMsg}`)
    }

    // Sync user profile to Convex (creates subscription record if it doesn't exist)
    const session = await getSession()
    logAuthDebug('/api/auth/callback post-handleCallback session', summarizeSessionForLog(session))

    const inspectAccessToken = async (accessToken: string, userId: string) => {
      try {
        const response = await fetch(`${CONVEX_URL}/api/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: 'authDebug:inspectAccessToken',
            format: 'json',
            args: {
              serverSecret: getInternalApiSecret(),
              accessToken,
              userId,
            },
          }),
        })
        const body = await response.json() as {
          status?: string
          value?: Record<string, unknown>
          errorMessage?: string
        }
        if (!response.ok || body.status === 'error') {
          return {
            inspectionFailed: true,
            error: body.errorMessage || `HTTP ${response.status}`,
          }
        }
        return body.value ?? null
      } catch (inspectionError) {
        return {
          inspectionFailed: true,
          error: inspectionError instanceof Error ? inspectionError.message : String(inspectionError),
        }
      }
    }

    try {
      if (session?.accessToken) {
        logAuthDebug('/api/auth/callback syncUserProfile start', {
          callbackUserId: result.user.id,
          session: summarizeSessionForLog(session),
          convexInspection: await inspectAccessToken(session.accessToken, result.user.id),
        })
        await serverConvex.mutation('users:syncUserProfileByServer', {
          serverSecret: getInternalApiSecret(),
          userId: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          profilePictureUrl: result.user.profilePictureUrl,
        }, { throwOnError: true })
        logAuthDebug('/api/auth/callback syncUserProfile success', {
          callbackUserId: result.user.id,
        })
        console.log('[Auth] User profile synced to Convex:', result.user.id)
      }
    } catch (syncError) {
      logAuthDebug('/api/auth/callback syncUserProfile error', {
        callbackUserId: result.user.id,
        error: syncError instanceof Error ? syncError.message : String(syncError),
        session: summarizeSessionForLog(session),
        convexInspection: session?.accessToken
          ? await inspectAccessToken(session.accessToken, result.user.id)
          : null,
      })
      console.error('[Auth] Failed to sync user profile:', syncError)
      // Continue anyway - user can still use the app
    }

    // Decode state to get redirect URI if present
    let redirectTo = '/account'
    if (state) {
      try {
        const decodedState = Buffer.from(state, 'base64').toString('utf-8')
        const normalizedRedirect = normalizeAuthRedirect(decodedState)
        if (normalizedRedirect) {
          redirectTo = normalizedRedirect
        } else {
          console.warn('[Auth] Ignoring invalid callback redirect state')
        }
      } catch {
        // Invalid state, use default redirect
      }
    }

    // Handle mobile app auth: generate a transfer token and deep link directly
    // instead of redirecting to a separate page that may not be deployed.
    if (redirectTo === MOBILE_AUTH_REDIRECT_PATH && session) {
      try {
        const authData = {
          userId: session.user.id,
          email: session.user.email,
          firstName: session.user.firstName || '',
          lastName: session.user.lastName || '',
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
        }

        const token = randomBytes(16).toString('hex')
        const expiresAt = Date.now() + SESSION_TRANSFER_TTL_MS

        await convex.mutation(api.sessionTransfer.storeToken, {
          serverSecret: getInternalApiSecret(),
          token,
          data: encryptSessionTransferPayload(JSON.stringify(authData)),
          expiresAt,
        })

        console.log('[Auth] Created mobile session transfer token', {
          userId: session.user.id,
          tokenHashPrefix: hashTransferTokenForLog(token),
          expiresAt,
        })

        return NextResponse.redirect(`overlay://auth/transfer?token=${token}`)
      } catch (mobileError) {
        console.error('[Auth] Failed to generate mobile transfer token:', mobileError)
        // Fall through to redirect to the page which shows a user-friendly error
      }
    }

    return NextResponse.redirect(new URL(redirectTo, getBaseUrl()))
  } catch (error) {
    console.error('[Auth] Callback error:', error)
    return NextResponse.redirect(`${getBaseUrl()}/auth/sign-in?error=Authentication failed`)
  }
}
