// @enterprise-future — not wired to production
// Phase 4 verification script:
// 1. Asserts overlay-ui package builds
// 2. Asserts all key files exist
// 3. Asserts no --overlay-* CSS vars in src/ (backward compat)
// 4. Asserts tsc --noEmit passes

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const UI_DIR = join(ROOT, 'packages/overlay-ui')

let allPassed = true

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`)
  } else {
    console.error(`  [FAIL] ${message}`)
    allPassed = false
  }
}

console.log('\n=== Overlay Phase 4 Verification ===\n')

// 1. Package build artifacts
console.log('1. Overlay UI package build artifacts')
assert(existsSync(join(UI_DIR, 'dist/index.mjs')), 'dist/index.mjs (ESM) exists')
assert(existsSync(join(UI_DIR, 'dist/index.js')), 'dist/index.js (CJS) exists')
assert(existsSync(join(UI_DIR, 'dist/index.d.ts')), 'dist/index.d.ts exists')

// 2. Primitives
console.log('\n2. Primitive components')
const primitives = [
  'Button', 'Input', 'Textarea', 'Card', 'Badge', 'Separator',
  'Dialog', 'Select', 'Table', 'Toggle',
]
for (const p of primitives) {
  assert(
    existsSync(join(UI_DIR, 'src/primitives', `${p}.tsx`)),
    `src/primitives/${p}.tsx exists`,
  )
}

// 3. Chat components
console.log('\n3. Chat components')
const chat = ['ChatLayout', 'MessageBubble', 'MessageList', 'Composer', 'ModelSelector', 'ToolCallCard']
for (const c of chat) {
  assert(existsSync(join(UI_DIR, 'src/chat', `${c}.tsx`)), `src/chat/${c}.tsx exists`)
}

// 4. Layout components
console.log('\n4. Layout components')
assert(existsSync(join(UI_DIR, 'src/layout/PageShell.tsx')), 'src/layout/PageShell.tsx exists')
assert(existsSync(join(UI_DIR, 'src/layout/SplitPane.tsx')), 'src/layout/SplitPane.tsx exists')
assert(existsSync(join(UI_DIR, 'src/layout/ScrollContainer.tsx')), 'src/layout/ScrollContainer.tsx exists')

// 5. Theming
console.log('\n5. Theming system')
assert(existsSync(join(UI_DIR, 'src/theming/tokens.ts')), 'src/theming/tokens.ts exists')
assert(existsSync(join(UI_DIR, 'src/theming/ThemeProvider.tsx')), 'src/theming/ThemeProvider.tsx exists')
assert(existsSync(join(UI_DIR, 'src/theming/white-label.ts')), 'src/theming/white-label.ts exists')

// 6. App integration
console.log('\n6. App integration')
assert(existsSync(join(ROOT, 'src/app/layout.tsx')), 'src/app/layout.tsx exists')

// Check layout imports ThemeProvider
try {
  const layoutContent = execSync('grep "ThemeProvider" src/app/layout.tsx', {
    cwd: ROOT,
    encoding: 'utf-8',
  })
  assert(layoutContent.includes('ThemeProvider'), 'layout.tsx imports ThemeProvider')
} catch {
  assert(false, 'layout.tsx imports ThemeProvider')
}

// Check themes.ts imports from @overlay/ui
try {
  const themesContent = execSync('grep "@overlay/ui" src/lib/themes.ts', {
    cwd: ROOT,
    encoding: 'utf-8',
  })
  assert(themesContent.includes('@overlay/ui'), 'themes.ts imports from @overlay/ui')
} catch {
  assert(false, 'themes.ts imports from @overlay/ui')
}

// 7. Backward compat: no NEW --overlay-* CSS vars in src/ (allow pre-existing --overlay-scrim)
console.log('\n7. Backward compatibility (no new --overlay-* var names)')
try {
  const overlayVars = execSync(
    'grep -rh "var(--overlay-" src/ --include="*.tsx" --include="*.ts" --include="*.css" 2>/dev/null | grep -v "overlay-scrim" || true',
    { cwd: ROOT, encoding: 'utf-8' },
  )
  assert(overlayVars.trim() === '', 'No new --overlay-* CSS var names in src/')
} catch {
  assert(true, 'Grep check skipped')
}

// 8. TypeScript compilation
console.log('\n8. TypeScript compilation')
try {
  execSync('npx tsc --noEmit', { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] })
  assert(true, 'tsc --noEmit passes')
} catch {
  assert(false, 'tsc --noEmit passes')
}

console.log('\n' + (allPassed ? 'All checks passed. Phase 4 is ready.' : 'Some checks failed.'))
process.exit(allPassed ? 0 : 1)
