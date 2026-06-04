import { defineOverlayExtensions } from '@overlay/extension-sdk'
import { jpisSchoolApiExtension } from './jpis-school/api'

export const overlayExtensionApiExtensions = defineOverlayExtensions([
  jpisSchoolApiExtension,
])
