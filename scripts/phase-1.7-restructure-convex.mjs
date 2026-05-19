#!/usr/bin/env node
/**
 * Phase 1.7: Restructure convex/*.ts into domain folders and remap function paths.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const CONVEX = path.join(ROOT, 'convex')

/** @type {Array<[string, string]>} */
const MOVES = [
  ['conversations.ts', 'chat/conversations.ts'],
  ['files.ts', 'files/files.ts'],
  ['knowledge.ts', 'knowledge/knowledge.ts'],
  ['notes.ts', 'files/notes.ts'],
  ['subscriptions.ts', 'billing/subscriptions.ts'],
  ['stripe.ts', 'billing/stripe.ts'],
  ['stripeSync.ts', 'billing/stripeSync.ts'],
  ['users.ts', 'auth/users.ts'],
  ['automations.ts', 'automations/automations.ts'],
  ['automationRunner.ts', 'automations/automationRunner.ts'],
  ['projects.ts', 'projects/projects.ts'],
  ['outputs.ts', 'outputs/outputs.ts'],
  ['memories.ts', 'knowledge/memories.ts'],
  ['memoryExtractor.ts', 'knowledge/memoryExtractor.ts'],
  ['memoryExtractorNode.ts', 'knowledge/memoryExtractorNode.ts'],
  ['skills.ts', 'integrations/skills.ts'],
  ['mcpServers.ts', 'integrations/mcpServers.ts'],
  ['daytona.ts', 'ai/sandbox/daytona.ts'],
  ['daytonaReconcile.ts', 'ai/sandbox/daytonaReconcile.ts'],
  ['usage.ts', 'platform/usage.ts'],
  ['rateLimits.ts', 'platform/rateLimits.ts'],
  ['uiSettings.ts', 'platform/uiSettings.ts'],
  ['serviceAuth.ts', 'auth/serviceAuth.ts'],
  ['sessionTransfer.ts', 'auth/sessionTransfer.ts'],
  ['http.ts', 'platform/http.ts'],
  ['crons.ts', 'platform/crons.ts'],
  ['keys.ts', 'platform/keys.ts'],
  ['seedDemoAccount.ts', 'platform/seedDemoAccount.ts'],
  ['storageAdmin.ts', 'files/storageAdmin.ts'],
  ['authDebug.ts', 'auth/authDebug.ts'],
  ['lib/stripeOverlaySubscription.ts', 'billing/lib/stripeOverlaySubscription.ts'],
  ['lib/storageQuota.ts', 'files/lib/storageQuota.ts'],
]

/** Longest-prefix first for `module:` string paths */
const MODULE_COLON_REMAPS = [
  ['knowledge/memoryExtractorNode:', 'knowledge/memoryExtractorNode:'],
  ['knowledge/memoryExtractor:', 'knowledge/memoryExtractor:'],
  ['knowledge/memories:', 'knowledge/memories:'],
  ['ai/sandbox/daytonaReconcile:', 'ai/sandbox/daytonaReconcile:'],
  ['ai/sandbox/daytona:', 'ai/sandbox/daytona:'],
  ['integrations/mcpServers:', 'integrations/mcpServers:'],
  ['automations/automationRunner:', 'automations/automationRunner:'],
  ['files/storageAdmin:', 'files/storageAdmin:'],
  ['auth/sessionTransfer:', 'auth/sessionTransfer:'],
  ['auth/serviceAuth:', 'auth/serviceAuth:'],
  ['billing/stripeSync:', 'billing/stripeSync:'],
  ['platform/uiSettings:', 'platform/uiSettings:'],
  ['platform/rateLimits:', 'platform/rateLimits:'],
  ['platform/seedDemoAccount:', 'platform/seedDemoAccount:'],
  ['chat/conversations:', 'chat/conversations:'],
  ['billing/subscriptions:', 'billing/subscriptions:'],
  ['automations/automations:', 'automations/automations:'],
  ['knowledge/knowledge:', 'knowledge/knowledge:'],
  ['projects/projects:', 'projects/projects:'],
  ['outputs/outputs:', 'outputs/outputs:'],
  ['integrations/skills:', 'integrations/skills:'],
  ['platform/usage:', 'platform/usage:'],
  ['auth/users:', 'auth/users:'],
  ['billing/stripe:', 'billing/stripe:'],
  ['files/notes:', 'files/notes:'],
  ['files/files:', 'files/files:'],
]

