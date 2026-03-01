import { NextRequest, NextResponse } from 'next/server'
import { stripe, getBaseUrl } from '@/lib/stripe'

const MIN_ADDON_AMOUNT = 10
const MAX_ADDON_AMOUNT = 100
const ADDON_MARGIN = 0.1 // 10% margin - user receives 90% of purchased amount

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const email = searchParams.get('email')
    const amountStr = searchParams.get('amount')
    const autoRenew = searchParams.get('autoRenew') === 'true'

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const amount = parseFloat(amountStr || '0')
    if (amount < MIN_ADDON_AMOUNT || amount > MAX_ADDON_AMOUNT) {
      return NextResponse.json(
        { error: `Amount must be between $${MIN_ADDON_AMOUNT} and $${MAX_ADDON_AMOUNT}` },
        { status: 400 }
      )
    }

    // Calculate credits received after margin
    const creditsReceived = amount * (1 - ADDON_MARGIN)
    const amountInCents = Math.round(amount * 100)

    const baseUrl = getBaseUrl()

    // Create a one-time payment checkout session with dynamic pricing
    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Add-on Credits ($${amount})`,
              description: `${creditsReceived.toFixed(2)} credits added to your account`
            },
            unit_amount: amountInCents
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${baseUrl}/account?success=true&addon=true&credits=${creditsReceived}&open_app=true`,
      cancel_url: `${baseUrl}/account?canceled=true`,
      metadata: {
        userId,
        type: 'addon',
        amount: String(amount),
        credits: String(creditsReceived),
        autoRenew: String(autoRenew)
      },
      payment_intent_data: {
        metadata: {
          userId,
          type: 'addon',
          amount: String(amount),
          credits: String(creditsReceived),
          autoRenew: String(autoRenew)
        }
      }
    })

    // Redirect to Stripe checkout
    if (session.url) {
      return NextResponse.redirect(session.url)
    }

    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  } catch (error) {
    console.error('Add-on checkout error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// Also support POST for programmatic access
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, amount, autoRenew = false } = body

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const parsedAmount = parseFloat(amount) || 0
    if (parsedAmount < MIN_ADDON_AMOUNT || parsedAmount > MAX_ADDON_AMOUNT) {
      return NextResponse.json(
        { error: `Amount must be between $${MIN_ADDON_AMOUNT} and $${MAX_ADDON_AMOUNT}` },
        { status: 400 }
      )
    }

    // Calculate credits received after margin
    const creditsReceived = parsedAmount * (1 - ADDON_MARGIN)
    const amountInCents = Math.round(parsedAmount * 100)

    const baseUrl = getBaseUrl()

    // Create a one-time payment checkout session with dynamic pricing
    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Add-on Credits ($${parsedAmount})`,
              description: `${creditsReceived.toFixed(2)} credits added to your account`
            },
            unit_amount: amountInCents
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${baseUrl}/account?success=true&addon=true&credits=${creditsReceived}&open_app=true`,
      cancel_url: `${baseUrl}/account?canceled=true`,
      metadata: {
        userId,
        type: 'addon',
        amount: String(parsedAmount),
        credits: String(creditsReceived),
        autoRenew: String(autoRenew)
      },
      payment_intent_data: {
        metadata: {
          userId,
          type: 'addon',
          amount: String(parsedAmount),
          credits: String(creditsReceived),
          autoRenew: String(autoRenew)
        }
      }
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    console.error('Add-on checkout error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    )
  }
}
