import { NextRequest, NextResponse } from 'next/server'
import {
  handleCallback,
  getBaseUrl,
  getSession,
  MOBILE_AUTH_REDIRECT_PATH,
  normalizeAuthRedirect,
} from '@/lib/workos-auth'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'
import { randomBytes } from 'crypto'
import { getInternalApiSecret } from '@/lib/internal-api-secret'

// Use dev Convex URL in development
const IS_DEV = process.env.NODE_ENV === 'development'
const CONVEX_URL = IS_DEV
  ? (process.env.DEV_NEXT_PUBLIC_CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL!)
  : process.env.NEXT_PUBLIC_CONVEX_URL!

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
    const result = await handleCallback(code)

    if (!result.success || !result.user) {
      const errorMsg = encodeURIComponent(result.error || 'Authentication failed')
      return NextResponse.redirect(`${getBaseUrl()}/auth/sign-in?error=${errorMsg}`)
    }

    // Sync user profile to Convex (creates subscription record if it doesn't exist)
    const session = await getSession()
    try {
      if (session?.accessToken) {
        await convex.mutation(api.users.syncUserProfile, {
          accessToken: session.accessToken,
          userId: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          profilePictureUrl: result.user.profilePictureUrl,
        })
        console.log('[Auth] User profile synced to Convex:', result.user.id)
      }
    } catch (syncError) {
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
        const expiresAt = Date.now() + 5 * 60 * 1000

        await convex.mutation(api.sessionTransfer.storeToken, {
          serverSecret: getInternalApiSecret(),
          token,
          data: JSON.stringify(authData),
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
