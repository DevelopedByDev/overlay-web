import { NextRequest, NextResponse } from 'next/server'
import { handleCallback, getBaseUrl, getSession } from '@/lib/workos-auth'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

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
    try {
      const session = await getSession()
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
        // Check if it's a deep link (overlay://)
        if (decodedState.startsWith('overlay://')) {
          // For desktop app auth, redirect to callback page that handles deep link
          const deepLinkUrl = new URL(decodedState)
          deepLinkUrl.searchParams.set('code', code)
          return NextResponse.redirect(`${getBaseUrl()}/auth/callback?code=${code}`)
        }
        redirectTo = decodedState
      } catch {
        // Invalid state, use default redirect
      }
    }

    return NextResponse.redirect(`${getBaseUrl()}${redirectTo}`)
  } catch (error) {
    console.error('[Auth] Callback error:', error)
    return NextResponse.redirect(`${getBaseUrl()}/auth/sign-in?error=Authentication failed`)
  }
}
