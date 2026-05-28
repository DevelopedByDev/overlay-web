# Overlay Architecture Overhaul — Enterprise Platform Refactor

A phased, 6-phase plan to restructure the Next.js web app so it scores 10/10 on clean architecture, modularity, enterprise on-prem extensibility, frontend/backend separation, component organization, API portability, and React/Next.js best practices — without building a standalone `overlay-api/` service yet, but with every internal API route thin and modular enough to be ported to one later.

---

## Implementation Status (May 2026; refreshed May 28, 2026)

| Phase | Status | Where | Notes |
|---|---|---|---|
| **Phase 1** — Foundation | ✅ Shipped & tested | `origin/main` @ `dfd8e2078` | `src/features/`, `src/server/`, `src/shared/`; legacy `src/lib/` removed; Convex domain folders; ESLint boundaries (`scripts/eslint-boundary-rules.mjs`); path aliases. |
| **Phase 2** — Components & RSC | ✅ Shipped & tested | `origin/main` | `ChatInterface.tsx` is a thin orchestrator (~37 lines); hooks extracted; duplicated loading/auth chrome reduced; `@next/bundle-analyzer`. `ChatExperience.tsx` remains large (3,967 physical lines / 3,656 report LOC) — follow-up tech debt. |
| **Phase 3** — Domain & providers | ✅ Shipped & tested | `origin/main` | Provider contracts in `@overlay/app-core`; adapters + `createOverlayServerContext`; `NoteService` and domain services; vendor SDKs behind server adapters. |
| **Phase 4** — Package expansion | ✅ Shipped & tested | `origin/main` | `@overlay/llm-gateway`, `agent-runtime`, `tools-core`, `auth-contracts`, `storage-contracts`, modular `@overlay/api-client`, `@overlay/billing`. |
| **Phase 5** — API portability | ✅ Complete on staging; prod rollout pending | `origin/staging` @ `5e108b533` | `/api/v1/*`, Zod boundaries, BFF wrapper, rate limits, idempotency, pagination envelopes, webhook scaffolding, API key foundation, and legacy app API removal. Not merged to `main` yet. See [Phase 5 QA log](#phase-5-qa-log-may-2026) below. |
| **Phase 6** — On-prem runtime | ✅ Implemented on staging through 6.7 release gates | `origin/staging` | Runtime config schema, provider bootstrap, capabilities, self-hosting docs, tenancy/licensing docs, and `npm run check:phase6`. |

**Branches:** Production line is `main` through Phase 4 + lint/desktop fix. Phase 5 is complete on [`origin/staging`](https://github.com/DevelopedByDev/overlay-web/tree/staging): the phase branch was merged (`2f0950c44`), API key hardening landed (`b8a16d4e6`), and legacy `/api/app/*` compatibility was removed (`3072f6326`). Convex dev was pushed for the `/api/v1/*` URL producer cleanup; Convex prod is intentionally not pushed for that cleanup until the production app serves the same v1 route surface.

---

## Architecture Scores

| Dimension | Baseline (pre-refactor) | Current (`main` @ `dfd8e2078`) | Latest (`staging` @ `89f5511bd`) | Target |
|---|---|---|---|---|
| Clean Architecture | 3/10 | **7/10** | **8/10** | 10/10 |
| Modularity | 5/10 | **8/10** | **8/10** | 10/10 |
| Enterprise / On-Prem | 3/10 | **7/10** | **8/10** | 10/10 |
| Frontend/Backend Separation | 4/10 | **6/10** | **8/10** | 10/10 |
| Component Organization | 4/10 | **7/10** | 7/10 | 10/10 |
| API Portability | 4/10 | **5/10** | **8/10** | 10/10 |
| React / Next.js Best Practices | 5/10 | **7/10** | 7/10 | 10/10 |

Latest staging scores include Phase 6 runtime configuration/provider work, BFF and domain-service extraction, duplicate loading/auth chrome removal, package-surface cleanup, server complexity extraction, and the Phase 5 dead-code audit. Remaining blockers to 10/10 are mostly concentrated in large UI controllers (`ChatExperience.tsx`, `AppSidebar.tsx`, `KnowledgeView.tsx`), complex shared parsing/normalization helpers, on-prem update governance for diverged enterprise forks, and a few provider/package surfaces that still mix contract and implementation detail.

### Latest Web Complexity Snapshot (May 28, 2026)

Generated from [docs/reports/web-app-complexity-report.html](../../docs/reports/web-app-complexity-report.html) after `npm run report:web-complexity`.

| Metric | Current |
|---|---:|
| Code LOC | 95,483 |
| Production LOC | 89,128 |
| Test/story LOC | 6,355 |
| Exact duplicate production groups | 0 |
| Complex functions over budget (>25) | 43 |
| Zero-fan-in review candidates | 0 |
| Largest remaining active UI file | `src/features/chat/components/ChatExperience.tsx` — 3,967 physical lines / 3,656 report LOC |
| Largest remaining route handler | `src/server/app-api/v1/conversations/act/route.ts` — 658 report LOC |

**Baseline root causes (resolved or in progress):**

| Dimension | Baseline issue | Current state |
|---|---|---|
| Clean Architecture | `src/lib/` flat dump, no inversion | `src/lib/` gone; `src/server/` + `src/shared/` + `src/features/`; `server-only` markers; boundary lint (~38 pre-existing violations documented as tech debt). |
| Modularity | Logic mostly in app tree | 13 `@overlay/*` workspace packages; per-resource API client modules. |
| Enterprise / On-Prem | Direct vendor imports everywhere | `AuthProvider`, `BillingProvider`, `ObjectStore`, `LLMGateway`, etc. with SaaS + NoOp adapters; `createOverlayServerContext()`. Phase 6 runtime config still open. |
| Frontend/Backend Separation | Business logic in route handlers | Domain services on `main`; Phase 5 adds formal `handleBffRoute` pipeline on `staging`. |
| Component Organization | Duplicate `components/app/` tree | Feature-co-located UI under `src/features/<domain>/`; shared primitives in `src/components/ui|layout|providers`. |
| API Portability | Previously unversioned app API with inline logic | Modular api-client on `main`; versioned `/api/v1/*` + Zod + pagination + idempotency + API key foundation on `staging`; legacy `/api/app/*` shim removed. |
| React / Next.js | Giant client components, no boundaries | Route `loading.tsx`, chat hook decomposition, bundle analyzer; Server Component audit partial. |

---

## Target Architecture

```
overlay-landing/
├── src/
│   ├── app/                          # Next.js routes ONLY. Thin page.tsx / layout.tsx / route.ts
│   │   ├── (app)/
│   │   ├── (marketing)/
│   │   ├── api/
│   │   │   ├── v1/                   # NEW: versioned API namespace
│   │   │   │   ├── chat/             # thin BFF routes → call domain services
│   │   │   │   ├── notes/
│   │   │   │   ├── files/
│   │   │   │   ├── projects/
│   │   │   │   ├── automations/
│   │   │   │   ├── knowledge/
│   │   │   │   ├── integrations/
│   │   │   │   ├── auth/
│   │   │   │   ├── webhooks/
│   │   │   │   └── ...
│   │   └── ...
│   ├── features/                     # NEW: domain-co-located UI + hooks + transport + types
│   │   ├── chat/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── transport/            # client-side API calls (thin wrappers over fetch)
│   │   │   ├── types.ts
│   │   │   └── index.ts              # public API of the feature
│   │   ├── notebook/
│   │   ├── knowledge/
│   │   ├── projects/
│   │   ├── billing/
│   │   ├── account/
│   │   ├── auth/
│   │   ├── share/
│   │   ├── landing/
│   │   └── marketing/
│   ├── components/                   # ONLY shared, feature-agnostic primitives
│   │   ├── ui/                       # Button, Dialog, Skeleton, Tooltip, Input, Badge...
│   │   ├── layout/                   # PageShell, Container, MarketingShell
│   │   └── providers/                # ConvexProviderWithWorkOS, ObservabilityClient, etc.
│   ├── server/                       # NEW: server-only domain services (Node-only deps)
│   │   ├── auth/
│   │   ├── billing/
│   │   ├── database/
│   │   ├── storage/
│   │   ├── ai/
│   │   ├── chat/
│   │   ├── tools/
│   │   └── shared/                   # server-only cross-cutting (rate-limit, safe-url, ssrf)
│   ├── shared/                       # NEW: isomorphic types, schemas, constants, pure utils
│   │   ├── types/
│   │   ├── schemas/
│   │   └── utils/
│   ├── hooks/                        # ONLY cross-feature hooks
│   ├── contexts/                     # ONLY cross-feature providers
│   └── lib/                          # AFTER: tiny. Only truly cross-cutting pure utilities.
├── packages/
│   ├── overlay-app-core/             # contracts, app-shell, registries, feature flags
│   ├── overlay-api-client/           # per-resource client modules (chat, projects, notes...)
│   ├── overlay-chat-core/            # isomorphic chat state, message types, tool labels
│   ├── overlay-chat-react/           # presentational chat components
│   ├── overlay-modules-react/        # module UIs (knowledge, notes, projects...)
│   ├── overlay-ui/                   # shared primitives + tokens
│   ├── overlay-llm-gateway/          # NEW: interface + adapters for all LLM providers
│   ├── overlay-agent-runtime/        # NEW: agent loop, tool orchestration, persist logic
│   ├── overlay-tools-core/           # NEW: tool definitions, MCP schemas, exposure policy
│   ├── overlay-auth-contracts/       # NEW: AuthProvider interface, Session, User types
│   └── overlay-storage-contracts/  # NEW: ObjectStore, VectorStore interfaces
├── convex/
│   ├── auth/                         # mutations/queries by domain (flat, matching Convex conventions)
│   ├── chat/
│   ├── files/
│   ├── billing/
│   ├── knowledge/
│   ├── projects/
│   ├── automations/
│   ├── outputs/
│   ├── integrations/
│   ├── platform/
│   ├── ai/
│   ├── lib/                          # shared Convex helpers (auth, logging, storageQuota)
│   ├── schema.ts
│   └── ...
└── scripts/
    └── enforce-module-boundaries.mjs # extended to cover src/server/, src/features/
```

---

## Phase 1 — Foundation: Directory Restructure & Boundary Enforcement

**Status:** ✅ Shipped & tested on `origin/main` (`dfd8e2078`).

**Goal:** Fix the `src/components/` vs `src/app/` duplication and `src/lib/` flat dump. Establish import boundaries so no future code regresses.

### 1.1 Restructure `src/components/`
- Move top-level feature components into `src/features/<domain>/components/`:
  - `Navbar.tsx`, `PageNavbar.tsx` → `src/components/layout/`
  - `OverlayDemo.tsx`, `VoiceDemo.tsx`, `AllInOnePlace.tsx` → `src/features/landing/components/`
  - `ConvexProviderWithWorkOS.tsx`, `ObservabilityClient.tsx` → `src/components/providers/`
- Move `src/components/app/` contents into `src/features/<domain>/components/`:
  - `ChatInterface.tsx`, `chat/`, `chat-interface/` → `src/features/chat/components/`
  - `NotebookEditor.tsx` → `src/features/notebook/components/`
  - `KnowledgeView.tsx` → `src/features/knowledge/components/`
  - `ProjectsView.tsx`, `ProjectsSidebar.tsx`, `ProjectFileTree.tsx` → `src/features/projects/components/`
  - `AppSidebar.tsx`, `AppSidebarInlinePanels.tsx` → `src/components/layout/`
  - `AppSettingsProvider.tsx`, `OnboardingProvider.tsx`, `GuestGateProvider.tsx` → `src/components/providers/`
  - `MarkdownMessage.tsx` → `src/features/chat/components/`
  - `AutomationsInlinePanel.tsx`, `SkillsView.tsx` → `src/features/automations/components/`
  - `IntegrationsView.tsx`, `IntegrationsDialog.tsx`, `McpServersView.tsx` → `src/features/integrations/components/`
  - `MemoriesView.tsx` → `src/features/knowledge/components/`
  - `FileViewer.tsx`, `FileShareMenu.tsx` → `src/features/files/components/`
  - `ShareDialog.tsx` → `src/features/share/components/`
  - `GlobalSearchDialog.tsx` → `src/components/layout/`
  - etc.
- Update all import paths across the codebase.

### 1.2 Restructure `src/lib/` into domain folders
Create `src/server/` and `src/shared/`. Migrate files from `src/lib/`:

| Current | New Home | Rule |
|---|---|---|
| `workos-auth.ts`, `service-auth.ts`, `session-cookie-signature.ts`, `native-auth-validation.ts`, `native-refresh-rate-limit.ts` | `src/server/auth/` | server-only |
| `stripe.ts`, `stripe-billing.ts`, `billing-pricing.ts`, `billing-runtime.ts` | `src/server/billing/` | server-only |
| `r2.ts`, `r2-budget.ts`, `r2-upload-intents.ts` | `src/server/storage/` | server-only |
| `convex.ts` | `src/server/database/convex.ts` | server-only |
| `daytona.ts`, `daytona-pricing.ts` | `src/server/ai/sandbox/` + `providers/daytona-adapter.ts` | server-only |
| `ai-gateway.ts`, `openrouter-service.ts`, `nvidia-nim-openai.ts`, `model-data.ts`, `model-pricing.ts`, `model-fallbacks.ts`, `model-types.ts`, `model-zdr.test.ts` | `src/server/ai/gateway/` | server-only |
| `composio-tools.ts`, `mcp-tools.ts`, `mcp-schema-to-zod.ts`, `tools/` | `src/server/tools/` | server-only |
| `agent/run-act-turn.ts`, `notebook-agent-stream.ts`, `notebook-agent-prompts.ts`, `notebook-agent-contract.ts` | `src/server/agent/` | server-only |
| `chat-*.ts` (list cache, message persistence, title, suggestions, model prefs, stream relay auth) | `src/server/chat/` | server-only |
| `context-compaction.ts`, `sanitize-ui-messages-for-model.ts`, `reply-context-for-model.ts`, `persist-assistant-turn.ts` | `src/shared/chat/` | isomorphic |
| `markdown-table-fix.ts`, `math-markdown-normalize.ts`, `math-format-instructions.ts`, `shim-incomplete-markdown.ts` | `src/shared/markdown/` | isomorphic |
| `safe-url.ts`, `ssrf.ts`, `rate-limit.ts`, `safe-log.ts` | `src/shared/security/` | isomorphic |
| `url.ts`, `web-sources.ts`, `web-tools.ts` | `src/shared/web/` | isomorphic |
| `convex-file-content.ts`, `file-text-search.ts` | `src/shared/storage/` | isomorphic |
| `ask-knowledge-context.ts`, `mention-resolver.ts`, `mention-tokens.ts` | `src/shared/knowledge/` | isomorphic |
| `app-contracts.ts`, `app-store.ts` | `src/shared/app/` | isomorphic |
| `output-types.ts`, `tool-result-summary.ts` | `src/shared/tools/` | isomorphic |
| `landingPageStyles.ts`, `landingThemeConstants.ts`, `static-pages.ts`, `marketing.ts` | `src/features/landing/lib/` | feature-local |
| `integration-logo-cache.ts`, `integrations-events.ts` | `src/features/integrations/lib/` | feature-local |
| `onboarding-cookie.ts` | `src/features/auth/lib/` | feature-local |
| `share-url.ts` | `src/features/share/lib/` | feature-local |

### 1.3 Add `import "server-only"` markers
Every file under `src/server/` gets `import "server-only"` at the top. This makes accidental client imports a **build error**, not a runtime surprise.

### 1.4 Add `src/shared/` for isomorphic code
Everything under `src/shared/` must be importable from both client and server. No `fs`, no `process.env` reads, no vendor SDKs unless they are isomorphic.

### 1.5 ESLint boundary rules
Extend `eslint.config.mjs` (or add `eslint-plugin-boundaries`) to enforce:
- `src/app/*` → may only import `src/features/*/`, `src/components/`, `src/server/`, `src/shared/`, `src/hooks/`, `src/contexts/`, `packages/*`
- `src/features/<A>/` → may NOT import `src/features/<B>/` (no cross-feature coupling)
- `src/features/*/components/` → may NOT import `src/server/`
- `src/components/` → may NOT import `src/features/`, `src/server/`
- `src/server/` → may import anything except other `src/server/<domain>` siblings at the wrong layer (domain services can import shared/utils, not other domain services directly — use the domain interface)
- `src/shared/` → may only import `src/shared/`
- `src/lib/` (post-migration) → may only import `src/shared/`

### 1.6 Update path aliases in `tsconfig.json`
- `@/server/*` → `./src/server/*`
- `@/shared/*` → `./src/shared/*`
- `@/features/*` → `./src/features/*`

### 1.7 Convex restructure
Move `convex/*.ts` files into flat `convex/<domain>/` (matching Convex convention for clean function names like `chat:conversations`):
- `conversations.ts` → `convex/chat/conversations.ts`
- `files.ts` → `convex/files/files.ts`
- `knowledge.ts` → `convex/knowledge/knowledge.ts`
- `notes.ts` → `convex/files/notes.ts` (notes are a kind of file)
- `subscriptions.ts`, `stripe.ts`, `stripeSync.ts` → `convex/billing/`
- `users.ts` → `convex/auth/users.ts`
- `automations.ts`, `automationRunner.ts` → `convex/automations/`
- `projects.ts` → `convex/projects/projects.ts`
- `outputs.ts` → `convex/outputs/outputs.ts`
- `memories.ts`, `memoryExtractor.ts`, `memoryExtractorNode.ts` → `convex/knowledge/`
- `skills.ts` → `convex/integrations/skills.ts`
- `mcpServers.ts` → `convex/integrations/mcpServers.ts`
- `daytona.ts`, `daytonaReconcile.ts` → `convex/ai/sandbox/` (provider-agnostic; `daytona.ts` becomes the Daytona adapter)
- `usage.ts`, `rateLimits.ts` → `convex/platform/`
- `uiSettings.ts` → `convex/platform/uiSettings.ts`
- `serviceAuth.ts`, `sessionTransfer.ts` → `convex/auth/`
- `http.ts`, `crons.ts`, `keys.ts` → `convex/platform/`
- `seedDemoAccount.ts` → `convex/platform/`
- `storageAdmin.ts` → `convex/files/`
- `lib/auth.ts` stays as `convex/lib/auth.ts` (shared helper)
- `lib/stripeOverlaySubscription.ts` → `convex/billing/lib/`
- `lib/storageQuota.ts` → `convex/files/lib/`

Each domain folder exports a barrel `index.ts`. The root `convex/` only re-exports.

**Deliverable:** All imports resolve, build passes, lint passes, boundary rules catch violations.

---

## Phase 2 — Component Breakdown & Server Components Discipline

**Status:** ✅ Shipped & tested on `origin/main`. Residual: `ChatExperience.tsx` still monolithic; continue Server Component audit.

**Goal:** Eliminate the 215 KB `ChatInterface.tsx`, adopt Server Components by default, add Suspense boundaries, and cut bundle size.

### 2.1 Decompose `ChatInterface.tsx`
Split into focused components under `src/features/chat/components/`:
- `ChatShell.tsx` — layout wrapper, providers
- `ChatComposer.tsx` — input area, attachments, generation mode toggle
- `ChatMessageList.tsx` — virtualized scroll container
- `ChatMessage.tsx` — individual message bubble
- `ChatToolSurface.tsx` — tool invocation display
- `ChatSourcesPanel.tsx` — web source citations
- `ChatHistorySidebar.tsx` — conversation list (already exists, migrate)
- `ChatEmptyState.tsx` — starter prompts
- `useChatController.ts` — Zustand/reducer for all chat state
- `useChatTransport.ts` — streaming transport hooks
- `useChatAttachments.ts` — file attachment logic

Each file < 300 lines. The original `ChatInterface.tsx` becomes a thin orchestrator that imports and assembles these.

### 2.2 Audit `"use client"` directives
For every file in `src/features/` and `src/components/`, determine if it truly needs to be a Client Component:
- If it only renders props and does not use `useState`, `useEffect`, browser APIs, or event handlers → **convert to Server Component**.
- If it uses `framer-motion` for layout animations → keep client, but extract the animated wrapper into a small client component and let the content be server-rendered.
- If it imports `posthog` → wrap in a tiny `<PostHogTracker event="..." />` client component instead of making the whole page client.

### 2.3 Add `loading.tsx` and `error.tsx` per route group
- `src/app/app/chat/loading.tsx`
- `src/app/app/notes/loading.tsx`
- `src/app/app/knowledge/loading.tsx`
- `src/app/app/projects/loading.tsx`
- `src/app/app/settings/loading.tsx`
- `src/app/app/automations/loading.tsx`

Each is a skeleton UI matching the route layout.

### 2.4 Suspense streaming for data-heavy routes
Wrap data-fetching in ` Suspense` with fallback skeletons:
- Chat history sidebar
- Project list
- Knowledge file tree
- Integrations list
- Automations list

Use Next.js `unstable_noStore()` or React `use()` for async data in Server Components.

### 2.5 Bundle analysis & code splitting
- Add `@next/bundle-analyzer` as a dev script.
- Run analysis. Identify the largest chunks.
- Code-split by route:
  - `mermaid` should only load in the notebook/markdown preview route.
  - `jspdf` + `html2canvas` should only load in the export/download flow.
  - `react-syntax-highlighter` should be lazy-loaded per language.
  - Tiptap extensions should be bundled with the editor feature, not the chat feature.

### 2.6 Move `src/components/notebook/` into `src/features/notebook/components/`
`InlineDiffExtension.ts` is a Tiptap extension. It belongs with the notebook feature.

**Deliverable:** `ChatInterface.tsx` is < 200 lines. Every route has a `loading.tsx`. Bundle analyzer report shows meaningful reduction. No unnecessary `"use client"`.

---

## Phase 3 — Clean Architecture: Domain Layer & Provider Contracts

**Status:** ✅ Shipped & tested on `origin/main`.

**Goal:** Invert dependencies so `src/app/`, `src/features/`, and `convex/` depend on a central domain core, not on vendor SDKs directly.

### 3.1 Define provider contracts in `@overlay/app-core`
Extend `packages/overlay-app-core/src/contracts.ts` with generic interfaces:

```ts
// packages/overlay-app-core/src/contracts.ts

export interface AuthProvider {
  getSession(req: Request): Promise<Session | null>
  verifyAccessToken(token: string): Promise<TokenClaims | null>
  getUserProfile(token: string): Promise<UserProfile | null>
}

export interface BillingProvider {
  getEntitlements(userId: string): Promise<Entitlements>
  createCheckoutSession(args: CheckoutArgs): Promise<CheckoutResult>
  createPortalSession(userId: string): Promise<PortalResult>
  recordUsage(args: UsageArgs): Promise<void>
}

export interface ObjectStore {
  getUploadUrl(key: string, contentType: string): Promise<{ url: string; fields?: Record<string, string> }>
  getDownloadUrl(key: string): Promise<string>
  deleteObject(key: string): Promise<void>
  listObjects(prefix: string): Promise<ObjectSummary[]>
}

export interface VectorStore {
  upsert(args: { id: string; vector: number[]; metadata: Record<string, unknown> }): Promise<void>
  query(args: { vector: number[]; topK: number; filter?: Record<string, unknown> }): Promise<QueryResult[]>
  delete(id: string): Promise<void>
}

export interface LLMGateway {
  createLanguageModel(modelId: string, options?: ModelOptions): Promise<LanguageModel>
  listModels(): Promise<ModelInfo[]>
  getModelPricing(modelId: string): Promise<PricingInfo>
}

export interface RateLimiter {
  check(key: string, limits: RateLimitSpec[]): Promise<RateLimitResult>
}

export interface EventBus {
  publish(topic: string, payload: unknown): Promise<void>
  subscribe(topic: string, handler: (payload: unknown) => void): () => void
}
```

### 3.2 Create adapter implementations
Each interface gets a default "SaaS" adapter and a "NoOp" adapter:

| Interface | Default Adapter | NoOp Adapter | Location |
|---|---|---|---|
| `AuthProvider` | `WorkOSAuthProvider` | `NoOpAuthProvider` | `src/server/auth/providers/` |
| `BillingProvider` | `StripeBillingProvider` | `NoOpBillingProvider` | `src/server/billing/providers/` |
| `ObjectStore` | `R2ObjectStore` | `NoOpObjectStore` | `src/server/storage/providers/` |
| `VectorStore` | `ConvexVectorStore` | `InMemoryVectorStore` | `src/server/storage/providers/` |
| `LLMGateway` | `OpenRouterGateway` | `NoOpLLMGateway` | `src/server/ai/providers/` |
| `RateLimiter` | `RedisRateLimiter` / `InMemoryRateLimiter` | `NoOpRateLimiter` | `src/server/shared/providers/` |

### 3.3 Bootstrap wiring in `src/server/bootstrap.ts`
A single factory function that reads `overlay.config.ts` and instantiates the right providers:

```ts
export function createOverlayServerContext(config: OverlayAppConfig): OverlayServerContext {
  return {
    auth: config.authProvider ?? new WorkOSAuthProvider(),
    billing: config.billingProvider ?? new StripeBillingProvider(),
    objectStore: config.objectStore ?? new R2ObjectStore(),
    vectorStore: config.vectorStore ?? new ConvexVectorStore(),
    llmGateway: config.llmGateway ?? new OpenRouterGateway(),
    rateLimiter: config.rateLimiter ?? new InMemoryRateLimiter(),
  }
}
```

### 3.4 Refactor API routes to use domain services
Every `src/app/api/v1/<feature>/route.ts` becomes a thin controller:

```ts
// src/app/api/v1/notes/route.ts
import { createOverlayServerContext } from '@/server/bootstrap'
import { NoteService } from '@/server/notes/NoteService'

const ctx = createOverlayServerContext(overlayAppConfig)

export async function GET(request: NextRequest) {
  const auth = await ctx.auth.getSession(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = new NoteService(ctx)
  const notes = await service.listNotes({ userId: auth.user.id, projectId: searchParams.get('projectId') })
  return NextResponse.json(notes)
}
```

The `NoteService` contains the business logic that currently lives inline in the route handler. It is 100% framework-agnostic (no `NextRequest`, no `convex` direct calls).

### 3.5 Refactor `src/server/ai/gateway/` to use `LLMGateway` interface
`ai-gateway.ts` becomes the `OpenRouterGateway` adapter. The interface is in `@overlay/app-core`. The web app and any future API service import the interface, not the adapter.

### 3.6 Refactor `src/server/storage/` to use `ObjectStore` interface
`r2.ts` becomes `R2ObjectStore`. `convex.ts` (file storage) becomes `ConvexObjectStore`. The domain service asks for an `ObjectStore`, not `R2`.

### 3.7 Refactor auth in `src/server/auth/`
`workos-auth.ts` becomes `WorkOSAuthProvider`. The interface is `AuthProvider`. The middleware and API routes call `ctx.auth.getSession()`, not `getSession()` from WorkOS directly.

**Deliverable:** Zero vendor SDK imports in `src/app/` or `src/features/`. All vendor code is behind an adapter. The domain services are testable with `NoOp` adapters. Build passes.

---

## Phase 4 — Package Expansion

**Status:** ✅ Shipped & tested on `origin/main` (through 4.8 `@overlay/billing`).

**Goal:** Extract the most reusable, cross-cutting logic into `packages/` so the Chrome extension, desktop app, and future standalone API can share them.

### 4.1 `@overlay/llm-gateway` (NEW)
- **Source:** `src/server/ai/llm/` (after Phase 3 restructure)
- **Contents:**
  - `LLMGateway` interface
  - `OpenRouterGateway` adapter
  - `DirectOpenAIGateway` adapter
  - `AnthropicGateway` adapter
  - `GroqGateway` adapter
  - `ModelInfo`, `PricingInfo`, `ModelOptions` types
  - `getModelForId()` resolver
- **Why:** This is the most reused piece. Chat, notebook agent, title generation, chat suggestions, and image/video generation all need it.

### 4.2 `@overlay/agent-runtime` (NEW)
- **Source:** `src/server/agent/`, `src/server/tools/`, `src/shared/chat/`
- **Contents:**
  - `AgentRuntime` class: `runTurn(input, deps) -> Output`
  - `ToolRegistry`: register, execute, validate
  - `McpToolAdapter`: bridge MCP servers to the runtime
  - `ComposioToolAdapter`
  - `BrowserTaskAdapter`
  - `ContextBuilder`: knowledge, memory, file context assembly
  - `PersistTurn`: save assistant turn to storage
- **Why:** This is the kernel of "agentic execution as a service." Both the Next app and a future public API call `agentRuntime.runTurn()`.

### 4.3 `@overlay/tools-core` (NEW)
- **Source:** `src/server/tools/`, `src/lib/tools/`, `mcp-tools.ts`, `composio-tools.ts`
- **Contents:**
  - `ToolDefinition` interface
  - `ExposurePolicy` (already exists, migrate)
  - `ToolBucket` registry
  - `McpSchemaToZod` (already exists, migrate)
  - `InternalApiTool` definitions
- **Why:** The Chrome extension and desktop app need to know what tools exist. The public API needs to validate tool calls.

### 4.4 `@overlay/auth-contracts` (NEW)
- **Contents:**
  - `AuthProvider` interface
  - `Session`, `User`, `UserProfile`, `TokenClaims` types
  - `AuthError` classes
- **Why:** The smallest possible surface. No WorkOS dependency. On-prem deployments implement this interface with Keycloak, Auth0, or a simple JWT secret.

### 4.5 `@overlay/storage-contracts` (NEW)
- **Contents:**
  - `ObjectStore` interface
  - `VectorStore` interface
  - `FileMetadata`, `UploadUrl`, `DownloadUrl` types
- **Why:** Same as auth — minimal surface for swapping to S3/MinIO/Postgres/pgvector.

### 4.6 `@overlay/api-client` refactor
- **Current state:** Single 29 KB `index.ts` with every resource mixed.
- **Target state:** Per-resource modules:
  ```
  packages/overlay-api-client/src/
    index.ts                    # re-exports public API
    chat/
      client.ts                 # ChatClient class
      types.ts
    notes/
      client.ts
      types.ts
    projects/
      client.ts
      types.ts
    automations/
      client.ts
      types.ts
    files/
      client.ts
      types.ts
    auth/
      client.ts
      types.ts
    shared/
      http.ts                 # base fetch wrapper, retry, error handling
      types.ts                # shared DTOs (Pagination, ErrorResponse, etc.)
  ```
- Each resource client is a class with typed methods. The `index.ts` barrel only re-exports what is public.
- **Why:** This is what you'd publish as an npm package for developers. A single 29 KB file is not maintainable or tree-shakeable.

### 4.7 `@overlay/billing` (NEW, optional)
- **Decision:** Keep billing logic in `src/server/billing/` unless you plan to open-source the billing system itself. For on-prem, `NoOpBillingProvider` is sufficient. If you want a reusable billing engine, extract it.
- **Contents:**
  - `BillingProvider` interface
  - `StripeBillingProvider` adapter
  - `UsageMeter`, `QuotaEnforcer`
- **Why:** Some enterprises may want to bring their own metering (e.g., OpenMeter, Metronome). The interface makes that possible.

### 4.8 `@overlay/ui` expansion
- Move `src/components/ui/Skeleton.tsx` and any other shared primitives into `packages/overlay-ui/src/components/`.
- Add design tokens (colors, spacing, typography) as CSS variables or a Tailwind preset.
- Ensure Storybook covers all primitives.

**Deliverable:** Each new package has its own `package.json`, `tsconfig.json`, `index.ts`, and at least one test. The web app's `package.json` depends on them via `file:`.

---

## Phase 5 — API Portability & Public API Readiness

**Status:** ✅ Complete on `origin/staging` (latest `5e108b533`; implementation commits `2f0950c44`, `b8a16d4e6`, `3072f6326`). Not on `main` yet. Production Convex has not received the `/api/v1/*` URL producer cleanup until the production web app is aligned.

| Sub-phase | Status |
|---|---|
| 5.1 Version the API (`/api/v1/*`) | ✅ Staging |
| 5.2 Zod schemas at every boundary | ✅ Staging |
| 5.3 Thin route handlers (`handleBffRoute`) | ✅ Staging |
| 5.4 Rate limiting & quota abstraction | ✅ Staging (endpoint specs; quota in services partial) |
| 5.5 Idempotency keys | ✅ Staging |
| 5.6 Pagination envelopes | ✅ Staging |
| 5.7 Webhook scaffolding | ✅ Staging |
| 5.8 OpenAPI generation | ⏭️ Deferred to public developer-docs phase |
| 5.9 API key system | ✅ Staging |

**Goal:** Make the versioned app API clean enough that porting it to a standalone service is a copy-paste of route handlers + domain services into a Hono/Fastify project.

### 5.1 Version the API
- Move current app API traffic to `/api/v1/*` (e.g., `/api/v1/chat`, `/api/v1/notes`).
- Remove legacy app API shims after all local clients and generated URLs target `/api/v1/*`.
- Update `@overlay/api-client` to use `/api/v1/`.

### 5.2 Zod schemas at every boundary
- Define request/response schemas in `src/shared/schemas/<feature>.ts`:
  ```ts
  // src/shared/schemas/chat.ts
  export const CreateConversationRequest = z.object({
    title: z.string().min(1).max(200).optional(),
    projectId: z.string().optional(),
    askModelIds: z.array(z.string()).optional(),
    actModelId: z.string().optional(),
    lastMode: z.enum(['ask', 'act']).optional(),
    clientId: z.string().optional(),
  })
  export type CreateConversationRequest = z.infer<typeof CreateConversationRequest>
  ```
- Validate every route handler with these schemas before calling the domain service.
- Reuse the same schemas in `@overlay/api-client` so client and server never drift.

### 5.3 Thin route handlers (formalize BFF)
Every route handler must follow this template:

```ts
export async function GET(request: NextRequest) {
  // 1. Auth
  // 2. Validation (Zod)
  // 3. Rate limit check
  // 4. Call domain service
  // 5. Return JSON
}
```

No business logic in the handler. No direct Convex calls in the handler. The domain service owns the logic.

### 5.4 Rate limiting & quota abstraction
- Refactor `src/shared/security/rate-limit.ts` to use the `RateLimiter` interface.
- Add per-endpoint rate limit specs:
  ```ts
  const CHAT_RATE_LIMITS: RateLimitSpec[] = [
    { bucket: 'chat:ip', limit: 120, windowMs: 10 * 60_000 },
    { bucket: 'chat:user', limit: 60, windowMs: 60_000 },
  ]
  ```
- Add quota enforcement in the domain service layer (e.g., `NoteService.createNote()` checks `ctx.billing.getEntitlements()`).

### 5.5 Idempotency keys
- Add `Idempotency-Key` header support for mutation routes (POST, PATCH, DELETE).
- Store processed keys in a short-lived cache (Convex `processedWebhookEvents` pattern can be reused).

### 5.6 Pagination, filtering, sorting
- Standardize pagination across list endpoints:
  ```ts
  export const PaginationQuery = z.object({
    cursor: z.string().optional(),
    limit: z.number().min(1).max(100).default(20),
    sort: z.enum(['createdAt', 'updatedAt', 'name']).default('updatedAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  ```
- Return standard envelope:
  ```ts
  { data: T[], nextCursor?: string, hasMore: boolean, total?: number }
  ```

### 5.7 Webhook scaffolding
- Add `src/server/app-api/v1/webhooks/route.ts` for subscription CRUD behind auth.
- Add Convex `webhookSubscriptions` and `webhookDeliveries` tables, delivery runner, retry state, and event de-dupe primitives.
- Add shared webhook schemas and route-boundary validation.
- Keep delivery infrastructure private until a public developer API launch.

### 5.8 OpenAPI generation
- Use `zod-to-openapi` or `next-zod-route` to generate an OpenAPI spec from the Zod schemas.
- Publish the spec at `/api/v1/openapi.json`.
- Host Swagger UI at `/api/v1/docs` (optional, dev-only).
- **Decision:** Deferred out of Phase 5 and into the public developer-docs/API-docs phase. The route/schema architecture is now ready for generation, but publishing a spec before the external API is exposed would create documentation churn.

### 5.9 API key system (foundation)
- Add `src/server/auth/api-keys/`:
  - `ApiKeyService`: create, rotate, revoke, validate.
  - `crypto.ts`: strict `ovl_sk_` format validation, HMAC-SHA-256 key hashing, and `API_KEY_HASH_SECRET` support.
  - `route-scopes.ts`: route-to-scope mapping tests so future endpoints cannot silently accept bearer keys without explicit scopes.
- Add Convex `apiKeys` table with audit-oriented fields:
  - `keyHash`, `userId`, `name`, `scopes`, `expiresAt`, `createdAt`, `createdBy`, `createdFromIp`.
  - `lastUsedAt`, `lastUsedIp`.
  - `revokedAt`, `revokedReason`; revoked rows are retained instead of deleted.
- Harden validation:
  - Reject malformed bearer candidates before Convex reads.
  - Add negative caching for misses to reduce repeated Convex lookups.
  - Add IP-based pre-auth throttling for API key candidates.
  - Add per-key rate limits after successful validation.
  - Accept API keys only when required scopes are explicitly provided by the route.
- Harden issuance:
  - Default TTL and max TTL are enforced.
  - `admin` scope requires explicit elevated/session authorization before exposure to any public caller.
  - API keys are not publicly exposed yet; infrastructure only.
- Route auth order remains session cookie first, then `Authorization: Bearer <api-key>` for scoped `/api/v1/*` routes.
- Supported scopes: `chat:read`, `chat:write`, `files:read`, `files:write`, `admin`.

**Deliverable:** All `/api/v1/*` routes are < 50 lines. Every request is validated by Zod. Every response follows the standard envelope. The API layer is a thin BFF that could be lifted into a separate project.

### Phase 5 QA log (May 2026)

Branch: `origin/staging` @ `5e108b533`. Phase 5 implementation is complete on staging. Dev Convex was pushed for current `/api/v1/*` producer cleanup; prod Convex remains intentionally unpushed for that cleanup until `main` serves the same route surface.

| Check | Result | Notes |
|---|---|---|
| `npm run check:shared-isomorphic` | ✅ Pass | |
| `npm run check:module-boundaries` | ✅ Pass | |
| `packages/overlay-api-client` tests | ✅ Pass (4/4) | v1 paths, pagination unwrap |
| `src/server/app-api/pagination.test.ts` | ✅ Pass (2/2) | |
| `NoteService.test.ts` | ✅ Pass (1/1) | Requires `NODE_OPTIONS=--conditions=react-server` |
| `src/shared/auth/api-key-scopes.test.ts` | ✅ Pass | Scope validation |
| `src/server/auth/api-keys/*.test.ts` | ✅ Pass | API key crypto + route scope footgun coverage |
| `src/shared/security/security-hardening.test.ts` | ✅ Pass | Service auth, provider key access, native validation |
| ESLint (BFF, idempotency, boundary, rate-limit specs, API keys, cleanup files) | ✅ Pass | One unrelated existing boundary warning remains in `document-context-builder.ts` |
| `next build` | ✅ Pass | All `/api/v1/*` routes compile |
| Unauth `GET /api/v1/conversations` | ✅ 401 | Canonical versioned route rejects unauthenticated requests |
| API key dev smoke | ✅ Pass | Created/revoked a dev smoke key and verified scoped bearer auth path |
| Legacy compatibility search | ✅ Pass | `rg` found no `/api/app`, compat header, or deprecated route references |
| `find src/app/api/app -type f` | ✅ Pass | No legacy route files remain |
| `npm run convex:push:dev` | ✅ Pass | Dev deployment now emits `/api/v1/*` URLs |
| `npm run convex:push:prod` for cleanup | ⏸️ Skipped intentionally | Avoids prod Convex emitting `/api/v1/*` URLs before production web app deploy |
| Authenticated UI flows (chat, lists, notes, billing) | ✅ Staging smoke / release QA recommended before `main` merge | Vercel staging must point to dev Convex + dev WorkOS/Stripe envs |

**Follow-ups before `main` merge:** Verify Vercel staging is using dev Convex, dev WorkOS, and Stripe test mode; run one signed-in browser pass for chat send, file content URL, output content URL, automation runner callback, billing checkout in test mode, and API key scoped auth. After the production app serves `/api/v1/*`, push Convex prod and then remove any remaining production env references to the old app API.

---

## Phase 6 — On-Prem / Enterprise Extensibility

**Status:** ✅ Implemented on `staging` through Phase 6.7 release gates.

**Goal:** Make the app configurable at runtime so an enterprise can swap auth, billing, storage, and AI providers without touching source code.

### 6.1 Runtime config validation
- Create `src/shared/config/`:
  - `overlayConfigSchema.ts`: a Zod schema that validates the entire app configuration.
  - `loadOverlayConfig()`: reads from env vars, a JSON file (`overlay.config.json`), or a remote config endpoint.
- `overlay.config.ts` (current) becomes the **default** config. It is merged with runtime overrides.
- Define a stable normalized config shape:
  - `app`: base URL, deployment environment, CSP/connect-src additions.
  - `auth`: provider, WorkOS config, future Keycloak/OIDC config, dev fallback rules.
  - `billing`: provider, Stripe config, disabled/no-op mode.
  - `storage`: provider, R2/S3/MinIO bucket config, public URL policy.
  - `llm`: gateway provider, provider key source, model allowlist/defaults.
  - `database`: Convex URL/deployment and internal service secrets.
  - `capabilities`: feature booleans consumed by Phase 6.3.
- Fail fast at server boot for invalid required production config; allow explicit disabled/no-op providers only when `capabilities` and provider config agree.

**Programmatic QA**
- Add `src/shared/config/overlayConfigSchema.test.ts`:
  - Validates minimal SaaS config.
  - Validates on-prem config with `auth.provider="oidc"`, `billing.provider="none"`, `storage.provider="s3"`, `llm.provider="openai"`.
  - Rejects mixed prod/staging values such as prod Convex with dev WorkOS, live Stripe key with staging app URL, or missing `API_KEY_HASH_SECRET` when API keys are enabled.
  - Rejects secret values in `NEXT_PUBLIC_*` fields.
- Add `src/server/config/loadOverlayConfig.test.ts`:
  - Env-only load.
  - JSON override load.
  - Precedence: explicit env > JSON override > default config.
  - Redacted logging snapshots so secret values never appear in logs.
- Add a CI/check script, `npm run check:config`, that loads representative fixtures from `fixtures/config/*.json`.
- Run `npm run typecheck`, `npm run check:shared-isomorphic`, and `npm run check:module-boundaries` after introducing config modules.

**UI QA**
- Add a lightweight admin/debug route available only in development/staging, e.g. `/app/settings/system` or `/api/v1/bootstrap`, that exposes redacted provider/capability state.
- Browser smoke:
  - SaaS staging config shows WorkOS, Stripe test mode, R2/S3-compatible storage, Convex dev.
  - On-prem fixture/local env shows OIDC/no billing/S3-compatible storage/OpenAI without showing secrets.
  - Invalid local config renders a clear startup/config error instead of a blank app shell.

### 6.2 Provider-agnostic bootstrap
- In `src/server/bootstrap.ts`, the provider selection is driven by config, not hardcoded:
  ```ts
  const authProvider = config.auth.provider === 'workos'
    ? new WorkOSAuthProvider(config.auth.workos)
    : config.auth.provider === 'keycloak'
    ? new KeycloakAuthProvider(config.auth.keycloak)
    : new NoOpAuthProvider()
  ```
- Expand `createOverlayServerContext(config)` so auth, billing, storage, LLM, rate limiter, event bus, and API key service are all selected from normalized config.
- Move provider-specific constructor options out of module-level `process.env` reads where practical, especially WorkOS, Stripe, storage, and LLM gateway construction.
- Keep current SaaS adapters as defaults; add no-op or local adapters where Phase 6 docs depend on them:
  - `NoOpBillingProvider` for on-prem deployments without Stripe.
  - S3-compatible object store adapter that can target AWS S3 or MinIO.
  - OIDC/Keycloak auth provider skeleton if full implementation is too large for 6.2.
- Preserve current route behavior: routes consume `ctx.auth`, `ctx.billing`, `ctx.objectStore`, and `ctx.llmGateway`, not direct SDK singletons.

**Programmatic QA**
- Add `src/server/bootstrap.test.ts`:
  - Given WorkOS/Stripe/R2 config, returns SaaS adapters.
  - Given OIDC/no-billing/S3/OpenAI config, returns enterprise adapters.
  - Given invalid provider config, throws a typed config error before any network call.
  - Confirms adapters receive explicit config values and do not read unrelated prod env vars.
- Add route-level tests for one endpoint per provider area:
  - Auth-required `/api/v1/conversations` with a fake auth provider.
  - Billing `/api/subscription/settings` with `NoOpBillingProvider`.
  - File upload/presign path with S3-compatible object store stub.
  - Chat/model listing with fake LLM gateway.
- Add a "no vendor imports in app routes" static check:
  - `src/app/**` and `src/features/**` must not import `stripe`, `@workos-inc/node`, AWS SDK/R2 clients, or direct LLM SDKs.
- Run targeted ESLint on changed bootstrap/provider files plus `npm run typecheck`.

**UI QA**
- Start local SaaS-like mode with `npm run dev:with-convex`; verify sign-in, chat send, file upload/view, and billing settings still work.
- Start local on-prem fixture mode, e.g. `OVERLAY_CONFIG_FILE=fixtures/config/onprem.minimal.json npm run dev`; verify:
  - App shell renders.
  - Signed-out/auth-disabled behavior is explicit.
  - Billing UI is hidden or disabled.
  - Chat model selector uses the configured gateway/default model.
  - File upload path shows the S3-compatible provider state in the debug surface.

### 6.3 Feature flags as capabilities
- Extend `@overlay/app-core` feature flags to include **capability checks**:
  ```ts
  interface CapabilityCheck {
    billing: boolean
    sso: boolean
    vectorSearch: boolean
    multiTenant: boolean
  }
  ```
- UI components check capabilities before rendering gated features. If `billing: false`, hide all billing UI.
- Define capability ownership:
  - `billing`: checkout, portal, top-ups, billing account pages, quota purchase prompts.
  - `sso`: OAuth/SSO buttons, enterprise auth callbacks, native auth flows.
  - `apiKeys`: API key management UI once exposed.
  - `webhooks`: webhook subscription UI once exposed.
  - `vectorSearch`: knowledge search/memory extraction features.
  - `automations`: automation scheduling and runner callbacks.
  - `multiTenant`: tenant selector/admin boundaries if Phase 6b is later approved.
- Add a server-provided capability endpoint or bootstrap payload so browser UI cannot infer capabilities from scattered env vars.
- Make hidden features inaccessible server-side too; UI hiding is not an authorization boundary.

**Programmatic QA**
- Add `packages/overlay-app-core` tests for capability derivation from config.
- Add server route tests proving disabled capabilities return deterministic errors:
  - `billing=false` blocks checkout/portal routes.
  - `webhooks=false` blocks `/api/v1/webhooks`.
  - `apiKeys=false` blocks any future API key management route.
  - `vectorSearch=false` blocks knowledge-search-only paths while preserving basic file listing.
- Add snapshot tests for the redacted bootstrap/capability payload.
- Run `npm --prefix packages/overlay-app-core run test`, route tests, `npm run typecheck`, and targeted ESLint.

**UI QA**
- Use Playwright or the in-app browser against two local/staging configurations:
  - Full SaaS mode: billing, SSO, automations, vector search, and integrations are visible and navigable.
  - On-prem minimal mode: billing/top-up/portal controls are absent; hidden routes redirect or show a precise disabled-state message; primary chat/file workflows still work.
- Verify no layout gaps or broken side-nav items when capabilities are disabled.
- Verify mobile viewport nav does not expose hidden billing or integration entries.

### 6.4 Self-hosting documentation
- Add `docs/SELF_HOSTING.md`:
  - Required env vars
  - How to configure `overlay.config.json`
  - How to swap providers
  - How to build and deploy without Vercel / Stripe / WorkOS
  - Docker Compose example (optional)
- Add deployment profiles:
  - `docs/config/saas-staging.example.json`
  - `docs/config/onprem-minimal.example.json`
  - `docs/config/onprem-s3-oidc-openai.example.json`
- Document secrets plainly:
  - Which secrets belong in Next/Vercel/app runtime.
  - Which secrets belong in Convex.
  - Which values are public and safe to expose.
  - Which values must differ between staging and production.
- Include migration notes for the Phase 5 API route cleanup:
  - Clients must call `/api/v1/*`.
  - Convex URL producers must match the deployed web route surface.
  - Do not push prod Convex URL producer changes before prod web supports them.

**Programmatic QA**
- Add `npm run docs:check:self-hosting`:
  - Validates every JSON config example with `overlayConfigSchema`.
  - Runs a link checker for local doc anchors.
  - Greps examples to ensure no real-looking secrets are committed (`sk_live_`, `prod:colorful`, real Convex URLs unless intentionally documented as placeholders).
- Add a smoke script that boots config validation from each documented example.

**UI QA**
- Follow the docs from a clean checkout using the minimal on-prem config.
- Verify a new developer can reach:
  - App shell.
  - Chat page.
  - Settings/system config view.
  - File upload or its documented disabled state.
- Verify screenshots in the docs, if added, match the current UI and do not show secrets.

### 6.5 Multi-tenant considerations (documented, not enforced)
- The Convex schema is currently single-tenant. Document that on-prem deployments should use **one deployment per customer** or add a `tenantId` to every table.
- If multi-tenant is a requirement, add `tenantId` to schema as a Phase 6b.
- Document the security model for both choices:
  - Single-customer deployment: simplest operational boundary; no tenant column required.
  - Shared deployment: every user-owned table and every secondary index must include `tenantId`; every server query/mutation must receive and enforce tenant context.
- Add a Phase 6b checklist before any shared-tenant work:
  - Schema migration plan.
  - Backfill plan.
  - Index expansion plan.
  - Tenant-aware auth/session claims.
  - Tenant-aware API keys and scopes.
  - Tenant-aware webhook delivery ownership.

**Programmatic QA**
- Add a static audit script, `npm run check:tenant-boundaries`, that enumerates Convex tables and flags user-owned tables without an explicit tenant decision in docs.
- Add tests for the current single-tenant assumption:
  - Config rejects `multiTenant=true` unless a future tenant implementation flag is present.
  - API key service and webhook docs state tenant behavior.
- If Phase 6b is later approved, add cross-tenant negative tests for every domain service before enabling shared deployments.

**UI QA**
- In single-tenant mode, confirm no tenant switcher or misleading tenant admin UI appears.
- If `multiTenant=false`, admin/system surfaces should say single-customer deployment, not silently imply shared tenancy.
- If a future experimental `multiTenant=true` flag is added, the UI must clearly label it unavailable until Phase 6b is complete.

### 6.6 Licensing
- Replace the custom repo license with a split-license model:
  - Core product: `AGPL-3.0-or-later`.
  - SDKs, API clients, contracts, protocol packages, extension contracts, and shared UI: `Apache-2.0`.
  - Enterprise license: paid commercial AGPL exception plus support and hosted/private deployment terms.
  - Brand, logo, name, and hosted domains: strict trademark policy.
- Encode first-party package license metadata:
  - Root web app, Convex/backend surfaces, workers, desktop, mobile, and Chrome product apps use `AGPL-3.0-or-later`.
  - Workspace packages under `packages/*` and extension contract packages use `Apache-2.0`.
- Document commercial, self-hosting, attribution, and trademark constraints:
  - `LICENSE.md`
  - `NOTICE.md`
  - `TRADEMARKS.md`
  - `docs/LICENSING.md`
  - `docs/LEGAL_SELF_HOSTING_NOTES.md`
- Audit third-party package licenses for self-hosting redistribution risk:
  - Runtime dependencies in root `package-lock.json`.
  - Workspace package manifests under `packages/*`.
  - Optional desktop/mobile dependencies before bundling those apps in an enterprise distribution.

**Programmatic QA**
- Add `npm run license:check`.
- Fail CI on missing first-party package license metadata.
- Fail CI on unknown, GPL/AGPL/LGPL, or custom runtime dependency licenses unless explicitly allowlisted.
- Store the allowlist in `scripts/license-allowlist.json`.
- Verify generated reports do not include secrets or local absolute paths before publishing artifacts.

**UI QA**
- Verify self-hosting docs link to the license and legal notes from the setup flow/docs index.
- If an about/settings screen shows license/build info, verify it renders `AGPL-3.0-or-later` for the core app and does not expose private repository/deployment metadata.

### 6.7 Phase 6 release gates
- Programmatic gate:
  - `npm run check:config`
  - `npm run docs:check:self-hosting`
  - `npm run license:check`
  - `npm run check:shared-isomorphic`
  - `npm run check:module-boundaries`
  - `npm run typecheck`
  - Targeted route/provider tests for auth, billing, storage, LLM, API keys, webhooks, and capabilities.
  - `npm run build`
- UI gate:
  - Browser pass in SaaS staging mode.
  - Browser pass in on-prem minimal mode.
  - Browser pass in on-prem S3/OIDC/OpenAI fixture mode if the adapters are implemented in 6.2.
  - Mobile viewport pass for disabled capabilities.
  - Signed-in workflow pass: chat send, list conversations, file upload/content URL, output content URL, automation runner callback, settings/system view.
  - Disabled-feature pass: billing hidden and server-blocked when disabled; webhooks/API keys hidden until public exposure.

**Deliverable:** A new developer can fork the repo, set `AUTH_PROVIDER=keycloak` or an OIDC-compatible provider, `STORAGE_PROVIDER=s3`, `LLM_GATEWAY=openai`, run config validation plus `npm run build`, and have a working on-prem deployment with documented disabled states for anything not configured.

**Implemented deliverables:**
- `npm run test:phase6-routes` covers provider bootstrap, API key format/scopes, webhook schemas, and deterministic capability-disabled route behavior.
- `npm run check:phase6` runs config, docs, license, shared/module boundary, provider, Phase 6 route, typecheck, and build gates sequentially.
- [`docs/PHASE6_RELEASE_GATES.md`](../../docs/PHASE6_RELEASE_GATES.md) documents the on-prem env/config shape, disabled-state expectations, and manual SaaS/on-prem/mobile UI QA gate.

---

## Cross-Cutting Concerns (All Phases)

### Testing Strategy
- Co-locate tests: `*.test.ts` next to the file they test.
- Add `src/server/<domain>/*.test.ts` for domain services.
- Use `NoOp` adapters in tests — no network calls, no Stripe/WorkOS mocks needed.
- Add integration tests for adapter implementations only.

### Migration Strategy
- Each phase is independently shippable.
- Keep mobile, desktop, and Chrome clients on `/api/v1/*`.
- After all phases, remove shims in a final cleanup PR.

### Documentation
- Update `README.md` with the new directory structure.
- Add `ARCHITECTURE.md` explaining the layer boundaries, provider contracts, and how to add a new feature.
- Document the `packages/` public API in each package's `README.md`.

### Performance
- Bundle analysis after Phase 2.
- Server Components + Suspense after Phase 2.
- Code splitting by feature after Phase 4.

---

## Estimated Effort

| Phase | Weeks | Team Size |
|---|---|---|
| Phase 1: Restructure | 1 | 1 engineer |
| Phase 2: Component Breakdown | 1–1.5 | 1 engineer |
| Phase 3: Clean Architecture | 2 | 1–2 engineers |
| Phase 4: Package Expansion | 1.5 | 1 engineer |
| Phase 5: API Portability | 1 | 1 engineer |
| Phase 6: On-Prem | 0.5 | 1 engineer |
| **Total** | **~7 weeks** | **1–2 engineers** |

Each phase can be parallelized (e.g., Phase 4 package extraction can happen alongside Phase 3 domain service refactoring). A team of 2 can complete this in 4–5 weeks.

---

## Decision Log

| Decision | Rationale |
|---|---|
| No standalone `overlay-api/` yet | The web app's `/api/v1/*` layer will be modular enough to port later. Building the standalone service now is premature. |
| `src/features/` over `src/components/` | Next.js App Router best practice. Co-locates UI, hooks, transport, and types per domain. Makes ownership obvious. |
| `src/server/` for domain services | `import "server-only"` guarantees no accidental client leakage. Separates Node-only code from isomorphic code. |
| Provider interfaces in `@overlay/app-core` | The app core already has a contracts file and registry pattern. Extending it is natural and keeps the interface close to the app shell. |
| `NoOp` adapters for every provider | Makes testing trivial and on-prem deployment possible without every vendor SDK. |
| Zod schemas in `src/shared/schemas/` | Shared between client (`@overlay/api-client`) and server (route validation). Prevents drift. |
| Convex restructure into `convex/domains/` | Matches the `src/features/` and `src/server/` structure. Makes the backend as navigable as the frontend. |
