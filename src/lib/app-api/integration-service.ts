import path from "node:path";
import { pathToFileURL } from "node:url";
import { getServerProviderKey } from "@/lib/server-provider-keys";
import type {
  AppConnectedIntegrationsResponse,
  AppIntegrationConnectResult,
  AppIntegrationDisconnectResult,
  AppIntegrationSearchResponse,
} from "@/lib/app-api/integration-contract";

type ComposioAppRecord = {
  key?: string;
  slug?: string;
  name?: string;
  displayName?: string;
  display_name?: string;
  appName?: string;
  app_name?: string;
  description?: string;
  logo?: string;
  logoUrl?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadComposioSDK(apiKey: string): Promise<any> {
  let ComposioModule: { Composio: new (args: { apiKey: string }) => unknown };

  try {
    ComposioModule = await import("@composio/core");
  } catch {
    const coreUrl = pathToFileURL(
      path.resolve(
        process.cwd(),
        "../overlay-desktop/node_modules/@composio/core/dist/index.mjs",
      ),
    ).href;
    ComposioModule = await import(/* webpackIgnore: true */ coreUrl);
  }

  const { Composio } = ComposioModule;
  return new Composio({ apiKey });
}

export async function getAppComposioApiKey(
  accessToken: string,
): Promise<string | null> {
  const serverKey = accessToken
    ? await getServerProviderKey("composio")
    : null;
  return serverKey ?? process.env.COMPOSIO_API_KEY ?? null;
}

function firstNonEmptyString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function fallbackDisplayName(slug: string): string {
  return slug
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapAppRecord(app: ComposioAppRecord) {
  const slug = normalizeSlug(
    firstNonEmptyString(
      app.key,
      app.slug,
      app.appName,
      app.app_name,
      app.name,
    ) ?? "",
  );
  const name = firstNonEmptyString(
    app.displayName,
    app.display_name,
    app.name,
    app.appName,
    app.app_name,
  );
  return {
    slug,
    name: name ?? fallbackDisplayName(slug),
    description: firstNonEmptyString(app.description) ?? "",
    logoUrl: firstNonEmptyString(app.logoUrl, app.logo),
  };
}

async function fetchAppRecord(apiKey: string, slug: string) {
  const res = await fetch(
    `https://backend.composio.dev/api/v1/apps/${encodeURIComponent(slug)}`,
    {
      headers: { "x-api-key": apiKey },
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as ComposioAppRecord;
  const item = mapAppRecord(data);
  return item.slug ? item : null;
}

export async function listConnectedAppIntegrations(
  userId: string,
  accessToken: string,
): Promise<AppConnectedIntegrationsResponse> {
  const apiKey = await getAppComposioApiKey(accessToken);
  if (!apiKey) return { connected: [], items: [] };

  const res = await fetch(
    `https://backend.composio.dev/api/v1/connectedAccounts?entityId=${encodeURIComponent(userId)}&page=1&pageSize=100`,
    { headers: { "x-api-key": apiKey } },
  );

  if (!res.ok) return { connected: [], items: [] };
  const data = (await res.json()) as { items?: Array<{ appName?: string }> };
  const connected: string[] = [
    ...new Set(
      ((data.items ?? []) as Array<{ appName?: string }>)
        .map((item) => normalizeSlug(item.appName || ""))
        .filter(Boolean),
    ),
  ];
  const items = (
    await Promise.all(
      connected.map((slug) => fetchAppRecord(apiKey, slug).catch(() => null)),
    )
  )
    .filter(
      (
        item,
      ): item is NonNullable<Awaited<ReturnType<typeof fetchAppRecord>>> =>
        item !== null,
    )
    .map((item) => ({
      slug: item.slug,
      name: item.name,
      description: item.description,
      logoUrl: item.logoUrl,
    }));

  return { connected, items };
}

export async function searchAppIntegrations(input: {
  userId: string;
  accessToken: string;
  query?: string;
  cursor?: string;
  limit?: number;
}): Promise<AppIntegrationSearchResponse> {
  const apiKey = await getAppComposioApiKey(input.accessToken);
  if (!apiKey) return { items: [], nextCursor: null };

  const limit = Math.min(input.limit ?? 12, 50);

  const connectedRes = await fetch(
    `https://backend.composio.dev/api/v1/connectedAccounts?entityId=${encodeURIComponent(input.userId)}&page=1&pageSize=100`,
    { headers: { "x-api-key": apiKey } },
  );
  const connectedData = connectedRes.ok
    ? await connectedRes.json()
    : { items: [] };
  const connectedMap = new Map<string, string>();
  for (const acc of connectedData.items || []) {
    if (acc.appName) connectedMap.set(acc.appName.toLowerCase(), acc.id);
  }

  const url = new URL("https://backend.composio.dev/api/v1/apps");
  if (input.query) url.searchParams.set("query", input.query);
  if (input.cursor) url.searchParams.set("cursor", input.cursor);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) return { items: [], nextCursor: null };
  const data = await res.json();

  const rawItems: ComposioAppRecord[] = Array.isArray(data)
    ? data
    : (data.items || []);

  let items = rawItems
    .map((app) => {
      const mapped = mapAppRecord(app);
      const slug = mapped.slug;
      const connectedId = connectedMap.get(slug) ?? null;
      return {
        slug,
        name: mapped.name,
        description: mapped.description,
        logoUrl: mapped.logoUrl,
        isConnected: connectedId !== null,
        connectedAccountId: connectedId,
      };
    })
    .filter((item) => item.slug);

  if (input.query) {
    const normalizedQuery = input.query.toLowerCase();
    items = items.filter(
      (item) =>
        item.slug.includes(normalizedQuery) ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery),
    );
  }

  return { items, nextCursor: data.nextCursor ?? null };
}

export async function connectAppIntegration(input: {
  userId: string;
  accessToken: string;
  toolkit: string;
  origin: string;
}): Promise<AppIntegrationConnectResult> {
  const apiKey = await getAppComposioApiKey(input.accessToken);
  if (!apiKey) throw new Error("Composio not configured");

  const composio = await loadComposioSDK(apiKey);
  const callbackUrl = `${input.origin}/auth/composio/callback`;

  let authConfigId: string;
  try {
    const authConfigs = await composio.authConfigs.list({ toolkit: input.toolkit });
    const firstConfig = (authConfigs.items ?? authConfigs)?.[0];
    if (firstConfig?.id) {
      authConfigId = firstConfig.id;
    } else {
      const created = await composio.authConfigs.create(input.toolkit, {
        type: "use_composio_managed_auth",
      });
      authConfigId = created.id;
    }
  } catch (err) {
    console.error("[Integrations] Failed to get/create auth config:", err);
    throw new Error(`Could not find auth config for ${input.toolkit}`);
  }

  const connectionRequest = await composio.connectedAccounts.link(
    input.userId,
    authConfigId,
    { callbackUrl },
  );

  const redirectUrl =
    typeof connectionRequest.redirectUrl === "string" &&
    connectionRequest.redirectUrl.startsWith("http")
      ? connectionRequest.redirectUrl
      : null;

  return {
    redirectUrl,
    connectionId: connectionRequest.id ?? connectionRequest.connectionId ?? null,
    status: connectionRequest.status ?? null,
  };
}

export async function disconnectAppIntegration(input: {
  userId: string;
  accessToken: string;
  toolkit: string;
}): Promise<AppIntegrationDisconnectResult> {
  const apiKey = await getAppComposioApiKey(input.accessToken);
  if (!apiKey) throw new Error("Composio not configured");

  const composio = await loadComposioSDK(apiKey);
  const accounts = await composio.connectedAccounts.list({
    userIds: [input.userId],
    toolkitSlugs: [input.toolkit],
  });
  const deleteRequests: Array<Promise<unknown>> = [];
  for (const acc of accounts.items ?? []) {
    if (acc && typeof acc === "object" && "id" in acc && typeof acc.id === "string") {
      deleteRequests.push(composio.connectedAccounts.delete(acc.id));
    }
  }
  await Promise.all(deleteRequests);
  return { success: true };
}
