import {
  DEFAULT_OVERLAY_FEATURE_MODULES,
  DEFAULT_OVERLAY_INTEGRATION_REGISTRY,
  DEFAULT_OVERLAY_MODEL_PROVIDER_REGISTRY,
  DEFAULT_OVERLAY_NAVIGATION,
  DEFAULT_OVERLAY_POLICY_GATES,
  DEFAULT_OVERLAY_SETTINGS_PANELS,
  DEFAULT_OVERLAY_SETTINGS_SECTIONS,
  DEFAULT_OVERLAY_TOOL_REGISTRY,
  defineOverlayAppConfig,
} from '@overlay/app-core/app-shell'

export const overlayAppShell = defineOverlayAppConfig({
  brand: {
    name: 'Acme AI',
    shortName: 'Acme',
    logoSrc: '/assets/acme-logo.png',
    logoAlt: 'Acme',
    homeHref: '/app/chat',
    supportEmail: 'it@acme.example',
    organizationName: 'Acme Corp',
  },
  navigation: [
    ...DEFAULT_OVERLAY_NAVIGATION,
    {
      id: 'security',
      label: 'Security',
      href: '/app/settings?section=security',
      icon: 'shield-check',
      componentKey: 'acme.nav.security',
    },
  ],
  settingsSections: [
    ...DEFAULT_OVERLAY_SETTINGS_SECTIONS,
    { id: 'security', label: 'Security', icon: 'shield-check' },
  ],
  settingsPanels: [
    ...DEFAULT_OVERLAY_SETTINGS_PANELS,
    {
      id: 'security-policy',
      sectionId: 'security',
      label: 'Security Policy',
      description: 'Enterprise policy controls for tools, providers, and data handling.',
      componentKey: 'acme.settings.securityPolicy',
      order: 10,
    },
  ],
  featureModules: [
    ...DEFAULT_OVERLAY_FEATURE_MODULES,
    {
      id: 'admin-console',
      label: 'Admin Console',
      routePatterns: ['/app/admin'],
      componentKey: 'acme.modules.adminConsole',
      packageName: '@acme/overlay-admin-module',
      order: 90,
    },
  ],
  tools: [
    ...DEFAULT_OVERLAY_TOOL_REGISTRY,
    {
      id: 'ticket-search',
      label: 'Ticket Search',
      description: 'Search internal IT tickets from chat and projects.',
      category: 'integration',
      componentKey: 'acme.tools.ticketSearch',
      policyGateId: 'internal-ticketing',
    },
  ],
  integrations: [
    ...DEFAULT_OVERLAY_INTEGRATION_REGISTRY,
    {
      id: 'servicenow',
      label: 'ServiceNow',
      providerKey: 'servicenow',
      description: 'Enterprise ticketing and incident workflows.',
      componentKey: 'acme.integrations.servicenow',
      policyGateId: 'internal-ticketing',
    },
  ],
  modelProviders: [
    ...DEFAULT_OVERLAY_MODEL_PROVIDER_REGISTRY,
    {
      id: 'acme-vllm',
      label: 'Acme vLLM',
      providerKey: 'acme-vllm',
      description: 'Private zero-retention model gateway.',
      componentKey: 'acme.modelProviders.vllm',
    },
  ],
  policyGates: [
    ...DEFAULT_OVERLAY_POLICY_GATES,
    {
      id: 'internal-ticketing',
      label: 'Internal Ticketing',
      description: 'Controls access to IT ticket search and automation tools.',
      defaultEnabled: false,
      enforcement: 'disable',
      reason: 'Enable this only for users in approved IT groups.',
    },
  ],
  modelPolicy: {
    filterChatModels(models) {
      return models.filter((model) => model.supportsZeroDataRetention)
    },
  },
})
