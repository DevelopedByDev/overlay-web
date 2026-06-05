import { defineOverlayExtensions } from '@overlay/extension-sdk'
import { johnsHopkinsApiExtension } from './johns-hopkins/api'

export const overlayExtensionApiExtensions = defineOverlayExtensions([
  johnsHopkinsApiExtension,
])
