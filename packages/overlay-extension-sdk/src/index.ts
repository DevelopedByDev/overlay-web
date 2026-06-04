import type {
  CapabilityCheck,
  OverlayAppConfig,
  OverlayFeatureModule,
  OverlayIntegrationRegistration,
  OverlayModelProviderRegistration,
  OverlayNavigationItem,
  OverlayPolicyGate,
  OverlaySettingsSection,
  OverlaySettingsPanel,
  OverlaySidebarAction,
  OverlayToolRegistration,
} from '@overlay/app-core'

export type OverlayExtensionApiMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'

export interface OverlayExtensionApiContext {
  extensionId: string
  method: OverlayExtensionApiMethod
  path: string
  pathSegments: readonly string[]
  userId: string
  authType?: string
  apiKeyId?: string
  parsedQuery: Record<string, unknown>
  parsedJson: Record<string, unknown>
  parsedFormData: FormData | null
  capabilities: CapabilityCheck
}

export interface OverlayExtensionApiHandler {
  method: OverlayExtensionApiMethod
  path: string
  handler: (
    request: Request,
    context: OverlayExtensionApiContext,
  ) => Response | Promise<Response>
}

export interface OverlayExtensionDefinition {
  id: string
  version: string
  navigation?: readonly OverlayNavigationItem[]
  featureModules?: readonly OverlayFeatureModule[]
  sidebarActions?: readonly OverlaySidebarAction[]
  settingsSections?: readonly OverlaySettingsSection[]
  settingsPanels?: readonly OverlaySettingsPanel[]
  tools?: readonly OverlayToolRegistration[]
  integrations?: readonly OverlayIntegrationRegistration[]
  modelProviders?: readonly OverlayModelProviderRegistration[]
  policyGates?: readonly OverlayPolicyGate[]
  apiHandlers?: readonly OverlayExtensionApiHandler[]
}

export interface OverlayExtensionApiHandlerLookup {
  extensionId: string
  method: string
  path: string
}

export function defineOverlayExtension<const TExtension extends OverlayExtensionDefinition>(
  extension: TExtension,
): TExtension {
  assertExtensionId(extension.id)
  assertExtensionVersion(extension.version)
  return extension
}

export function defineOverlayExtensions<const TExtensions extends readonly OverlayExtensionDefinition[]>(
  extensions: TExtensions,
): TExtensions {
  assertUniqueExtensionIds(extensions)
  return extensions
}

export function extendOverlayAppConfig(
  baseConfig: OverlayAppConfig,
  extensions: readonly OverlayExtensionDefinition[],
): OverlayAppConfig {
  assertUniqueExtensionIds(extensions)
  return {
    ...baseConfig,
    navigation: appendRegistries(baseConfig.navigation, extensions.flatMap((extension) => extension.navigation ?? [])),
    featureModules: appendRegistries(baseConfig.featureModules, extensions.flatMap((extension) => extension.featureModules ?? [])),
    sidebarActions: appendRegistries(baseConfig.sidebarActions, extensions.flatMap((extension) => extension.sidebarActions ?? [])),
    settingsSections: appendRegistries(baseConfig.settingsSections, extensions.flatMap((extension) => extension.settingsSections ?? [])),
    settingsPanels: appendRegistries(baseConfig.settingsPanels, extensions.flatMap((extension) => extension.settingsPanels ?? [])),
    tools: appendRegistries(baseConfig.tools, extensions.flatMap((extension) => extension.tools ?? [])),
    integrations: appendRegistries(baseConfig.integrations, extensions.flatMap((extension) => extension.integrations ?? [])),
    modelProviders: appendRegistries(baseConfig.modelProviders, extensions.flatMap((extension) => extension.modelProviders ?? [])),
    policyGates: appendRegistries(baseConfig.policyGates, extensions.flatMap((extension) => extension.policyGates ?? [])),
  }
}

export function findOverlayExtensionApiHandler(
  extensions: readonly OverlayExtensionDefinition[],
  lookup: OverlayExtensionApiHandlerLookup,
): OverlayExtensionApiHandler | null {
  const method = normalizeMethod(lookup.method)
  if (!method) return null

  const extension = extensions.find((item) => item.id === lookup.extensionId)
  if (!extension) return null

  const path = normalizeExtensionPath(lookup.path)
  return extension.apiHandlers?.find((handler) =>
    handler.method === method && normalizeExtensionPath(handler.path) === path,
  ) ?? null
}

export function normalizeExtensionPath(path: string | readonly string[]): string {
  const raw = typeof path === 'string' ? path : path.join('/')
  const prefixed = raw.startsWith('/') ? raw : `/${raw}`
  const compact = prefixed.replace(/\/+/g, '/')
  if (compact.length > 1 && compact.endsWith('/')) return compact.slice(0, -1)
  return compact || '/'
}

export function extensionPathSegments(path: string): readonly string[] {
  return normalizeExtensionPath(path)
    .split('/')
    .filter(Boolean)
}

function normalizeMethod(method: string): OverlayExtensionApiMethod | null {
  const upper = method.toUpperCase()
  return isExtensionApiMethod(upper) ? upper : null
}

function isExtensionApiMethod(method: string): method is OverlayExtensionApiMethod {
  return (
    method === 'GET' ||
    method === 'POST' ||
    method === 'PUT' ||
    method === 'PATCH' ||
    method === 'DELETE'
  )
}

function appendRegistries<T>(base: readonly T[] | undefined, extensionItems: readonly T[]): readonly T[] | undefined {
  if (extensionItems.length === 0) return base
  return [...(base ?? []), ...extensionItems]
}

function assertUniqueExtensionIds(extensions: readonly OverlayExtensionDefinition[]): void {
  const seen = new Set<string>()
  for (const extension of extensions) {
    assertExtensionId(extension.id)
    if (seen.has(extension.id)) {
      throw new Error(`[extensions] Duplicate extension id "${extension.id}"`)
    }
    seen.add(extension.id)
  }
}

function assertExtensionId(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error('[extensions] Extension id must be lower-case kebab-case')
  }
}

function assertExtensionVersion(version: string): void {
  if (!version.trim()) {
    throw new Error('[extensions] Extension version is required')
  }
}