/** For api.foo / internal.foo property access (longest first) */
const MODULE_DOT_REMAPS = [
  ['internal.knowledge.knowledge.memoryExtractorNode', 'internal.knowledge.knowledge.memoryExtractorNode'],
  ['internal.knowledge.knowledge.memoryExtractor', 'internal.knowledge.knowledge.memoryExtractor'],
  ['internal.ai.sandbox.daytonaReconcile', 'internal.ai.sandbox.daytonaReconcile'],
  ['internal.automations.automations.automationRunner', 'internal.automations.automations.automationRunner'],
  ['internal.billing.lib.stripeOverlaySubscription', 'internal.billing.lib.stripeOverlaySubscription'],
  ['internal.files.files.storageAdmin', 'internal.files.files.storageAdmin'],
  ['internal.auth.sessionTransfer', 'internal.auth.sessionTransfer'],
  ['internal.auth.serviceAuth', 'internal.auth.serviceAuth'],
  ['internal.billing.stripeSync', 'internal.billing.stripeSync'],
  ['internal.platform.uiSettings', 'internal.platform.uiSettings'],
  ['internal.platform.rateLimits', 'internal.platform.rateLimits'],
  ['internal.platform.seedDemoAccount', 'internal.platform.seedDemoAccount'],
  ['internal.chat.conversations', 'internal.chat.conversations'],
  ['internal.billing.subscriptions', 'internal.billing.subscriptions'],
  ['internal.automations.automations', 'internal.automations.automations.automations'],
  ['internal.knowledge.knowledge.memoryExtractor', 'internal.knowledge.knowledge.memoryExtractor'],
  ['internal.integrations.mcpServers', 'internal.integrations.mcpServers'],
  ['internal.knowledge.knowledge', 'internal.knowledge.knowledge.knowledge'],
  ['internal.projects.projects', 'internal.projects.projects.projects'],
  ['internal.outputs.outputs', 'internal.outputs.outputs.outputs'],
  ['internal.knowledge.memories', 'internal.knowledge.knowledge.memories'],
  ['internal.ai.sandbox.daytona', 'internal.ai.sandbox.daytona'],
  ['internal.platform.usage', 'internal.platform.usage'],
  ['internal.auth.users', 'internal.auth.users'],
  ['internal.billing.stripe', 'internal.billing.stripe'],
  ['internal.files.files', 'internal.files.files.files'],
  ['internal.integrations.skills', 'internal.integrations.skills'],
  ['api.knowledge.knowledge.memoryExtractorNode', 'api.knowledge.knowledge.memoryExtractorNode'],
  ['api.knowledge.knowledge.memoryExtractor', 'api.knowledge.knowledge.memoryExtractor'],
  ['api.ai.sandbox.daytonaReconcile', 'api.ai.sandbox.daytonaReconcile'],
  ['api.automations.automations.automationRunner', 'api.automations.automations.automationRunner'],
  ['api.files.files.storageAdmin', 'api.files.files.storageAdmin'],
  ['api.auth.sessionTransfer', 'api.auth.sessionTransfer'],
  ['api.auth.serviceAuth', 'api.auth.serviceAuth'],
  ['api.billing.stripeSync', 'api.billing.stripeSync'],
  ['api.platform.uiSettings', 'api.platform.uiSettings'],
  ['api.platform.rateLimits', 'api.platform.rateLimits'],
  ['api.chat.conversations', 'api.chat.conversations'],
  ['api.billing.subscriptions', 'api.billing.subscriptions'],
  ['api.automations.automations', 'api.automations.automations.automations'],
  ['api.integrations.mcpServers', 'api.integrations.mcpServers'],
  ['api.knowledge.knowledge', 'api.knowledge.knowledge.knowledge'],
  ['api.projects.projects', 'api.projects.projects.projects'],
  ['api.outputs.outputs', 'api.outputs.outputs.outputs'],
  ['api.knowledge.memories', 'api.knowledge.knowledge.memories'],
  ['api.ai.sandbox.daytona', 'api.ai.sandbox.daytona'],
  ['api.platform.usage', 'api.platform.usage'],
  ['api.auth.users', 'api.auth.users'],
  ['api.billing.stripe', 'api.billing.stripe'],
  ['api.files.files', 'api.files.files.files'],
  ['api.integrations.skills', 'api.integrations.skills'],
]

const SCAN_DIRS = [
  'src',
  'convex',
  'packages',
  'overlay-desktop',
  'scripts',
  'workers',
]

