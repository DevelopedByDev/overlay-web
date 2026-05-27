import PricingClient from './PricingClient'
import { getOverlayCapabilitiesSync } from '@/server/capabilities'

export default function PricingPage() {
  const capabilities = getOverlayCapabilitiesSync()
  return <PricingClient billingEnabled={capabilities.billing} />
}
