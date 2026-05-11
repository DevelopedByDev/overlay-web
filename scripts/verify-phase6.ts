// @enterprise-future — not wired to production
// Phase 6 verification: Enterprise documentation site

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const DOCS = join(ROOT, 'docs-site')

let allPassed = true

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`)
  } else {
    console.error(`  [FAIL] ${message}`)
    allPassed = false
  }
}

function hasFrontmatter(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8')
  return content.startsWith('---')
}

function hasMermaid(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8')
  return content.includes('```mermaid')
}

function countEnvVars(filePath: string): number {
  const content = readFileSync(filePath, 'utf-8')
  const matches = content.match(/^\| `[^`]+` \|/gm)
  return matches?.length ?? 0
}

console.log('\n=== Overlay Phase 6 Verification ===\n')

// 1. Mintlify config
console.log('1. Mintlify infrastructure')
const mintJsonPath = join(DOCS, 'mint.json')
assert(existsSync(mintJsonPath), 'mint.json exists')
if (existsSync(mintJsonPath)) {
  try {
    const mint = JSON.parse(readFileSync(mintJsonPath, 'utf-8'))
    assert(mint.name === 'Overlay Enterprise Docs', 'mint.json has correct name')
    assert(Array.isArray(mint.navigation), 'mint.json has navigation array')
    assert(mint.navigation.length >= 5, 'mint.json has at least 5 nav groups')
  } catch {
    assert(false, 'mint.json is valid JSON')
  }
}

// 2. Core docs
console.log('\n2. Core docs')
const coreDocs = ['quickstart.md', 'architecture.md', 'configuration.md']
for (const f of coreDocs) {
  const p = join(DOCS, f)
  assert(existsSync(p), `${f} exists`)
  if (existsSync(p)) {
    assert(hasFrontmatter(p), `${f} has frontmatter`)
  }
}

// 3. Architecture has Mermaid
assert(hasMermaid(join(DOCS, 'architecture.md')), 'architecture.md has Mermaid diagram')

// 4. Configuration has env vars
assert(countEnvVars(join(DOCS, 'configuration.md')) >= 10, 'configuration.md documents >= 10 env vars')

// 5. Deployment docs
console.log('\n3. Deployment docs')
const deployDocs = ['docker.md', 'kubernetes.md', 'bare-metal.md']
for (const f of deployDocs) {
  const p = join(DOCS, 'deployment', f)
  assert(existsSync(p), `deployment/${f} exists`)
  if (existsSync(p)) {
    assert(hasFrontmatter(p), `deployment/${f} has frontmatter`)
  }
}

// 6. Auth docs
console.log('\n4. Auth docs')
const authDocs = ['workos.md', 'saml-oidc.md', 'keycloak.md']
for (const f of authDocs) {
  const p = join(DOCS, 'auth', f)
  assert(existsSync(p), `auth/${f} exists`)
  if (existsSync(p)) {
    assert(hasFrontmatter(p), `auth/${f} has frontmatter`)
  }
}

// 7. AI docs
console.log('\n5. AI docs')
const aiDocs = ['vercel-gateway.md', 'ollama.md', 'vllm.md']
for (const f of aiDocs) {
  const p = join(DOCS, 'ai', f)
  assert(existsSync(p), `ai/${f} exists`)
}

// 8. Storage docs
console.log('\n6. Storage docs')
const storageDocs = ['r2.md', 'minio.md', 's3.md']
for (const f of storageDocs) {
  const p = join(DOCS, 'storage', f)
  assert(existsSync(p), `storage/${f} exists`)
}

// 9. Enterprise docs
console.log('\n7. Enterprise docs')
const enterpriseDocs = ['admin-dashboard.md', 'rbac.md', 'audit-logging.md', 'white-labeling.md']
for (const f of enterpriseDocs) {
  const p = join(DOCS, f)
  assert(existsSync(p), `${f} exists`)
}

// 10. Reference docs
console.log('\n8. Reference docs')
assert(existsSync(join(DOCS, 'api-reference.md')), 'api-reference.md exists')
assert(existsSync(join(DOCS, 'sdk/javascript.md')), 'sdk/javascript.md exists')
assert(existsSync(join(DOCS, 'sdk/python.md')), 'sdk/python.md exists')

// 11. Operations
console.log('\n9. Operations docs')
assert(existsSync(join(DOCS, 'troubleshooting.md')), 'troubleshooting.md exists')

// 12. Migration
console.log('\n10. Migration docs')
assert(existsSync(join(DOCS, 'migration/convex-to-postgres.md')), 'migration/convex-to-postgres.md exists')

// 13. Phase 7 roadmap
console.log('\n11. Phase 7 roadmap')
assert(existsSync(join(DOCS, 'phase7-roadmap.md')), 'phase7-roadmap.md exists')

// 14. npm scripts
console.log('\n12. npm scripts')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
assert(pkg.scripts['docs:dev'] !== undefined, 'docs:dev script exists')
assert(pkg.scripts['docs:build'] !== undefined, 'docs:build script exists')

// 15. Dockerfile reference
console.log('\n13. Dockerfile')
assert(existsSync(join(ROOT, 'docker/Dockerfile.enterprise')), 'docker/Dockerfile.enterprise exists')

// 16. Quickstart references Docker Compose
if (existsSync(join(DOCS, 'quickstart.md'))) {
  const qs = readFileSync(join(DOCS, 'quickstart.md'), 'utf-8')
  assert(qs.includes('docker compose'), 'quickstart references docker compose')
  assert(qs.includes('.env.local'), 'quickstart references .env.local')
}

// 17. Self-hosted-first tone check
const arch = readFileSync(join(DOCS, 'architecture.md'), 'utf-8')
assert(arch.includes('Self-Hosted') || arch.includes('self-hosted'), 'architecture.md mentions self-hosted')

console.log('\n' + (allPassed ? 'All Phase 6 checks passed.' : 'Some checks failed.'))
process.exit(allPassed ? 0 : 1)
