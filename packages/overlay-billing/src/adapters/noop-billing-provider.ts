import { createFreeEntitlements } from '../entitlements'
import type {
  BillingProvider,
  CheckoutArgs,
  CheckoutResult,
  Entitlements,
  PortalResult,
  UsageArgs,
} from '../types'

export class NoOpBillingProvider implements BillingProvider {
  async getEntitlements(userId: string): Promise<Entitlements> {
    void userId
    return createFreeEntitlements()
  }

  async createCheckoutSession(args: CheckoutArgs): Promise<CheckoutResult> {
    void args
    return { url: 'about:blank' }
  }

  async createPortalSession(userId: string): Promise<PortalResult> {
    void userId
    return { url: 'about:blank' }
  }

  async recordUsage(args: UsageArgs): Promise<void> {
    void args
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    void subscriptionId
  }
}
