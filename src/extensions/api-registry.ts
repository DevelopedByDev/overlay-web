import { defineOverlayExtensions } from '@overlay/extension-sdk'
import { studentRevisionApiExtension } from './student-revision/api'

export const overlayExtensionApiExtensions = defineOverlayExtensions([
  studentRevisionApiExtension,
])
