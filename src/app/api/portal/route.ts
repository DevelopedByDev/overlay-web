import { NextRequest, NextResponse } from 'next/server'
import { stripe, getBaseUrl } from '@/lib/stripe'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { resolvePortalConfigurationId } from '@/lib/stripe-billing'

interface Subscription {
  userId: string
  email?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  tier: 'free' | 'pro' | 'max'
  planKind?: 'free' | 'paid'
  planAmountCents?: number
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
}

async function findCustomerIdByEmail(email?: string): Promise<string | undefined> {
  if (!email) return undefined

  const customers = await stripe.customers.list({
    email,
    limit: 10,
  })

  if (customers.data.length === 0) return undefined

  const customersWithActiveSubscriptions = await Promise.all(
    customers.data.map(async (customer) => {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 10,
      })

      const activeSubscription = subscriptions.data.find((subscription) =>
        ['active', 'trialing', 'past_due'].includes(subscription.status),
      )

      return {
        customerId: customer.id,
        activeSubscription,
        created: customer.created ?? 0,
      }
    }),
  )

  const preferred =
    customersWithActiveSubscriptions.find((candidate) => candidate.activeSubscription)?.customerId ??
    customersWithActiveSubscriptions.sort((a, b) => b.created - a.created)[0]?.customerId

  return preferred
}

async function resolveExistingCustomerId(customerId?: string): Promise<string | undefined> {
  if (!customerId) return undefined

  try {
    const customer = await stripe.customers.retrieve(customerId)
    if (typeof customer === 'string') return customer
    if ('deleted' in customer && customer.deleted) return undefined
    return customer.id
  } catch {
    return undefined
  }
}

export async function POST(request: NextRequest) {
  try {
    const authSession = await getSession()
    if (!authSession || !authSession.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const userId = authSession.user.id
    const body = await request.json().catch(() => ({}))
    const { sessionId } = body

    let customerId: string | undefined
    let subscriptionId: string | undefined

    // If we have a checkout session ID, get customer from there
    if (sessionId) {
      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId)
      customerId = await resolveExistingCustomerId(checkoutSession.customer as string)
    }

    // Otherwise, look up customer from our database
    if (!customerId) {
      const subscription = await convex.query<Subscription>('subscriptions:getByUserId', {
        accessToken: authSession.accessToken,
        userId,
      })
      customerId = await resolveExistingCustomerId(subscription?.stripeCustomerId || undefined)
      subscriptionId = subscription?.stripeSubscriptionId || undefined

      if (!customerId && subscriptionId) {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)
        customerId = await resolveExistingCustomerId(
          typeof stripeSubscription.customer === 'string'
            ? stripeSubscription.customer
            : stripeSubscription.customer?.id,
        )
      }

      if (!customerId) {
        customerId = await findCustomerIdByEmail(authSession.user.email || subscription?.email)
      }

      if (customerId && !subscription?.stripeCustomerId) {
        await convex.mutation('subscriptions:upsertSubscription', {
          serverSecret: process.env.INTERNAL_API_SECRET || '',
          userId,
          email: authSession.user.email,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          tier: subscription?.tier,
          planKind: subscription?.planKind,
          planAmountCents: subscription?.planAmountCents,
          status: subscription?.status,
        })
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'No customer found. Please subscribe first.' },
        { status: 400 }
      )
    }

    const baseUrl = getBaseUrl()

    // Create billing portal session
    const portalConfigurationId = resolvePortalConfigurationId()

    let portalSession
    try {
      portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}/account`,
        ...(portalConfigurationId ? { configuration: portalConfigurationId } : {}),
      })
    } catch (error) {
      const stripeError = error as { code?: string; message?: string; type?: string }
      const invalidConfiguration =
        stripeError?.code === 'resource_missing' ||
        (stripeError?.type === 'StripeInvalidRequestError' &&
          stripeError?.message?.toLowerCase().includes('configuration'))

      if (!portalConfigurationId || !invalidConfiguration) {
        throw error
      }

      console.warn(
        `[portal] Falling back to default portal configuration because ${portalConfigurationId} is invalid.`,
      )
      portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}/account`,
      })
    }

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('Portal error:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
