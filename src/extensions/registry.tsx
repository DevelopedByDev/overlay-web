import type { ComponentType, ReactNode } from 'react'
import type {
  OverlayFeatureModule,
  OverlaySettingsPanel,
} from '@overlay/app-core'
export { overlayExtensions } from './app-registry'

export interface OverlayExtensionComponentProps {
  featureModule?: OverlayFeatureModule
  settingsPanel?: OverlaySettingsPanel
  pathname?: string
  slug?: readonly string[]
}

const componentRegistry: Record<
  string,
  ComponentType<OverlayExtensionComponentProps>
> = {}

export const extensionComponents = componentRegistry

export function getExtensionComponent(componentKey: string | null | undefined) {
  if (!componentKey) return null
  return componentRegistry[componentKey] ?? null
}

export function renderExtensionComponent(
  componentKey: string | null | undefined,
  props: OverlayExtensionComponentProps,
): ReactNode | null {
  const Component = getExtensionComponent(componentKey)
  return Component ? <Component {...props} /> : null
}
