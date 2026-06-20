# BYOK Provider Integration Plan

## Architecture summary (current state)

Your chat system flows: **client → BFF route (`src/server/app-api/v1/conversations/act/route.ts`) → `getLanguageModel()` (`src/server/ai/model-runtime.ts`) → `getOverlayServerContext().llmGateway.createLanguageModel()` → AI SDK provider instance → streamText**.

The production gateway is `OpenRouterGateway` (`src/server/ai/gateway/ai-gateway.ts:168`), which routes OpenRouter-prefixed models to OpenRouter directly and everything else through the Vercel AI Gateway. API keys are resolved from **WorkOS Vault → env vars** (`src/server/ai/gateway/server-provider-keys.ts`), with a 5-minute cache. There is **no per-user credential store** today.

`@ai-sdk/openai-compatible` (v2.0.35) is already installed. `AVAILABLE_MODELS` is dynamic — populated at runtime by `registerGatewayCatalogModels()` from the gateway catalog. The model dropdown (`ComprehensiveModelPicker`) and settings (`ModelCatalogSetting`) both consume this catalog, filtered by `userUiSettings.enabledChatModelIds`.

## Core design decisions

### 1. Use `@ai-sdk/openai-compatible` as the single BYOK adapter

`createOpenAICompatible({ name, apiKey, baseURL, headers, fetch })` handles every provider in your target list. Ollama, OpenRouter, Groq, NVIDIA NIM, Together, Fireworks, DeepSeek, xAI, Mistral, Cerebras, DeepInfra all expose OpenAI-compatible `/v1/chat/completions` endpoints. You don't need per-provider adapter classes — you need a **preset table** that supplies the right `baseURL` and discovery path, plus a `createOpenAICompatible` call at runtime with the user's key.

For **Ollama specifically**, install `@ai-sdk/ollama` (community provider) as well — it gives you native `/api/tags` model discovery and `/api/chat` streaming, which is better than forcing Ollama through the OpenAI-compat layer. The preset will select which adapter to use.

### 2. Store API keys in WorkOS Vault, metadata in Convex

You already use WorkOS Vault for server-side provider keys (`server-provider-keys.ts`). Extend it for per-user keys:

- **WorkOS Vault**: stores the actual API key/secret, keyed by `user_{userId}_{connectionId}_{provider}`. Never returned to the client.
- **Convex `userProviderConnections` table**: stores metadata — provider type, endpoint URL, display name, enabled model IDs, connection status, last-tested-at. No secrets in Convex.

This matches your existing pattern and avoids building a separate encryption layer.

### 3. BYOK models merge into the existing model dropdown

BYOK models appear in `ComprehensiveModelPicker` and `ModelCatalogSetting` alongside Overlay-hosted models, with a **provider badge** ("Yours" / provider name) to distinguish them. They're ordered by the user's configured priority, not `CHAT_MODEL_QUALITY_PRIORITY` (which is Overlay-curated). BYOK models show **"BYOK"** instead of a dollar cost — the user pays the provider directly, so Overlay doesn't track spend for them.

### 4. SSRF validation on user-supplied URLs

Before any fetch to a user-supplied endpoint, validate the URL server-side: block loopback (127.0.0.0/8), link-local (169.254.0.0/16), RFC1918 ranges, and non-`http(s)` schemes. Cloudflare Tunnel / ngrok / Tailscale Funnel URLs resolve to public IPs and pass. This runs in the connection-test endpoint and in the runtime model creation path.

---

## Key changes from feedback

1. **Cloud BYOK only for v1** — drop local Ollama, drop SSRF validation, drop `@ai-sdk/ollama`. All providers use `createOpenAICompatible`. Local Ollama is a future phase.

2. **Vercel AI Gateway becomes a provider** — it's pre-seeded, non-deletable, and its models come from the gateway catalog. It can optionally support BYOK (user pastes their own AI Gateway key). All models now live under "Providers", not a separate "Models" section.

3. **"Models" section becomes a drag-reorderable list** — a flat list of all enabled models across all providers. The drag order = dropdown order. Replaces `CHAT_MODEL_QUALITY_PRIORITY` with user-controlled ordering.

