import { defineOverlayExtensions } from '@overlay/extension-sdk'
import { jpgsSchoolApiExtension } from './jpgs-school/api'
import { studentRevisionApiExtension } from './student-revision/api'

export const overlayExtensionApiExtensions = defineOverlayExtensions([
  studentRevisionApiExtension,
  jpgsSchoolApiExtension,
])
