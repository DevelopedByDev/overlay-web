import { NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    if (!session.accessToken) {
      return NextResponse.json(
        { error: 'Missing access token' },
        { status: 401 }
      )
    }

    // Sync user profile to Convex
    const result = await convex.mutation(api.users.syncUserProfile, {
      accessToken: session.accessToken,
      userId: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      profilePictureUrl: session.user.profilePictureUrl,
    })

    return NextResponse.json({
      success: true,
      isNewUser: result.isNewUser,
    })
  } catch (error) {
    console.error('[Auth] Profile sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync profile' },
      { status: 500 }
    )
  }
}