4. **Remove Ask mode entirely** — every conversation is Act mode. Single default model (`defaultActModelId`), no multi-model `defaultAskModelIds`. Added as a separate todo.

5. **No connection limit.**

6. **Cache + background refresh** for model discovery.

---

## Revised architecture

### Provider model

Every model source is a "provider connection":

| Provider | Pre-seeded? | Deletable? | Key source | Model discovery |
|----------|-------------|------------|------------|-----------------|
| Vercel AI Gateway | Yes | No | Server env/vault (Overlay's key) OR user's BYOK key | Gateway catalog (`/v1/models`) |
| OpenRouter | No | Yes | User's API key | `/v1/models` |
| Groq | No | Yes | User's API key | `/v1/models` |
| NVIDIA NIM | No | Yes | User's API key | `/v1/models` |
| Together | No | Yes | User's API key | `/v1/models` |
| Fireworks | No | Yes | User's API key | `/v1/models` |
| DeepSeek | No | Yes | User's API key | `/v1/models` |
| xAI | No | Yes | User's API key | `/v1/models` |
| Mistral | No | Yes | User's API key | `/v1/models` |
| Cerebras | No | Yes | User's API key | `/v1/models` |
| DeepInfra | No | Yes | User's API key | `/v1/models` |
| Custom | No | Yes | User's API key | `/v1/models` (optional) |

The Vercel AI Gateway connection is special: it exists by default for every user, can't be deleted, and uses Overlay's hosted key unless the user provides their own. Its model list comes from the existing `getGatewayLanguageCatalog()` flow.

### Model ID namespacing

- **Vercel AI Gateway models**: keep existing IDs (`claude-sonnet-4-6`, `gpt-5.4`, etc.) — no prefix, backward compatible.
- **BYOK models**: `byok/{connectionId}/{rawModelId}` — namespaced to avoid collisions.

### Model ordering

New field in `userUiSettings`: `modelOrder: string[]` — explicit drag-reorder list. Models not in the list are appended in their provider's discovery order. This replaces `CHAT_MODEL_QUALITY_PRIORITY` for dropdown ordering. The curated priority list is used only as the initial default order for new users.

---

## Implementation phases

### Phase 1: Provider preset registry + BYOK gateway adapter

**New file**: `packages/overlay-llm-gateway/src/adapters/byok-presets.ts`

Same preset table as before, but:
- Remove `ollama` preset (postponed)
- Remove `allowsCustomURL` for all cloud providers (only "Custom" allows it)
- Remove `adapter` field (all use `openai-compatible`)
- Add `vercel-ai-gateway` as a special preset with `isDefault: true, isDeletable: false`

```typescript
export const BYOK_PROVIDER_PRESETS: ByokProviderPreset[] = [
  { id: 'vercel-ai-gateway', label: 'Vercel AI Gateway', defaultBaseURL: 'https://ai-gateway.vercel.sh/v1', discoveryPath: '/v1/models', discoveryShape: 'openai', requiresApiKey: true, isDefault: true, isDeletable: false, docsURL: 'https://vercel.com/docs/ai-gateway' },
  { id: 'openrouter', label: 'OpenRouter', defaultBaseURL: 'https://openrouter.ai/api/v1', discoveryPath: '/models', discoveryShape: 'openai', requiresApiKey: true, isDeletable: true, headers: { 'HTTP-Referer': 'https://getoverlay.io', 'X-Title': 'Overlay' }, docsURL: 'https://openrouter.ai' },
  { id: 'groq', label: 'Groq', defaultBaseURL: 'https://api.groq.com/openai/v1', discoveryPath: '/models', discoveryShape: 'openai', requiresApiKey: true, isDeletable: true, docsURL: 'https://console.groq.com' },
  { id: 'nvidia-nim', label: 'NVIDIA NIM', defaultBaseURL: 'https://integrate.api.nvidia.com/v1', discoveryPath: '/models', discoveryShape: 'openai', requiresApiKey: true, isDeletable: true, docsURL: 'https://build.nvidia.com' },
  { id: 'together', label: 'Together AI', defaultBaseURL: 'https://api.together.xyz/v1', discoveryPath: '/models', discoveryShape: 'openai', requiresApiKey: true, isDeletable: true, docsURL: 'https://docs.together.ai' },
  { id: 'fireworks', label: 'Fireworks AI', defaultBaseURL: 'https://api.fireworks.ai/inference/v1', discoveryPath: '/models', discoveryShape: 'openai', requiresApiKey: true, isDeletable: true, docsURL: 'https://docs.fireworks.ai' },
  { id: 'deepseek', label: 'DeepSeek', defaultBaseURL: 'https://api.deepseek.com/v1', discoveryPath: '/models', discoveryShape: 'openai', requiresApiKey: true, isDeletable: true, docsURL: 'https://api-docs.deepseek.com' },
  { id: 'xai', label: 'xAI (Grok)', defaultBaseURL: 'https://api.x.ai/v1', discoveryPath: '/models', discoveryShape: 'openai', requiresApiKey: true, isDeletable: true, docsURL: 'https://docs.x.ai' },
  { id: 'mistral', label: 'Mistral', defaultBaseURL: 'https://api.mistral.ai/v1', discoveryPath: '/models', discoveryShape: 'openai', requiresApiKey: true, isDeletable: true, docsURL: 'https://docs.mistral.ai' },
  { id: 'cerebras', label: 'Cerebras', defaultBaseURL: 'https://api.cerebras.ai/v1', discoveryPath: '/models', discoveryShape: 'openai', requiresApiKey: true, isDeletable: true, docsURL: 'https://cerebras.ai' },
  { id: 'deepinfra', label: 'DeepInfra', defaultBaseURL: 'https://api.deepinfra.com/v1/openai', discoveryPath: '/models', discoveryShape: 'openai', requiresApiKey: true, isDeletable: true, docsURL: 'https://deepinfra.com' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', defaultBaseURL: '', discoveryPath: '/models', discoveryShape: 'openai', requiresApiKey: false, isDeletable: true, docsURL: '' },
]
```

**New file**: `packages/overlay-llm-gateway/src/adapters/byok-gateway.ts`

```typescript
export class ByokGateway implements LLMGateway {
  constructor(private connection: UserProviderConnection, private apiKey: string | null) {}

  async createLanguageModel(modelId: string, options?: ModelOptions): Promise<LanguageModel> {
    const preset = getByokPreset(this.connection.providerId)
    const provider = createOpenAICompatible({
      name: this.connection.providerId,
      apiKey: this.apiKey ?? undefined,
      baseURL: this.connection.endpoint,
      headers: { ...preset.headers, ...options?.headers },
    })
    return { id: modelId, provider: this.connection.providerId, implementation: provider(modelId) }
  }
}
```

No `@ai-sdk/ollama` install needed. No SSRF validation needed (all cloud URLs are public HTTPS).

### Phase 2: Convex schema + credential storage

**New table in `convex/schema.ts`**:

```typescript
userProviderConnections: defineTable({
  userId: v.string(),
  providerId: v.string(),           // preset id
  endpoint: v.string(),             // base URL
  displayName: v.string(),
  vaultKeyName: v.string(),         // WorkOS Vault object name
  enabledModelIds: v.array(v.string()),   // cached discovered models the user enabled
  discoveredModelsJson: v.string(), // full cached discovery response (for background refresh)
  discoveredAt: v.optional(v.number()),
  status: v.union(v.literal('active'), v.literal('error'), v.literal('untested')),
  lastError: v.optional(v.string()),
  lastTestedAt: v.optional(v.number()),
  isDefault: v.boolean(),           // true for Vercel AI Gateway
  isDeletable: v.boolean(),         // false for Vercel AI Gateway
  createdAt: v.number(),
  updatedAt: v.number(),
}).index('by_userId', ['userId'])
```

**Modify `userUiSettings`**: add `modelOrder: v.optional(v.array(v.string()))` for drag-reorder. Remove `defaultAskModelIds` (Ask mode removal todo).

**New Convex functions** (`convex/providers/connections.ts`):
- `listConnections` — query, returns user's connections (without vault keys)
- `createConnection` — mutation, creates record + writes key to WorkOS Vault
- `updateConnection` — mutation, updates metadata + optionally rotates key
- `deleteConnection` — mutation, deletes record + removes vault object (blocked for `isDeletable: false`)
- `refreshConnectionModels` — action, hits discovery endpoint, updates `discoveredModelsJson` + `discoveredAt`
- `seedDefaultConnection` — called on user creation, creates the Vercel AI Gateway connection with `isDefault: true, isDeletable: false`

**Vault key naming**: `byok_{userId}_{connectionId}` — written via server action using the same WorkOS client as `server-provider-keys.ts`.

For the **Vercel AI Gateway default connection**: `vaultKeyName` is empty — it uses the existing `getServerProviderKey('ai_gateway')` resolution (WorkOS Vault → env var). If the user provides their own AI Gateway key, it's stored in `byok_{userId}_{connectionId}` and takes precedence.

### Phase 3: Runtime model routing

**Modify `src/server/ai/model-runtime.ts`**:

```typescript
export async function getLanguageModel(
  modelId: string,
  accessToken?: string,
  userId?: string,
): Promise<LanguageModelV3> {
  // BYOK model IDs: byok/{connectionId}/{rawModelId}
  if (modelId.startsWith('byok/')) {
    const [, connectionId, ...rest] = modelId.split('/')
    const rawModelId = rest.join('/')
    const connection = await getUserProviderConnection(userId, connectionId)
    const apiKey = connection.vaultKeyName
      ? await readFromVault(connection.vaultKeyName)
      : await getServerProviderKey(connection.providerId === 'vercel-ai-gateway' ? 'ai_gateway' : connection.providerId)
    const gateway = new ByokGateway(connection, apiKey)
    const model = await gateway.createLanguageModel(rawModelId, { accessToken })
    return model.implementation as LanguageModelV3
  }
  // Existing path: Overlay-hosted gateway (Vercel AI Gateway default connection)
  const model = await getOverlayServerContext().llmGateway.createLanguageModel(modelId, { accessToken })
  return model.implementation as LanguageModelV3
}
```

The BFF route passes `userId` from session context. Non-BYOK model IDs (existing gateway catalog IDs) continue through the existing `OpenRouterGateway` path unchanged.

### Phase 4: Model discovery + catalog merge

**New server endpoint**: `POST /api/v1/providers/test-connection`
- Accepts `{ providerId, endpoint, apiKey }`
- Hits `${endpoint}${discoveryPath}`
- Returns `{ ok, models: [{ id, name }], error? }`

**New client hook**: `useByokModels()`
- Fetches user's connections from Convex
- Returns merged model list: gateway catalog models (from Vercel AI Gateway connection) + BYOK models from all other connections
- Background refresh: on mount, triggers `refreshConnectionModels` for connections where `discoveredAt` is older than 6 hours

**Model merge shape**:
```typescript
// Vercel AI Gateway models: existing IDs, existing metadata from gateway catalog
// BYOK models: id = `byok/{connectionId}/{rawModelId}`, name from discovery, provider = connection.displayName
//   cost = 'byok', supportsVision/reasoning = false (conservative default for v1)
```

### Phase 5: Settings UI — restructured

The settings nav changes from:
`General · Account · Customization · Memories · Models · Contact`

to:
`General · Account · Customization · Memories · Providers · Models · Contact`

#### Providers section (`ProviderConnectionsSetting.tsx`)

```
┌─────────────────────────────────────────────┐
│  Providers                                    │
│  Connect your own AI provider keys. Models    │
│  from connected providers appear in your      │
│  model dropdown.                              │
├─────────────────────────────────────────────┤
│                                               │
│  [+ Add provider]                             │
│                                               │
│  ── Connected providers ──────────────────    │
│                                               │
│  ┌───────────────────────────────────────┐   │
│  │ ● Vercel AI Gateway             [Edit] │   │
│  │   Overlay-hosted key                    │   │
│  │   247 models enabled · Default provider │   │
│  └───────────────────────────────────────┘   │
│  ┌───────────────────────────────────────┐   │
│  │ ● OpenRouter (Personal)        [Edit] │   │
│  │   357 models · Refreshed 2h ago        │   │
│  └───────────────────────────────────────┘   │
│  ┌───────────────────────────────────────┐   │
│  │ ⚠ Groq (Work key)              [Edit] │   │
│  │   Error: 401 Unauthorized · [Retry]    │   │
│  └───────────────────────────────────────┘   │
│                                               │
└─────────────────────────────────────────────┘
```

**Edit dialog** for a connection:
- Shows the full discovered model list with enable/disable toggles (same UX as current `ModelCatalogSetting` but scoped to one provider)
- "Refresh models" button to re-fetch from the provider
- For Vercel AI Gateway: shows "Use my own key" toggle — if enabled, reveals an API key input field. If disabled, uses Overlay's hosted key.
- For BYOK providers: shows the API key field (masked, with "Update key" option), endpoint URL (read-only for preset providers, editable for "Custom")

**Add provider dialog**:
- Provider dropdown (excludes Vercel AI Gateway since it's pre-seeded)
- API key field
- Display name field
- "Test connection" button → shows discovered models with checkboxes
- "Add" button creates the connection

#### Models section (revised `ModelCatalogSetting.tsx`)

This is now a **flat, drag-reorderable list** of all enabled models across all providers:

```
┌─────────────────────────────────────────────┐
│  Models                                       │
│  Drag to reorder. This is the order models    │
│  appear in your chat dropdown.                │
├─────────────────────────────────────────────┤
│                                               │
│  [Reset to default order]                     │
│                                               │
│  ┌───────────────────────────────────────┐   │
│  │ ⋮⋮  Claude Opus 4.7                     │   │
│  │     Vercel AI Gateway · 👁 ✦            │   │
│  ├───────────────────────────────────────┤   │
│  │ ⋮⋮  GPT-5.4                            │   │
│  │     Vercel AI Gateway · 👁 ✦            │   │
│  ├───────────────────────────────────────┤   │
│  │ ⋮⋮  Llama 3.3 70B                      │   │
│  │     Groq (Personal) · BYOK              │   │
│  ├───────────────────────────────────────┤   │
│  │ ⋮⋮  DeepSeek V3                        │   │
│  │     DeepSeek (My key) · BYOK            │   │
│  └───────────────────────────────────────┘   │
│                                               │
│  Enable/disable models from each provider's   │
│  edit dialog in the Providers section.        │
│                                               │
└─────────────────────────────────────────────┘
```

- Drag handle (`⋮⋮`) on each row
- Each row shows: model name, provider name (badge), capability badges, cost ("BYOK" for BYOK models, "$/$$/$$$" or "Free" for gateway models)
- Reordering saves to `userUiSettings.modelOrder`
- "Reset to default order" restores `CHAT_MODEL_QUALITY_PRIORITY` order
- No enable/disable toggles here — that's done per-provider in the Providers section. This section is purely ordering.

### Phase 6: Model dropdown integration

**Modify `ComprehensiveModelPicker.tsx`**:
- Model list is now ordered by `userUiSettings.modelOrder` (with unlisted models appended in provider discovery order)
- BYOK models show provider badge (connection display name) instead of Overlay provider name
- BYOK models show "BYOK" cost chip instead of dollar amount
- No "Auto" free-tier hoisting — the user controls order now. (The free router model is still in the list, just wherever the user puts it.)

### Phase 7: Remove Ask mode (separate todo)

This is a separate task but should be done alongside or before this work:
- Remove `defaultAskModelIds` from `userUiSettings` schema
- Remove ask/act toggle from `ChatExperience.tsx`
- Remove multi-model selection UI from `DefaultChatModelSetting.tsx`
- Every conversation uses `defaultActModelId` (single model)
- Rename `defaultActModelId` to just `defaultModelId` (or leave as-is for backward compat)

### Phase 8: Usage tracking + fallback

**BYOK models bypass Overlay billing**: In `convex/platform/usage.ts`, skip cost recording for `byok/*` model IDs. Still record token counts for display.

**Fallback strategy**: BYOK models are excluded from `getChatModelFallbackCandidates()`. If a BYOK model fails, surface the error — don't silently switch to an Overlay-hosted model.

**ZDR enforcement**: BYOK models are not ZDR-certified. If `onlyAllowZdrModels` is enabled, BYOK models are hidden from the dropdown.

**Tool-calling in Act mode**: All enabled models work in Act mode. For BYOK models that don't support tool calling, the AI SDK will throw an error at runtime — surface it clearly to the user ("This model doesn't support tool calling"). A future enhancement could probe tool-calling support during discovery and warn in the UI.

---

## What NOT to do

- **Don't build per-provider adapter classes** for each BYOK provider. The preset table + `createOpenAICompatible` handles all of them. The only exception is Ollama, which gets `@ai-sdk/ollama` for native discovery.
- **Don't store API keys in Convex.** WorkOS Vault is already integrated and purpose-built for this.
- **Don't support Azure / Bedrock / Vertex in the BYOK dialog.** They need project IDs, regions, IAM — wrong shape for a `{url, key}` form.
- **Don't do browser-direct calls to local Ollama.** It breaks your BFF architecture and forces client-side keys. Tunnel-only, documented in the UI.
- **Don't merge BYOK models into `CHAT_MODEL_QUALITY_PRIORITY`.** That list is Overlay-curated. BYOK models have unknown quality — let the user order them by their own preference.

---

## Revised file change summary

| Area | Files | Change type |
|------|-------|-------------|
| Preset registry | `packages/overlay-llm-gateway/src/adapters/byok-presets.ts` | New |
| BYOK gateway | `packages/overlay-llm-gateway/src/adapters/byok-gateway.ts` | New |
| Convex schema | `convex/schema.ts` | Add `userProviderConnections` table, add `modelOrder` to `userUiSettings` |
| Convex functions | `convex/providers/connections.ts` | New |
| Model routing | `src/server/ai/model-runtime.ts` | Modify — BYOK branch |
| BFF route | `src/server/app-api/v1/conversations/act/route.ts` | Pass userId through |
| Connection test endpoint | `src/app/api/v1/providers/test-connection/route.ts` | New |
| Providers settings UI | `src/features/settings/components/ProviderConnectionsSetting.tsx` | New |
| Models settings UI | `src/features/settings/components/ModelCatalogSetting.tsx` | Rewrite — drag-reorderable flat list |
| Settings page | `src/app/app/settings/page.tsx` | Add 'providers' section, restructure 'models' section |
| Model picker | `packages/overlay-chat-react/src/components/ComprehensiveModelPicker.tsx` | Use `modelOrder`, BYOK badges |
| BYOK models hook | `src/components/providers/useByokModels.ts` | New |
| Usage tracking | `convex/platform/usage.ts` | Skip cost for `byok/*` |
| Default connection seed | `convex/providers/connections.ts` | Seed Vercel AI Gateway on user creation |

## Separate todo: Remove Ask mode

| Area | Files | Change type |
|------|-------|-------------|
| Convex schema | `convex/schema.ts` | Remove `defaultAskModelIds` |
| Chat experience | `src/features/chat/components/ChatExperience.tsx` | Remove ask/act toggle, multi-model selection |
| Default model setting | `src/features/settings/components/DefaultChatModelSetting.tsx` | Simplify to single model |
| Settings page | `src/app/app/settings/page.tsx` | Remove ask-mode references |

---

## Build order

1. **Phase 1 + 2** (preset registry, BYOK gateway, Convex schema, credential storage) — the foundation
2. **Phase 3** (runtime routing) — get a BYOK model actually working end-to-end with a hardcoded test connection
3. **Phase 5** (Providers settings UI) — the add/edit/test dialog
4. **Phase 4 + 6** (model discovery, dropdown integration) — models appear in the picker
5. **Phase 8** (usage tracking, fallback) — production hardening
6. **Remove Ask mode** — separate but related
