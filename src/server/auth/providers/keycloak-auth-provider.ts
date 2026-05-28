import 'server-only'

import { OidcAuthProvider, type OidcAuthProviderConfig } from './oidc-auth-provider'

export interface KeycloakAuthProviderConfig extends OidcAuthProviderConfig {
  realm?: string
}

export class KeycloakAuthProvider extends OidcAuthProvider {
  readonly providerConfigSummary: {
    provider: 'keycloak'
    issuerUrl?: string
    clientId?: string
    hasClientSecret: boolean
    audience?: string
    realm?: string
  }

  constructor(config: KeycloakAuthProviderConfig = {}) {
    super(config)
    this.providerConfigSummary = {
      provider: 'keycloak',
      ...(config.issuerUrl ? { issuerUrl: config.issuerUrl } : {}),
      ...(config.clientId ? { clientId: config.clientId } : {}),
      hasClientSecret: Boolean(config.clientSecret),
      ...(config.audience ? { audience: config.audience } : {}),
      ...(config.realm ? { realm: config.realm } : {}),
    }
  }
}
