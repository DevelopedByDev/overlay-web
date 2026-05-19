#!/usr/bin/env bash
# Phase 1.3: move client-safe modules to shared/; server-only modules out of shared/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p src/shared/billing src/shared/ai/gateway src/server/knowledge src/server/security

mv_file() {
  local src="$1" dest="$2"
  if [[ -e "$src" ]]; then git mv "$src" "$dest"; fi
}

# Client-safe: billing
mv_file src/server/billing/billing-pricing.ts src/shared/billing/billing-pricing.ts
mv_file src/server/billing/billing-pricing.test.ts src/shared/billing/billing-pricing.test.ts

# Client-safe: model catalog
mv_file src/server/ai/gateway/generated src/shared/ai/gateway/generated
for f in model-types.ts model-data.ts model-fallbacks.ts model-zdr.test.ts model-fallbacks.test.ts; do
  mv_file "src/server/ai/gateway/$f" "src/shared/ai/gateway/$f"
done

# Client-safe: chat UI helpers
for f in chat-title.ts chat-model-prefs.ts chat-list-cache.ts chat-suggestions-defaults.ts cloudflare-chat-transport.ts; do
  mv_file "src/server/chat/$f" "src/shared/chat/$f"
done

# Server-only: relocate misplaced shared modules
mv_file src/shared/knowledge/mention-resolver.ts src/server/knowledge/mention-resolver.ts
mv_file src/shared/security/rate-limit.ts src/server/security/rate-limit.ts
mv_file src/shared/web/web-tools.ts src/server/web/web-tools.ts
mv_file src/shared/chat/context-compaction.ts src/server/chat/context-compaction.ts
mv_file src/shared/chat/context-compaction.test.ts src/server/chat/context-compaction.test.ts

# ask-knowledge implementation → server (types already in ask-knowledge-types.ts)
mv_file src/shared/knowledge/ask-knowledge-context.ts src/server/knowledge/ask-knowledge-context.ts

echo "Phase 1.3 file moves complete."
