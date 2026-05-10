// @enterprise-future — not wired to production
// Example auth provider plugin entrypoint (server-side)

import { defineAuthProvider } from '@overlay/plugin-sdk/server'

export default defineAuthProvider({
  id: 'example.oidc',
  type: 'oidc',
  async authenticate(_request) {
    // Placeholder: real implementation would validate OIDC tokens
    return {
      success: true,
      user: {
        id: 'example-user-1',
        email: 'user@example.com',
        firstName: 'Example',
        lastName: 'User',
      },
    }
  },
  async getUserProfile(userId) {
    if (userId === 'example-user-1') {
      return {
        id: userId,
        email: 'user@example.com',
        firstName: 'Example',
        lastName: 'User',
      }
    }
    return null
  },
})
