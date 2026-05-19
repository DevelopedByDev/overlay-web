#!/usr/bin/env bash
# Phase 1.2: migrate src/lib/* → src/server/, src/shared/, src/features/*/lib/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p \
  src/server/auth \
  src/server/billing \
  src/server/storage \
  src/server/database \
  src/server/ai/sandbox \
  src/server/ai/gateway \
  src/server/tools \
  src/server/agent \
  src/server/chat \
  src/server/observability \
  src/shared/chat \
  src/shared/markdown \
  src/shared/security \
  src/shared/web \
  src/shared/storage \
  src/shared/knowledge \
  src/shared/app \
  src/shared/tools \
  src/shared/auth \
  src/shared/database \
  src/features/landing/lib \
  src/features/integrations/lib \
  src/features/auth/lib \
  src/features/share/lib \
  src/features/notebook/lib \
  src/features/automations/lib \
  src/features/files/lib

mv_file() {
  local src="$1" dest="$2"
  if [[ -e "$src" ]]; then
    git mv "$src" "$dest"
  else
    echo "skip missing: $src" >&2
  fi
}

# --- server/auth ---
for f in workos-auth.ts service-auth.ts service-auth-replay.ts session-cookie-signature.ts \
  session-cookie-signature.test.ts session-transfer-crypto.ts native-auth-validation.ts \
  native-auth-validation.test.ts native-refresh-rate-limit.ts native-refresh-rate-limit.test.ts \
  auth-debug.ts app-api-auth.ts; do
  mv_file "src/lib/$f" "src/server/auth/$f"
done

# --- server/billing ---
for f in stripe.ts stripe-billing.ts billing-runtime.ts billing-runtime.test.ts \
  billing-pricing.ts billing-pricing.test.ts; do
  mv_file "src/lib/$f" "src/server/billing/$f"
done

# --- server/storage ---
for f in r2.ts r2-budget.ts r2-upload-intents.ts storage-keys.ts; do
  mv_file "src/lib/$f" "src/server/storage/$f"
done

# --- server/database ---
mv_file src/lib/convex.ts src/server/database/convex.ts

# --- server/ai/sandbox ---
mv_file src/lib/daytona.ts src/server/ai/sandbox/daytona.ts
mv_file src/lib/daytona-pricing.ts src/server/ai/sandbox/daytona-pricing.ts

# --- server/ai/gateway ---
mv_file src/lib/generated src/server/ai/gateway/generated
for f in ai-gateway.ts openrouter-service.ts nvidia-nim-openai.ts model-data.ts model-pricing.ts \
  model-fallbacks.ts model-types.ts model-zdr.test.ts model-pricing.test.ts model-fallbacks.test.ts \
  server-provider-keys.ts; do
  mv_file "src/lib/$f" "src/server/ai/gateway/$f"
done

# --- server/tools ---
for f in composio-tools.ts mcp-tools.ts mcp-schema-to-zod.ts internal-api-secret.ts media-tool-intent.ts; do
  mv_file "src/lib/$f" "src/server/tools/$f"
