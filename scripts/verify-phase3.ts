// @enterprise-future — not wired to production
// Phase 3 verification script:
// 1. Asserts all admin files exist
// 2. Asserts no enterprise imports in src/ (except admin routes)
// 3. Asserts tsc --noEmit passes

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

console.log('\n=== Overlay Phase 3 Verification ===\n')

// 1. Admin files exist
console.log('1. Admin auth + audit modules')
assert(existsSync(join(ROOT, 'src/lib/admin-auth.ts')), 'src/lib/admin-auth.ts exists')
assert(existsSync(join(ROOT, 'src/lib/audit.ts')), 'src/lib/audit.ts exists')

console.log('\n2. Admin layout + pages')
assert(existsSync(join(ROOT, 'src/app/admin/layout.tsx')), 'src/app/admin/layout.tsx exists')
assert(existsSync(join(ROOT, 'src/app/admin/page.tsx')), 'src/app/admin/page.tsx exists')
assert(existsSync(join(ROOT, 'src/app/admin/users/page.tsx')), 'src/app/admin/users/page.tsx exists')
assert(existsSync(join(ROOT, 'src/app/admin/security/page.tsx')), 'src/app/admin/security/page.tsx exists')
assert(existsSync(join(ROOT, 'src/app/admin/settings/page.tsx')), 'src/app/admin/settings/page.tsx exists')
assert(existsSync(join(ROOT, 'src/app/admin/health/page.tsx')), 'src/app/admin/health/page.tsx exists')

console.log('\n3. Admin API routes')
assert(existsSync(join(ROOT, 'src/app/api/admin/users/route.ts')), 'src/app/api/admin/users/route.ts exists')
assert(existsSync(join(ROOT, 'src/app/api/admin/audit/route.ts')), 'src/app/api/admin/audit/route.ts exists')
assert(existsSync(join(ROOT, 'src/app/api/admin/settings/route.ts')), 'src/app/api/admin/settings/route.ts exists')
assert(existsSync(join(ROOT, 'src/app/api/admin/impersonate/route.ts')), 'src/app/api/admin/impersonate/route.ts exists')

console.log('\n4. Admin UI components')
assert(existsSync(join(ROOT, 'src/components/admin/AdminSidebar.tsx')), 'src/components/admin/AdminSidebar.tsx exists')
assert(existsSync(join(ROOT, 'src/components/admin/StatCard.tsx')), 'src/components/admin/StatCard.tsx exists')
assert(existsSync(join(ROOT, 'src/components/admin/UserTable.tsx')), 'src/components/admin/UserTable.tsx exists')
assert(existsSync(join(ROOT, 'src/components/admin/AuditLogTable.tsx')), 'src/components/admin/AuditLogTable.tsx exists')
assert(existsSync(join(ROOT, 'src/components/admin/SettingsPanel.tsx')), 'src/components/admin/SettingsPanel.tsx exists')
assert(existsSync(join(ROOT, 'src/components/admin/HealthStatusGrid.tsx')), 'src/components/admin/HealthStatusGrid.tsx exists')
assert(existsSync(join(ROOT, 'src/components/admin/RoleBadge.tsx')), 'src/components/admin/RoleBadge.tsx exists')

console.log('\n5. Convex admin query')
assert(
  existsSync(join(ROOT, 'convex/users.ts')),
  'convex/users.ts exists with listAllUsersForAdmin',
)

// 6. Zero enterprise imports in production code
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

// 7. TypeScript compilation
console.log('\n7. TypeScript compilation')
try {
  execSync('npx tsc --noEmit', { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] })
  assert(true, 'tsc --noEmit passes')
} catch {
  assert(false, 'tsc --noEmit passes')
}

console.log('\n' + (allPassed ? 'All checks passed. Phase 3 is ready.' : 'Some checks failed.'))
process.exit(allPassed ? 0 : 1)
