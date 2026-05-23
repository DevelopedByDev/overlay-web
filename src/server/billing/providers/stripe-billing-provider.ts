import 'server-only'

import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/shared/internal-api-secret'
import { stripe, getBaseUrl } from '@/server/billing/stripe'
import {
  getPlanQuantityForCheckout,
  getTopUpPriceId,
  getTopUpQuantityForCheckout,
  isRecognizedTopUpAmount,
  resolvePaidUnitPriceId,
  resolvePortalConfigurationId,
} from '@/server/billing/stripe-billing'
import { refreshEntitlementsForUser } from '@/server/billing/billing-runtime'
import {
  clampPaidPlanAmountCents,
  clampTopUpAmountCents,
} from '@/shared/billing/billing-pricing'
import {
  createFreeEntitlements,
  StripeBillingProvider as CoreStripeBillingProvider,
  type StripeBillingClient,
  type UsageArgs,
} from '@overlay/billing'

type SubscriptionBillingState = {
  email?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}

async function getSubscriptionState(userId: string): Promise<SubscriptionBillingState | null> {
  return await convex.query<SubscriptionBillingState | null>(
    'billing/subscriptions:getByUserIdByServer',
    {
      serverSecret: getInternalApiSecret(),
      userId,
    },
    { throwOnError: true },
  )
}

async function recordUsage(args: UsageArgs): Promise<void> {
  if (!args.accessToken) {
    throw new Error('StripeBillingProvider.recordUsage requires an access token')
  }

  await convex.mutation(
    'platform/usage:recordUsage',
    {
      accessToken: args.accessToken,
      userId: args.userId,
      type: args.type,
      modelId: args.modelId,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      cachedTokens: args.cachedTokens,
      cost: args.cost,
    },
    { throwOnError: true },
  )
}

export class StripeBillingProvider extends CoreStripeBillingProvider {
  constructor() {
    super({
      stripe: stripe as unknown as StripeBillingClient,
      baseUrl: getBaseUrl,
      paidPlanPriceId: resolvePaidUnitPriceId,
      topUpPriceId: getTopUpPriceId,
      portalConfigurationId: resolvePortalConfigurationId,
      getEntitlements: refreshEntitlementsForUser,
      getSubscriptionState,
      recordUsage,
      createFreeEntitlements,
      normalizePlanAmountCents: clampPaidPlanAmountCents,
      normalizeTopUpAmountCents: clampTopUpAmountCents,
      isRecognizedTopUpAmount,
      planQuantityForAmountCents: getPlanQuantityForCheckout,
      topUpQuantityForAmountCents: getTopUpQuantityForCheckout,
    })
  }
}
