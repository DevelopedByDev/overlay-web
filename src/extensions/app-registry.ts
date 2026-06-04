import { defineOverlayExtensions } from '@overlay/extension-sdk'
import { studentRevisionExtension } from './student-revision/extension'

export const overlayExtensions = defineOverlayExtensions([
  studentRevisionExtension,
])
