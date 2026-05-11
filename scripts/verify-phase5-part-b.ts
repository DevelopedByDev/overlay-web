// @enterprise-future — not wired to production
// Phase 5 Part B verification: overlay-core business logic extraction

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const CORE_DIR = join(ROOT, 'packages/overlay-core')

let allPassed = true

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`)
  } else {
    console.error(`  [FAIL] ${message}`)
    allPassed = false
  }
}

console.log('\n=== Overlay Phase 5 Part B Verification ===\n')

// 1. Package build artifacts
console.log('1. Overlay Core package build artifacts')
assert(existsSync(join(CORE_DIR, 'dist/index.mjs')), 'dist/index.mjs (ESM) exists')
assert(existsSync(join(CORE_DIR, 'dist/index.js')), 'dist/index.js (CJS) exists')
assert(existsSync(join(CORE_DIR, 'dist/index.d.ts')), 'dist/index.d.ts exists')

// 2. Auth domain
console.log('\n2. Auth domain files')
const authFiles = [
  'src/auth/native-validation.ts',
  'src/auth/cookie-signature.ts',
  'src/auth/refresh-rate-limit.ts',
]
for (const f of authFiles) {
  assert(existsSync(join(CORE_DIR, f)), `${f} exists`)
}

// 3. Billing domain
console.log('\n3. Billing domain files')
const billingFiles = ['src/billing/pricing.ts', 'src/billing/runtime.ts']
for (const f of billingFiles) {
  assert(existsSync(join(CORE_DIR, f)), `${f} exists`)
}

// 4. AI domain
console.log('\n4. AI domain files')
const aiFiles = ['src/ai/model-types.ts', 'src/ai/model-data.ts', 'src/ai/model-pricing.ts']
for (const f of aiFiles) {
  assert(existsSync(join(CORE_DIR, f)), `${f} exists`)
}

// 5. Server/Security domain
console.log('\n5. Server/Security domain files')
const serverFiles = ['src/server/ssrf-guard.ts', 'src/server/security-events.ts']
for (const f of serverFiles) {
  assert(existsSync(join(CORE_DIR, f)), `${f} exists`)
}

// 6. No Next.js or Convex imports in extracted files
console.log('\n6. No framework imports in extracted files')
const extractedFiles = [
  ...authFiles,
  ...billingFiles,
  ...aiFiles,
  ...serverFiles,
].map((f) => join(CORE_DIR, f))

for (const f of extractedFiles) {
  const content = execSync(`cat ${f}`, { cwd: ROOT, encoding: 'utf-8' })
  const hasNextImport = content.includes("from 'next'") || content.includes('from "next"')
  const hasConvexImport = content.includes("from 'convex'") || content.includes('from "convex"')
  assert(!hasNextImport, `${f.split('/').slice(-3).join('/')} has no Next.js imports`)
  assert(!hasConvexImport, `${f.split('/').slice(-3).join('/')} has no Convex imports`)
}

// 7. Exported from index.ts
console.log('\n7. Exports from index.ts')
const indexContent = execSync('cat packages/overlay-core/src/index.ts', { cwd: ROOT, encoding: 'utf-8' })
assert(indexContent.includes("from './auth/native-validation'"), 'index exports native-validation')
assert(indexContent.includes("from './auth/cookie-signature'"), 'index exports cookie-signature')
assert(indexContent.includes("from './auth/refresh-rate-limit'"), 'index exports refresh-rate-limit')
assert(indexContent.includes("from './billing/pricing'"), 'index exports billing/pricing')
assert(indexContent.includes("from './billing/runtime'"), 'index exports billing/runtime')
assert(indexContent.includes("from './ai/model-types'"), 'index exports ai/model-types')
assert(indexContent.includes("from './ai/model-data'"), 'index exports ai/model-data')
assert(indexContent.includes("from './ai/model-pricing'"), 'index exports ai/model-pricing')
assert(indexContent.includes("from './server/ssrf-guard'"), 'index exports server/ssrf-guard')
assert(indexContent.includes("from './server/security-events'"), 'index exports server/security-events')

// 8. TypeScript compilation
console.log('\n8. TypeScript compilation')
try {
  execSync('npx tsc --noEmit', { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] })
  assert(true, 'tsc --noEmit passes')
} catch {
  assert(false, 'tsc --noEmit passes')
}

// 9. overlay-core typecheck
console.log('\n9. Overlay Core typecheck')
try {
  execSync('cd packages/overlay-core && npx tsc --noEmit', { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] })
  assert(true, 'overlay-core tsc --noEmit passes')
} catch {
  assert(false, 'overlay-core tsc --noEmit passes')
}

console.log('\n' + (allPassed ? 'All Part B checks passed.' : 'Some checks failed.'))
process.exit(allPassed ? 0 : 1)
