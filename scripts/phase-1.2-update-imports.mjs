#!/usr/bin/env node
/**
 * Phase 1.2: rewrite @/lib/* imports after server/shared/features lib migration.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Longest paths first (avoids `convex` matching inside `convex-file-content`) */
const REPLACEMENTS = [
  // feature libs
  ["@/lib/landingPageStyles", "@/features/landing/lib/landingPageStyles"],
  ["@/lib/landingThemeConstants", "@/features/landing/lib/landingThemeConstants"],
  ["@/lib/static-pages", "@/features/landing/lib/static-pages"],
  ["@/lib/marketing", "@/features/landing/lib/marketing"],
  ["@/lib/audience-pages", "@/features/landing/lib/audience-pages"],
  ["@/lib/integration-logo-cache", "@/features/integrations/lib/integration-logo-cache"],
  ["@/lib/integrations-events", "@/features/integrations/lib/integrations-events"],
  ["@/lib/onboarding-cookie", "@/features/auth/lib/onboarding-cookie"],
  ["@/lib/share-url", "@/features/share/lib/share-url"],
  ["@/lib/notebook-editor-blocks", "@/features/notebook/lib/notebook-editor-blocks"],
  ["@/lib/skill-drafts", "@/features/automations/lib/skill-drafts"],
  ["@/lib/automation-drafts", "@/features/automations/lib/automation-drafts"],
  ["@/lib/export/", "@/features/files/lib/export/"],

  // server agent
  ["@/lib/agent/run-act-turn", "@/server/agent/run-act-turn"],
  ["@/lib/notebook-agent-stream", "@/server/agent/notebook-agent-stream"],
  ["@/lib/notebook-agent-prompts", "@/server/agent/notebook-agent-prompts"],
  ["@/lib/notebook-agent-contract", "@/server/agent/notebook-agent-contract"],
  ["@/lib/operator-system-prompt", "@/server/agent/operator-system-prompt"],
  ["@/lib/document-context-builder", "@/server/agent/document-context-builder"],
  ["@/lib/knowledge-agent-instructions", "@/server/agent/knowledge-agent-instructions"],

  // server tools
  ["@/lib/tools/", "@/server/tools/tools/"],
  ["@/lib/composio-tools", "@/server/tools/composio-tools"],
  ["@/lib/mcp-tools", "@/server/tools/mcp-tools"],
  ["@/lib/mcp-schema-to-zod", "@/server/tools/mcp-schema-to-zod"],
  ["@/lib/internal-api-secret", "@/server/tools/internal-api-secret"],
  ["@/lib/media-tool-intent", "@/server/tools/media-tool-intent"],

  // server chat
  ["@/lib/chat-message-persistence", "@/server/chat/chat-message-persistence"],
  ["@/lib/chat-stream-relay-auth", "@/server/chat/chat-stream-relay-auth"],
  ["@/lib/chat-suggestions-defaults", "@/shared/chat/chat-suggestions-defaults"],
  ["@/lib/chat-model-prefs", "@/shared/chat/chat-model-prefs"],
  ["@/lib/chat-list-cache", "@/shared/chat/chat-list-cache"],
  ["@/lib/cloudflare-chat-transport", "@/shared/chat/cloudflare-chat-transport"],
  ["@/lib/chat-history-persistence.test", "@/server/chat/chat-history-persistence.test"],
  ["@/lib/chat-title", "@/shared/chat/chat-title"],

  // shared chat
  ["@/lib/context-compaction", "@/server/chat/context-compaction"],
  ["@/lib/sanitize-ui-messages-for-model", "@/shared/chat/sanitize-ui-messages-for-model"],
  ["@/lib/reply-context-for-model", "@/shared/chat/reply-context-for-model"],
  ["@/lib/persist-assistant-turn", "@/shared/chat/persist-assistant-turn"],
  ["@/lib/agent-assistant-text", "@/shared/chat/agent-assistant-text"],
  ["@/lib/leaked-perplexity-tool-repair", "@/shared/chat/leaked-perplexity-tool-repair"],

  // server ai gateway
  ["@/lib/generated/", "@/shared/ai/gateway/generated/"],
  ["@/lib/ai-gateway", "@/server/ai/gateway/ai-gateway"],
  ["@/lib/openrouter-service", "@/server/ai/gateway/openrouter-service"],
  ["@/lib/nvidia-nim-openai", "@/server/ai/gateway/nvidia-nim-openai"],
  ["@/lib/server-provider-keys", "@/server/ai/gateway/server-provider-keys"],
  ["@/lib/model-fallbacks.test", "@/shared/ai/gateway/model-fallbacks.test"],
  ["@/lib/model-pricing.test", "@/server/ai/gateway/model-pricing.test"],
  ["@/lib/model-zdr.test", "@/shared/ai/gateway/model-zdr.test"],
  ["@/lib/model-fallbacks", "@/shared/ai/gateway/model-fallbacks"],
  ["@/lib/model-pricing", "@/server/ai/gateway/model-pricing"],
  ["@/lib/model-types", "@/shared/ai/gateway/model-types"],
  ["@/lib/model-data", "@/shared/ai/gateway/model-data"],

  // server ai sandbox
  ["@/lib/daytona-pricing", "@/server/ai/sandbox/daytona-pricing"],
  ["@/lib/daytona", "@/server/ai/sandbox/daytona"],

  // server auth
  ["@/lib/session-cookie-signature.test", "@/server/auth/session-cookie-signature.test"],
  ["@/lib/session-cookie-signature", "@/server/auth/session-cookie-signature"],
  ["@/lib/session-transfer-crypto", "@/server/auth/session-transfer-crypto"],
  ["@/lib/service-auth-replay", "@/server/auth/service-auth-replay"],
  ["@/lib/native-auth-validation.test", "@/server/auth/native-auth-validation.test"],
  ["@/lib/native-auth-validation", "@/server/auth/native-auth-validation"],
  ["@/lib/native-refresh-rate-limit.test", "@/server/auth/native-refresh-rate-limit.test"],
  ["@/lib/native-refresh-rate-limit", "@/server/auth/native-refresh-rate-limit"],
  ["@/lib/workos-auth", "@/server/auth/workos-auth"],
  ["@/lib/service-auth", "@/server/auth/service-auth"],
  ["@/lib/app-api-auth", "@/server/auth/app-api-auth"],
  ["@/lib/auth-debug", "@/server/auth/auth-debug"],

  // shared auth
  ["@/lib/mobile-auth-client", "@/shared/auth/mobile-auth-client"],
  ["@/lib/auth-redirect", "@/shared/auth/auth-redirect"],
  ["@/lib/auth-constants", "@/shared/auth/auth-constants"],

  // server billing
  ["@/lib/billing-runtime.test", "@/server/billing/billing-runtime.test"],
  ["@/lib/billing-pricing.test", "@/shared/billing/billing-pricing.test"],
  ["@/lib/stripe-billing", "@/server/billing/stripe-billing"],
  ["@/lib/billing-runtime", "@/server/billing/billing-runtime"],
  ["@/lib/billing-pricing", "@/shared/billing/billing-pricing"],
  ["@/lib/stripe", "@/server/billing/stripe"],

  // server storage
  ["@/lib/r2-upload-intents", "@/server/storage/r2-upload-intents"],
  ["@/lib/storage-keys", "@/server/storage/storage-keys"],
  ["@/lib/r2-budget", "@/server/storage/r2-budget"],
  ["@/lib/r2", "@/server/storage/r2"],

  // server database / observability (convex-file-content before convex — see sort below)
  ["@/lib/convex-react-client", "@/shared/database/convex-react-client"],
  ["@/lib/convex-file-content", "@/shared/storage/convex-file-content"],
  ["@/lib/convex", "@/server/database/convex"],
  ["@/lib/posthog-server", "@/server/observability/posthog-server"],

  // shared storage
  ["@/lib/file-text-search.test", "@/shared/storage/file-text-search.test"],
  ["@/lib/file-text-search", "@/shared/storage/file-text-search"],
  ["@/lib/storage-limits", "@/shared/storage/storage-limits"],

  // shared markdown
  ["@/lib/shim-incomplete-markdown.test", "@/shared/markdown/shim-incomplete-markdown.test"],
  ["@/lib/math-markdown-normalize.test", "@/shared/markdown/math-markdown-normalize.test"],
  ["@/lib/markdown-table-instructions", "@/shared/markdown/markdown-table-instructions"],
  ["@/lib/shim-incomplete-markdown", "@/shared/markdown/shim-incomplete-markdown"],
  ["@/lib/math-format-instructions", "@/shared/markdown/math-format-instructions"],
  ["@/lib/math-markdown-normalize", "@/shared/markdown/math-markdown-normalize"],
  ["@/lib/markdown-table-fix", "@/shared/markdown/markdown-table-fix"],

  // shared security
  ["@/lib/security-hardening.test", "@/shared/security/security-hardening.test"],
  ["@/lib/sentry-sanitize.test", "@/shared/security/sentry-sanitize.test"],
  ["@/lib/security-events", "@/shared/security/security-events"],
  ["@/lib/sentry-sanitize", "@/shared/security/sentry-sanitize"],
  ["@/lib/rate-limit", "@/server/security/rate-limit"],
  ["@/lib/safe-url.test", "@/shared/security/safe-url.test"],
  ["@/lib/ssrf.test", "@/shared/security/ssrf.test"],
  ["@/lib/safe-log", "@/shared/security/safe-log"],
  ["@/lib/safe-url", "@/shared/security/safe-url"],
  ["@/lib/ssrf", "@/shared/security/ssrf"],

  // shared web
  ["@/lib/latest-release", "@/shared/web/latest-release"],
  ["@/lib/web-sources", "@/shared/web/web-sources"],
  ["@/lib/web-tools", "@/server/web/web-tools"],
  ["@/lib/url", "@/shared/web/url"],

  // shared knowledge
  ["@/lib/ask-knowledge-context", "@/server/knowledge/ask-knowledge-context"],
  ["@/lib/knowledge-agent-types", "@/shared/knowledge/knowledge-agent-types"],
  ["@/lib/memory-display-segments", "@/shared/knowledge/memory-display-segments"],
  ["@/lib/mention-resolver", "@/server/knowledge/mention-resolver"],
  ["@/lib/mention-tokens", "@/shared/knowledge/mention-tokens"],

  // shared app
  ["@/lib/overlay-app-client", "@/shared/app/overlay-app-client"],
  ["@/lib/overlay-gated-feature", "@/shared/app/overlay-gated-feature"],
  ["@/lib/navigation-progress", "@/shared/app/navigation-progress"],
  ["@/lib/async-sessions-store", "@/shared/app/async-sessions-store"],
  ["@/lib/app-contracts", "@/shared/app/app-contracts"],
  ["@/lib/app-store", "@/shared/app/app-store"],
  ["@/lib/themes", "@/shared/app/themes"],

  // shared tools
  ["@/lib/tool-result-summary", "@/shared/tools/tool-result-summary"],
  ["@/lib/output-types", "@/shared/tools/output-types"],
];

