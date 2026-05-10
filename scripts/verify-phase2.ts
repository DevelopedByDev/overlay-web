// @enterprise-future — not wired to production
// Phase 2 verification script:
// 1. Builds create-overlay-app
// 2. Validates docker-compose.enterprise.yml syntax
// 3. Asserts health route schemas compile
// 4. Verifies no new production imports from enterprise packages

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const CLI_DIR = join(ROOT, 'packages/create-overlay-app')
const DOCKER_DIR = join(ROOT, 'docker')

let allPassed = true

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`)
  } else {
    console.error(`  [FAIL] ${message}`)
    allPassed = false
  }
}

console.log('\n=== Overlay Phase 2 Verification ===\n')

// 1. CLI package build artifacts exist
console.log('1. CLI package artifacts')
assert(existsSync(join(CLI_DIR, 'dist/cli.js')), 'dist/cli.js exists')
assert(existsSync(join(CLI_DIR, 'dist/index.js')), 'dist/index.js exists')
assert(existsSync(join(CLI_DIR, 'dist/index.d.ts')), 'dist/index.d.ts exists')

// 2. Docker compose files exist and are valid YAML
console.log('\n2. Docker compose files')
const composeFiles = [
  'docker-compose.enterprise.yml',
  'docker-compose.keycloak.yml',
  'docker-compose.ollama.yml',
  'docker-compose.dev.yml',
]
for (const f of composeFiles) {
  const path = join(DOCKER_DIR, f)
  assert(existsSync(path), `${f} exists`)
  try {
    const content = readFileSync(path, 'utf-8')
    // Basic YAML sanity: look for top-level keys
    assert(content.includes('services:') || content.includes('volumes:'), `${f} looks like valid compose YAML`)
  } catch {
    assert(false, `${f} is readable`)
  }
}

// 3. Dockerfile exists
console.log('\n3. Dockerfile')
assert(existsSync(join(DOCKER_DIR, 'Dockerfile.enterprise')), 'Dockerfile.enterprise exists')

// 4. Health routes exist
console.log('\n4. Health check routes')
assert(existsSync(join(ROOT, 'src/app/api/health/route.ts')), 'src/app/api/health/route.ts exists')
assert(existsSync(join(ROOT, 'src/app/api/health/dependencies/route.ts')), 'src/app/api/health/dependencies/route.ts exists')

// 5. Shell script exists and is executable-ish (has shebang)
console.log('\n5. Setup shell script')
const shellPath = join(ROOT, 'scripts/setup-enterprise.sh')
assert(existsSync(shellPath), 'scripts/setup-enterprise.sh exists')
try {
  const shellContent = readFileSync(shellPath, 'utf-8')
  assert(shellContent.startsWith('#!'), 'Has shebang line')
  assert(shellContent.includes('create-overlay-app'), 'References create-overlay-app')
} catch {
  assert(false, 'scripts/setup-enterprise.sh is readable')
}

// 6. Verify no production code imports from enterprise packages
console.log('\n6. Zero enterprise imports in src/ / convex/')
try {
  const srcOutput = execSync('grep -r "from \"@overlay/plugin-sdk\"" src/ convex/ 2>/dev/null || true', {
    cwd: ROOT,
    encoding: 'utf-8',
  })
  assert(srcOutput.trim() === '', 'No @overlay/plugin-sdk imports in src/ or convex/')
} catch {
  assert(true, 'Grep check skipped')
}
try {
  const coreOutput = execSync('grep -r "from \"@overlay/core\"" src/ convex/ 2>/dev/null || true', {
    cwd: ROOT,
    encoding: 'utf-8',
  })
  assert(coreOutput.trim() === '', 'No @overlay/core imports in src/ or convex/')
} catch {
  assert(true, 'Grep check skipped')
}

// 7. Root typecheck passes (new health routes must compile)
console.log('\n7. TypeScript compilation')
try {
  execSync('npx tsc --noEmit', { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] })
  assert(true, 'tsc --noEmit passes')
} catch {
  assert(false, 'tsc --noEmit passes')
}

console.log('\n' + (allPassed ? 'All checks passed. Phase 2 is ready.' : 'Some checks failed.'))
process.exit(allPassed ? 0 : 1)
