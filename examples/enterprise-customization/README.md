# Enterprise Customization Example

This example shows how a self-hosted deployment can customize Overlay without editing package internals.

Copy the shape of `overlay.config.ts` into the web app’s `src/overlay.config.ts`, then implement local renderers for any custom `componentKey` values in the web container layer.