done
if [[ -d src/lib/tools ]]; then
  for t in src/lib/tools/*; do
    git mv "$t" "src/server/tools/$(basename "$t")"
  done
  rmdir src/lib/tools
fi

# --- server/agent ---
if [[ -d src/lib/agent ]]; then
  git mv src/lib/agent/run-act-turn.ts src/server/agent/run-act-turn.ts
  rmdir src/lib/agent 2>/dev/null || true
fi
for f in notebook-agent-stream.ts notebook-agent-stream.test.ts notebook-agent-prompts.ts \
  notebook-agent-contract.ts operator-system-prompt.ts document-context-builder.ts \
  knowledge-agent-instructions.ts; do
  mv_file "src/lib/$f" "src/server/agent/$f"
done

# --- server/chat ---
for f in chat-message-persistence.ts chat-stream-relay-auth.ts chat-title.ts chat-model-prefs.ts \
  chat-list-cache.ts chat-suggestions-defaults.ts cloudflare-chat-transport.ts \
  chat-history-persistence.test.ts; do
  mv_file "src/lib/$f" "src/server/chat/$f"
done

# --- server/observability ---
mv_file src/lib/posthog-server.ts src/server/observability/posthog-server.ts

# --- shared/chat ---
for f in context-compaction.ts context-compaction.test.ts sanitize-ui-messages-for-model.ts \
  reply-context-for-model.ts persist-assistant-turn.ts agent-assistant-text.ts \
  leaked-perplexity-tool-repair.ts; do
  mv_file "src/lib/$f" "src/shared/chat/$f"
done

# --- shared/markdown ---
for f in markdown-table-fix.ts math-markdown-normalize.ts math-format-instructions.ts \
  shim-incomplete-markdown.ts markdown-table-instructions.ts \
  math-markdown-normalize.test.ts shim-incomplete-markdown.test.ts; do
  mv_file "src/lib/$f" "src/shared/markdown/$f"
done

# --- shared/security ---
for f in safe-url.ts ssrf.ts rate-limit.ts safe-log.ts sentry-sanitize.ts security-events.ts \
  safe-url.test.ts ssrf.test.ts sentry-sanitize.test.ts security-hardening.test.ts; do
  mv_file "src/lib/$f" "src/shared/security/$f"
done

# --- shared/web ---
for f in url.ts web-sources.ts web-tools.ts latest-release.ts; do
  mv_file "src/lib/$f" "src/shared/web/$f"
done

# --- shared/storage ---
for f in convex-file-content.ts file-text-search.ts file-text-search.test.ts storage-limits.ts; do
  mv_file "src/lib/$f" "src/shared/storage/$f"
done

# --- shared/knowledge ---
for f in ask-knowledge-context.ts mention-resolver.ts mention-tokens.ts knowledge-agent-types.ts \
  memory-display-segments.ts; do
  mv_file "src/lib/$f" "src/shared/knowledge/$f"
done

# --- shared/app ---
for f in app-contracts.ts app-store.ts overlay-app-client.ts overlay-gated-feature.ts themes.ts \
  async-sessions-store.tsx navigation-progress.tsx; do
  mv_file "src/lib/$f" "src/shared/app/$f"
done

# --- shared/tools ---
mv_file src/lib/output-types.ts src/shared/tools/output-types.ts
mv_file src/lib/tool-result-summary.ts src/shared/tools/tool-result-summary.ts

# --- shared/auth ---
for f in auth-constants.ts auth-redirect.ts mobile-auth-client.ts; do
  mv_file "src/lib/$f" "src/shared/auth/$f"
done

# --- shared/database ---
mv_file src/lib/convex-react-client.ts src/shared/database/convex-react-client.ts

# --- feature libs ---
for f in landingPageStyles.ts landingThemeConstants.ts static-pages.ts marketing.ts audience-pages.ts; do
  mv_file "src/lib/$f" "src/features/landing/lib/$f"
done
mv_file src/lib/integration-logo-cache.ts src/features/integrations/lib/integration-logo-cache.ts
mv_file src/lib/integrations-events.ts src/features/integrations/lib/integrations-events.ts
mv_file src/lib/onboarding-cookie.ts src/features/auth/lib/onboarding-cookie.ts
mv_file src/lib/share-url.ts src/features/share/lib/share-url.ts
mv_file src/lib/notebook-editor-blocks.ts src/features/notebook/lib/notebook-editor-blocks.ts
mv_file src/lib/skill-drafts.ts src/features/automations/lib/skill-drafts.ts
mv_file src/lib/automation-drafts.ts src/features/automations/lib/automation-drafts.ts
if [[ -d src/lib/export ]]; then
  git mv src/lib/export src/features/files/lib/export
fi

# Remove empty src/lib if possible
if [[ -d src/lib ]] && [[ -z "$(ls -A src/lib 2>/dev/null)" ]]; then
  rmdir src/lib
fi

echo "Phase 1.2 file moves complete."
