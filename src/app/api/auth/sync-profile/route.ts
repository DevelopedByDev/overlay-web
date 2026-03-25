import { NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'

export async function POST() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const result = await convex.mutation<{ success: boolean; isNewUser: boolean }>('users:syncUserProfileByServer', {
      serverSecret: getInternalApiSecret(),
      userId: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      profilePictureUrl: session.user.profilePictureUrl,
    }, { throwOnError: true })

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to sync profile' },
        { status: 502 }
      )
    }

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
