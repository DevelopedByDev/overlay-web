import 'server-only'

import { NextResponse } from 'next/server'
import { BillingCheckoutService } from './BillingCheckoutService'
import { BillingCustomerService, BillingServiceError } from './BillingCustomerService'
import { ConvexBillingRepository } from './ConvexBillingRepository'

const billingRepository = new ConvexBillingRepository()

export const billingCustomerService = new BillingCustomerService({
  repository: billingRepository,
})

export const billingCheckoutService = new BillingCheckoutService({
  repository: billingRepository,
})

export function billingErrorResponse(error: unknown, fallback: string) {
  if (error instanceof BillingServiceError) {
    return NextResponse.json(error.payload, { status: error.statusCode })
  }
  return NextResponse.json({ error: fallback }, { status: 500 })
}