/** Relative imports between moved lib modules (same-folder re-exports) */
const RELATIVE_LIB_FIXES = [
  ["from './auth-constants'", "from '@/shared/auth/auth-constants'"],
  ['from "./auth-constants"', 'from "@/shared/auth/auth-constants"'],
  ["from './marketing'", "from '@/features/landing/lib/marketing'"],
  ['from "./marketing"', 'from "@/features/landing/lib/marketing"'],
  ["from './session-transfer-crypto'", "from '@/server/auth/session-transfer-crypto'"],
  ["from './auth-debug'", "from '@/server/auth/auth-debug'"],
  ["from './url'", "from '@/shared/web/url'"],
  ["from './stripe'", "from '@/server/billing/stripe'"],
  ["from './convex'", "from '@/server/database/convex'"],
  ["from './r2'", "from '@/server/storage/r2'"],
  ["from './storage-keys'", "from '@/server/storage/storage-keys'"],
  ["from './overlay-app-client'", "from '@/shared/app/overlay-app-client'"],
  ["from './model-types'", "from '@/shared/ai/gateway/model-types'"],
  ["from './model-data'", "from '@/shared/ai/gateway/model-data'"],
  ["from './service-auth'", "from '@/server/auth/service-auth'"],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next" || ent.name === "_generated") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(tsx?|mts|md)$/.test(ent.name)) files.push(p);
  }
  return files;
}

