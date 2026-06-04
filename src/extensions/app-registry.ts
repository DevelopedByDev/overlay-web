import { defineOverlayExtensions } from '@overlay/extension-sdk'
import { jpgsSchoolExtension } from './jpgs-school/extension'
import { studentRevisionExtension } from './student-revision/extension'

export const overlayExtensions = defineOverlayExtensions([
  studentRevisionExtension,
  jpgsSchoolExtension,
])