const BARREL_EXPORTS = {
  chat: ['conversations'],
  files: ['files', 'notes', 'storageAdmin', 'lib/storageQuota'],
  knowledge: ['knowledge', 'memories', 'memoryExtractor', 'memoryExtractorNode'],
  billing: ['subscriptions', 'stripe', 'stripeSync', 'lib/stripeOverlaySubscription'],
  auth: ['users', 'serviceAuth', 'sessionTransfer', 'authDebug'],
  automations: ['automations', 'automationRunner'],
  projects: ['projects'],
  outputs: ['outputs'],
  integrations: ['skills', 'mcpServers'],
  platform: [
    'usage',
    'rateLimits',
    'uiSettings',
    'http',
    'crons',
    'keys',
    'seedDemoAccount',
  ],
  'ai/sandbox': ['daytona', 'daytonaReconcile'],
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function moveFiles() {
  for (const [from, to] of MOVES) {
    const src = path.join(CONVEX, from)
    const dest = path.join(CONVEX, to)
    if (!fs.existsSync(src)) {
      console.warn(`skip missing ${from}`)
      continue
    }
    ensureDir(path.dirname(dest))
    fs.renameSync(src, dest)
    console.log(`mv ${from} → ${to}`)
  }
}

function depthFromConvexRoot(relPath) {
  const dir = path.dirname(relPath)
  if (dir === '.') return 0
  return dir.split('/').length
}

function fixConvexRelativeImports(fileRel) {
  const abs = path.join(CONVEX, fileRel)
  let text = fs.readFileSync(abs, 'utf8')
  const depth = depthFromConvexRoot(fileRel)
  const up = '../'.repeat(depth + 1)

  const replacements = [
    [`from './_generated/`, `from '${up}_generated/`],
    [`from "./_generated/`, `from "${up}_generated/`],
    [`from '../_generated/`, `from '${up}_generated/`],
    [`from "../_generated/`, `from "${up}_generated/`],
    [`from './lib/`, `from '${up}lib/`],
    [`from "./lib/`, `from "${up}lib/`],
    [`from '../lib/`, `from '${up}lib/`],
    [`from "../lib/`, `from "${up}lib/`],
    [`from '../src/shared/`, `from '${up}src/shared/`],
    [`from "../src/shared/`, `from "${up}src/shared/`],
    [`from '../../src/shared/`, `from '${up}src/shared/`],
    [`from "../../src/shared/`, `from "${up}src/shared/`],
    [`from '../../../src/shared/`, `from '${up}src/shared/`],
    [`from "../../../src/shared/`, `from "${up}src/shared/`],
  ]

  // billing/lib and files/lib use nested lib folders
  if (fileRel.startsWith('billing/lib/')) {
    replacements.push(
      [`from '${up}lib/`, `from '../../lib/`],
      [`from "${up}lib/`, `from "../../lib/`],
    )
  }
  if (fileRel.startsWith('files/lib/')) {
    replacements.push(
      [`from '${up}lib/`, `from '../../lib/`],
      [`from "${up}lib/`, `from "../../lib/`],
    )
  }

  // Cross-module relative imports from old layout
  replacements.push(
    [`from './usage'`, `from '${up}platform/usage'`],
    [`from "./usage"`, `from "${up}platform/usage"`],
    [`from './lib/stripeOverlaySubscription'`, `from './lib/stripeOverlaySubscription'`],
    [`from './lib/storageQuota'`, `from './lib/storageQuota'`],
    [`from '../lib/stripeOverlaySubscription'`, `from '../lib/stripeOverlaySubscription'`],
    [`from '../lib/storageQuota'`, `from '../lib/storageQuota'`],
  )

  if (fileRel === 'platform/http.ts') {
    replacements.push([
      `from './lib/stripeOverlaySubscription'`,
      `from '../billing/lib/stripeOverlaySubscription'`,
    ])
  }

  if (fileRel === 'platform/usage.ts') {
    replacements.push([
      `from './lib/storageQuota'`,
      `from '../files/lib/storageQuota'`,
    ])
  }

  if (fileRel === 'ai/sandbox/daytona.ts') {
    replacements.push([
      `from './usage'`,
      `from '../../platform/usage'`,
    ])
  }

  for (const [from, to] of replacements) {
    text = text.split(from).join(to)
  }

  fs.writeFileSync(abs, text)
}

function remapModulePaths(content) {
  let out = content
  for (const [from, to] of MODULE_COLON_REMAPS) {
    const re = new RegExp(`(['"\`])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')
    out = out.replace(re, `$1${to}`)
  }
  for (const [from, to] of MODULE_DOT_REMAPS) {
    out = out.split(from).join(to)
  }
  return out
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next' || ent.name === '_generated') {
        continue
      }
      walk(p, out)
    } else if (/\.(ts|tsx|mjs|js)$/.test(ent.name)) {
      out.push(p)
    }
  }
  return out
}

function writeBarrels() {
  for (const [folder, modules] of Object.entries(BARREL_EXPORTS)) {
    const dir = path.join(CONVEX, folder)
    const lines = modules.map((m) => {
      const rel = m.includes('/') ? m : `./${m}`
      const base = path.basename(m, '.ts')
      const importPath = rel.endsWith('.ts') ? rel.slice(0, -3) : rel
      return `export * from '${importPath.startsWith('.') ? importPath : `./${importPath}`}'`
    })
    const indexPath = path.join(dir, 'index.ts')
    fs.writeFileSync(
      indexPath,
      `${lines.join('\n')}\n`,
    )
    console.log(`wrote ${path.relative(ROOT, indexPath)}`)
  }
}

function main() {
  moveFiles()
  for (const [, to] of MOVES) {
    fixConvexRelativeImports(to)
  }
  writeBarrels()

  let changed = 0
  for (const rel of SCAN_DIRS) {
    const base = path.join(ROOT, rel)
    for (const file of walk(base)) {
      const before = fs.readFileSync(file, 'utf8')
      const after = remapModulePaths(before)
      if (after !== before) {
        fs.writeFileSync(file, after)
        changed++
      }
    }
  }
  console.log(`Remapped convex paths in ${changed} files`)
}

main()
