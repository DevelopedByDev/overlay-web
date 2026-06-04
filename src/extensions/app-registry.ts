import { defineOverlayExtensions } from '@overlay/extension-sdk'
import { jpisSchoolExtension } from './jpis-school/extension'

export const overlayExtensions = defineOverlayExtensions([
  jpisSchoolExtension,
])
