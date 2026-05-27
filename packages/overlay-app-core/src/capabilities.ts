export interface CapabilityCheck {
  billing: boolean
  sso: boolean
  apiKeys: boolean
  webhooks: boolean
  vectorSearch: boolean
  automations: boolean
  multiTenant: boolean
}

export type OverlayCapability = keyof CapabilityCheck

export const DEFAULT_OVERLAY_CAPABILITIES: CapabilityCheck = {
  billing: true,
  sso: true,
  apiKeys: false,
  webhooks: false,
  vectorSearch: true,
  automations: true,
  multiTenant: false,
}

export function deriveOverlayCapabilities(
  input?: Partial<CapabilityCheck> | { capabilities?: Partial<CapabilityCheck> } | null,
): CapabilityCheck {
  const capabilities =
    input && 'capabilities' in input
      ? input.capabilities
      : input

  return {
    ...DEFAULT_OVERLAY_CAPABILITIES,
    ...(capabilities ?? {}),
  }
}

export function areOverlayCapabilitiesEnabled(
  capabilities: CapabilityCheck,
  requiredCapabilities: readonly OverlayCapability[] | undefined,
): boolean {
  if (!requiredCapabilities || requiredCapabilities.length === 0) return true
  return requiredCapabilities.every((capability) => capabilities[capability])
}
