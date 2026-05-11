// @enterprise-future — not wired to production
// Phase 5 Part A verification: middleware + thin route refactor

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()

let allPassed = true

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`)
  } else {
    console.error(`  [FAIL] ${message}`)
    allPassed = false
  }
}

console.log('\n=== Overlay Phase 5 Part A Verification ===\n')

// 1. Middleware file exists with expected exports
console.log('1. Middleware module')
const middlewarePath = join(ROOT, 'src/app/api/lib/middleware.ts')
assert(existsSync(middlewarePath), 'src/app/api/lib/middleware.ts exists')

const middlewareContent = execSync('cat src/app/api/lib/middleware.ts', { cwd: ROOT, encoding: 'utf-8' })
assert(middlewareContent.includes('export function createHandler'), 'createHandler exported')
assert(middlewareContent.includes('export const withAuth'), 'withAuth exported')
assert(middlewareContent.includes('export const withRequireAuth'), 'withRequireAuth exported')
assert(middlewareContent.includes('export const withAdmin'), 'withAdmin exported')
assert(middlewareContent.includes('export function withRateLimit'), 'withRateLimit exported')
assert(middlewareContent.includes('export const withAudit'), 'withAudit exported')
assert(middlewareContent.includes('export function auditLog'), 'auditLog exported')
assert(middlewareContent.includes('export function getClientIp'), 'getClientIp exported')

// 2. Admin routes use createHandler
console.log('\n2. Admin routes use middleware')
const adminRoutes = [
  'src/app/api/admin/users/route.ts',
  'src/app/api/admin/audit/route.ts',
  'src/app/api/admin/settings/route.ts',
  'src/app/api/admin/impersonate/route.ts',
]
for (const route of adminRoutes) {
  const content = execSync(`cat ${route}`, { cwd: ROOT, encoding: 'utf-8' })
  assert(
    content.includes('createHandler'),
    `${route} uses createHandler`,
  )
  assert(
    content.includes('withRequireAuth') && content.includes('withAdmin'),
    `${route} uses withRequireAuth + withAdmin`,
  )
  // Count lines
  const lines = content.split('\n').length
  assert(lines <= 70, `${route} is ${lines} lines (under 70)`)
}

// 3. App routes use createHandler
console.log('\n3. App routes use middleware')
const appRoutes = [
  'src/app/api/app/bootstrap/route.ts',
  'src/app/api/health/route.ts',
  'src/app/api/health/dependencies/route.ts',
]
for (const route of appRoutes) {
  const content = execSync(`cat ${route}`, { cwd: ROOT, encoding: 'utf-8' })
  assert(content.includes('createHandler'), `${route} uses createHandler`)
}

// 4. No direct requireAdmin() calls remaining in admin routes (must go through middleware)
console.log('\n4. No direct auth checks in admin route bodies')
for (const route of adminRoutes) {
  const content = execSync(`cat ${route}`, { cwd: ROOT, encoding: 'utf-8' })
  const hasDirectCheck = content.includes('requireAdmin()') && !content.includes("from '@/lib/admin-auth'")
  assert(!hasDirectCheck, `${route} has no inline requireAdmin() call`)
}

// 5. TypeScript compilation
console.log('\n5. TypeScript compilation')
try {
  execSync('npx tsc --noEmit', { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] })
  assert(true, 'tsc --noEmit passes')
} catch {
  assert(false, 'tsc --noEmit passes')
}

console.log('\n' + (allPassed ? 'All Part A checks passed.' : 'Some checks failed.'))
process.exit(allPassed ? 0 : 1)
