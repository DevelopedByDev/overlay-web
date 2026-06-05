import { defineOverlayExtensions } from '@overlay/extension-sdk'
import { johnsHopkinsExtension } from './johns-hopkins/extension'

export const overlayExtensions = defineOverlayExtensions([
  johnsHopkinsExtension,
])
