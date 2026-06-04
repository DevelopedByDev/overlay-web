import type { ComponentType, ReactNode } from 'react'
import type {
  OverlayFeatureModule,
  OverlaySettingsPanel,
} from '@overlay/app-core'
import { JpgsAdminDashboard } from './jpgs-school/JpgsAdminDashboard'
import { JpgsParentDashboard } from './jpgs-school/JpgsParentDashboard'
import { JpgsTeacherDashboard } from './jpgs-school/JpgsTeacherDashboard'
import { StudentRevisionDashboard } from './student-revision/StudentRevisionDashboard'
import { StudentRevisionPolicySettings } from './student-revision/StudentRevisionPolicySettings'
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
  'jpgs.modules.adminDashboard': JpgsAdminDashboard,
  'jpgs.modules.parentDashboard': JpgsParentDashboard,
  'jpgs.modules.teacherDashboard': JpgsTeacherDashboard,
  'student.modules.revisionDashboard': StudentRevisionDashboard,
  'student.settings.revisionPolicy': StudentRevisionPolicySettings,
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
