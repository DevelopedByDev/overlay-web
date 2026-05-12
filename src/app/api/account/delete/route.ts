import { NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'

import { api } from '../../../../../convex/_generated/api'
import { clearSession, getSession } from '@/lib/workos-auth'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { deleteObjects } from '@/lib/r2'
import { stripe } from '@/lib/stripe'
import { WorkOS } from '@workos-inc/node'

import { z } from '@/lib/api-schemas'

const AccountDeleteRequestSchema = z.object({}).openapi('AccountDeleteRequest')
const AccountDeleteResponseSchema = z.unknown().openapi('AccountDeleteResponse')
void AccountDeleteRequestSchema
void AccountDeleteResponseSchema

/**
 * POST /api/account/delete
 *
 * Permanently deletes the authenticated user. Required by Apple's App Store
 * Review Guidelines 5.1.1(v): the user must be able to initiate account
 * deletion from inside the app, and the deletion must actually purge data.
 *
 * Order of operations is important:
 *   1. Verify the caller has a live session (otherwise we can't trust userId).
 *   2. Cancel the Stripe subscription (best effort; never block deletion).
 *   3. Wipe Convex rows + collect storage handles (single mutation, atomic).
 *   4. Delete the underlying R2 objects (best effort; orphans don't risk data
 *      loss, just unbilled bytes — log loudly if it fails).
 *   5. Delete the WorkOS user. Doing this last guarantees we never end up in a
 *      state where the auth user is gone but their data is still in Convex.
 *   6. Clear the session cookie.
 *
 * If any step after (3) fails we still return success — the row of record is
 * Convex, and once those rows are gone the account is functionally deleted.
 * Failures are logged so we can clean up out-of-band if needed.
 */
function resolveConvexUrl(): string {
  const isDev = process.env.NODE_ENV === 'development'
  if (isDev && process.env.DEV_NEXT_PUBLIC_CONVEX_URL) {
    return process.env.DEV_NEXT_PUBLIC_CONVEX_URL
  }
  if (process.env.NEXT_PUBLIC_CONVEX_URL) return process.env.NEXT_PUBLIC_CONVEX_URL
  throw new Error('CONVEX_URL is not configured')
}

function resolveWorkOsApiKey(): string | null {
  return (
    process.env.WORKOS_API_KEY?.trim() ||
    process.env.DEV_WORKOS_API_KEY?.trim() ||
    null
  )
}

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const userId = session.user.id
  const userEmail = session.user.email

  let convexResult: {
    r2Keys: string[]
    storageIds: string[]
    stripeSubscriptionId?: string
    stripeCustomerId?: string
    deletedRowCount: number
    email?: string
  }

  // Step 1+2: cancel the Stripe subscription if there is one. We read the
  // subscription row indirectly by letting the Convex mutation return the
  // Stripe IDs alongside the deleted-row count, but we also try to look it
  // up first so a Stripe failure never strands a still-active subscription.
  // To keep this simple we proceed straight to the Convex deletion (which
  // returns the Stripe IDs), then cancel after the DB write succeeds. That
  // means a worst-case orphan Stripe sub gets cancelled in our Stripe webhook
  // since the Convex row is already gone — see ARCHITECTURE notes.
  try {
    const convex = new ConvexHttpClient(resolveConvexUrl())
    convexResult = await convex.mutation(api.users.deleteUserAccountByServer, {
      serverSecret: getInternalApiSecret(),
      userId,
    })
  } catch (error) {
    console.error('[account/delete] Convex deletion failed:', error)
    return NextResponse.json(
      {
        error: 'Could not delete your account data. Please try again or contact support@getoverlay.io.',
      },
      { status: 500 },
    )
  }

  console.log(
    `[account/delete] Convex purge complete for ${userId} (${userEmail}): ${convexResult.deletedRowCount} rows`,
  )

  // Step 3: cancel the Stripe subscription. Best effort — if Stripe is
  // unavailable we log and continue; the user is still gone from Convex.
  if (convexResult.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(convexResult.stripeSubscriptionId)
      console.log(
        `[account/delete] Stripe subscription canceled: ${convexResult.stripeSubscriptionId}`,
      )
    } catch (error) {
      console.error(
        `[account/delete] Stripe cancel failed for ${convexResult.stripeSubscriptionId}:`,
        error,
      )
    }
  }

  // Step 4: purge R2 blobs in batches of 1000 (S3 DeleteObjects limit).
  if (convexResult.r2Keys.length > 0) {
    try {
      const BATCH = 1000
      for (let i = 0; i < convexResult.r2Keys.length; i += BATCH) {
        await deleteObjects(convexResult.r2Keys.slice(i, i + BATCH))
      }
      console.log(`[account/delete] R2 purge complete: ${convexResult.r2Keys.length} objects`)
    } catch (error) {
      console.error('[account/delete] R2 purge failed (orphaned objects may remain):', error)
    }
  }

  // Step 5: delete the WorkOS user. This is what actually invalidates
  // refresh tokens, removes them from password lookups, etc.
  const workOsApiKey = resolveWorkOsApiKey()
  if (workOsApiKey) {
    try {
      const workos = new WorkOS(workOsApiKey)
      await workos.userManagement.deleteUser(userId)
      console.log(`[account/delete] WorkOS user deleted: ${userId}`)
    } catch (error) {
      console.error(`[account/delete] WorkOS deleteUser failed for ${userId}:`, error)
    }
  } else {
    console.warn('[account/delete] WORKOS_API_KEY not set; skipping WorkOS user deletion')
  }

  // Step 6: clear the session cookie so the next request is unauthenticated.
  await clearSession()

  return NextResponse.json({
    success: true,
    deletedRowCount: convexResult.deletedRowCount,
  })
}
