#!/usr/bin/env node
/**
 * Phase 1.3: rewrite imports after client-safe modules moved to shared/.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const REPLACEMENTS = [
  // moved shared → server (longest first)
  ["@/server/knowledge/ask-knowledge-context", "@/server/knowledge/ask-knowledge-context"],
  ["@/server/knowledge/mention-resolver", "@/server/knowledge/mention-resolver"],
  ["@/server/security/rate-limit", "@/server/security/rate-limit"],
  ["@/server/web/web-tools", "@/server/web/web-tools"],
  ["@/server/chat/context-compaction.test", "@/server/chat/context-compaction.test"],
  ["@/server/chat/context-compaction", "@/server/chat/context-compaction"],

  // moved server → shared
  ["@/shared/billing/billing-pricing", "@/shared/billing/billing-pricing"],
  ["@/shared/ai/gateway/model-fallbacks.test", "@/shared/ai/gateway/model-fallbacks.test"],
  ["@/shared/ai/gateway/model-zdr.test", "@/shared/ai/gateway/model-zdr.test"],
  ["@/shared/ai/gateway/model-fallbacks", "@/shared/ai/gateway/model-fallbacks"],
  ["@/shared/ai/gateway/model-data", "@/shared/ai/gateway/model-data"],
  ["@/shared/ai/gateway/model-types", "@/shared/ai/gateway/model-types"],
  ["@/shared/ai/gateway/generated/", "@/shared/ai/gateway/generated/"],
  ["@/shared/chat/chat-suggestions-defaults", "@/shared/chat/chat-suggestions-defaults"],
  ["@/shared/chat/cloudflare-chat-transport", "@/shared/chat/cloudflare-chat-transport"],
  ["@/shared/chat/chat-list-cache", "@/shared/chat/chat-list-cache"],
  ["@/shared/chat/chat-model-prefs", "@/shared/chat/chat-model-prefs"],
  ["@/shared/chat/chat-title", "@/shared/chat/chat-title"],

  // convex relative paths
  ["../src/shared/billing/billing-pricing", "../src/shared/billing/billing-pricing"],
  ["../../src/shared/billing/billing-pricing", "../../src/shared/billing/billing-pricing"],
  ["../src/shared/ai/gateway/model-types", "../src/shared/ai/gateway/model-types"],
];

const SCAN_DIRS = [
  "src",
  "convex",
  "packages",
  "overlay-desktop",
  "scripts",
  "workers",
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walk(p, out);
    } else if (/\.(ts|tsx|mjs|js)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

let changed = 0;
for (const rel of SCAN_DIRS) {
  const base = path.join(ROOT, rel);
  for (const file of walk(base)) {
    let text = fs.readFileSync(file, "utf8");
    const before = text;
    for (const [from, to] of REPLACEMENTS) {
      text = text.split(from).join(to);
    }
    if (text !== before) {
      fs.writeFileSync(file, text);
      changed++;
    }
  }
}
console.log(`Phase 1.3 import updates: ${changed} files`);