const SORTED_REPLACEMENTS = [...REPLACEMENTS].sort((a, b) => b[0].length - a[0].length);

function applyReplacements(content) {
  let out = content;
  for (const [from, to] of SORTED_REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  for (const [from, to] of RELATIVE_LIB_FIXES) {
    out = out.split(from).join(to);
  }
  return out;
}

/** Files that lived in src/lib/*.ts used ../../convex; one level deeper needs ../../../convex */
function fixConvexRelativeImports(content, filePath) {
  const rel = path.relative(path.join(ROOT, "src"), filePath);
  const depth = rel.split(path.sep).length - 1; // segments under src/
  if (depth < 2) return content;

  let out = content;
  // Bump only paths that still point at convex with too-shallow depth
  if (depth >= 3 && out.includes("../../convex")) {
    out = out.replace(/from (['"])\.\.\/\.\.\/convex\//g, "from $1../../../convex/");
    out = out.replace(/from (['"])\.\.\/\.\.\/convex\1/g, "from $1../../../convex$1");
  }
  return out;
}

let changed = 0;
const scanRoots = [
  path.join(ROOT, "src"),
  path.join(ROOT, "packages"),
  path.join(ROOT, "overlay-desktop"),
];
for (const root of scanRoots) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    let content = fs.readFileSync(file, "utf8");
    let next = applyReplacements(content);
    next = fixConvexRelativeImports(next, file);
    if (next !== content) {
      fs.writeFileSync(file, next);
      changed++;
    }
  }
}

console.log(`Updated ${changed} files`);
