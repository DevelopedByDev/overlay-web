import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { stripe } from '@/lib/stripe'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const serverSecret = getInternalApiSecret()
    const includeLogs = request.nextUrl.searchParams.get('logs') === '1'

    const [computer, logs] = await Promise.all([
      convex.query('computers:get', {
        computerId: id,
        userId: session.user.id,
        serverSecret,
      }),
      includeLogs
        ? convex.query('computers:listEvents', {
            computerId: id,
            userId: session.user.id,
            serverSecret,
          })
        : Promise.resolve(null),
    ])

    if (!computer) {
      return NextResponse.json({ error: 'Computer not found' }, { status: 404 })
    }

    return NextResponse.json({
      computer,
      logs: Array.isArray(logs) ? logs : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch computer'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { sessionId }: { sessionId?: string } = await request.json()
    if (!sessionId?.trim()) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (checkoutSession.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }

    const subscription = checkoutSession.subscription as import('stripe').Stripe.Subscription | null
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription missing from checkout session' }, { status: 400 })
    }

    const metadataUserId = subscription.metadata?.userId
    const metadataComputerId = subscription.metadata?.computerId

    if (metadataUserId !== session.user.id || metadataComputerId !== id) {
      return NextResponse.json({ error: 'Session mismatch' }, { status: 403 })
    }

    const serverSecret = getInternalApiSecret()
    const stripeCustomerId = typeof checkoutSession.customer === 'string'
      ? checkoutSession.customer
      : checkoutSession.customer?.id

    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'Stripe customer missing from checkout session' }, { status: 400 })
    }

    const result = await convex.action<{ status: string }>('computers:activatePaidComputer', {
      computerId: id,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId,
      serverSecret,
    })

    return NextResponse.json({ ok: true, status: result?.status ?? 'pending_payment' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to activate computer'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const serverSecret = getInternalApiSecret()

    await convex.action('computers:deleteComputerInstance', {
      computerId: id,
      userId: session.user.id,
      serverSecret,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete computer'
    const status =
      message === 'Unauthorized'
        ? 401
        : message === 'Computer not found'
          ? 404
          : 500
    return NextResponse.json({ error: message }, { status })
  }
}
