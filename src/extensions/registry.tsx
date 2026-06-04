import type { ComponentType, ReactNode } from 'react'
import type {
  OverlayFeatureModule,
  OverlaySettingsPanel,
} from '@overlay/app-core'
import { JpisAdminDashboard } from './jpis-school/JpisAdminDashboard'
import { JpisParentDashboard } from './jpis-school/JpisParentDashboard'
import { JpisStudentDashboard } from './jpis-school/JpisStudentDashboard'
import { JpisTeacherDashboard } from './jpis-school/JpisTeacherDashboard'
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
> = {
  'school.modules.adminDashboard': JpisAdminDashboard,
  'school.modules.parentDashboard': JpisParentDashboard,
  'school.modules.studentDashboard': JpisStudentDashboard,
  'school.modules.teacherDashboard': JpisTeacherDashboard,
}

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
