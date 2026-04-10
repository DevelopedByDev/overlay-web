export interface AppIntegrationSummary {
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  isConnected: boolean;
  connectedAccountId?: string | null;
}

export interface AppConnectedIntegrationsResponse {
  connected: string[];
  items: Array<Omit<AppIntegrationSummary, "isConnected" | "connectedAccountId">>;
}

export interface AppIntegrationSearchResponse {
  items: AppIntegrationSummary[];
  nextCursor: string | null;
}

export interface AppIntegrationConnectResult {
  redirectUrl: string | null;
  connectionId: string | null;
  status: string | null;
}

export interface AppIntegrationDisconnectResult {
  success: true;
}
