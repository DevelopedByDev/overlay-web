import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const packageRoots = [
  {
    name: '@overlay/modules-react',
    root: new URL('../packages/overlay-modules-react/src', import.meta.url).pathname,
  },
  {
    name: '@overlay/chat-react',
    root: new URL('../packages/overlay-chat-react/src', import.meta.url).pathname,
  },
  {
    name: '@overlay/app-core',
    root: new URL('../packages/overlay-app-core/src', import.meta.url).pathname,
  },
  {
    name: '@overlay/chat-core',
    root: new URL('../packages/overlay-chat-core/src', import.meta.url).pathname,
  },
]
const banned = [
  { pattern: /\bfetch\s*\(/, label: 'direct fetch calls' },
  { pattern: /overlayAppClient/, label: 'overlayAppClient imports or usage' },
  { pattern: /next\/navigation/, label: 'Next router imports' },
  { pattern: /@\/contexts\/AuthContext|useAuth|AuthContext/, label: 'web auth context imports' },
  { pattern: /from ['"][^'"]*convex|import\([^)]*convex|\buseQuery\s*\(/i, label: 'Convex imports or usage' },
  { pattern: /@ai-sdk\/react/, label: 'AI SDK React runtime imports' },
  { pattern: /from ['"]@\//, label: 'web app private imports' },
]

const wrapperBudgets = [
  { path: 'src/components/app/ChatInterface.tsx', maxLines: 500 },
  { path: 'src/components/app/KnowledgeView.tsx', maxLines: 1546, targetMaxLines: 250, pending: true },
  { path: 'src/components/app/NotebookEditor.tsx', maxLines: 1789, targetMaxLines: 350, pending: true },
  { path: 'src/components/app/ProjectsView.tsx', maxLines: 742, targetMaxLines: 250, pending: true },
  { path: 'src/app/account/page.tsx', maxLines: 1114, targetMaxLines: 300, pending: true },
]

function walk(dir) {
  const entries = readdirSync(dir)
  const files = []
  for (const entry of entries) {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      files.push(...walk(path))
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(path)
    }
  }
  return files
}

const failures = []
for (const packageRoot of packageRoots) {
  for (const file of walk(packageRoot.root)) {
    const source = readFileSync(file, 'utf8')
    for (const rule of banned) {
      if (rule.pattern.test(source)) {
        failures.push(`${packageRoot.name}:${file}: ${rule.label}`)
      }
    }
  }
}

for (const budget of wrapperBudgets) {
  const file = new URL(`../${budget.path}`, import.meta.url).pathname
  const source = readFileSync(file, 'utf8')
  const lines = source.replace(/\r?\n$/, '').split(/\r?\n/).length
  if (lines > budget.maxLines) {
    const target = budget.pending ? `; migration target is ${budget.targetMaxLines} lines` : ''
    failures.push(`${budget.path}: ${lines} lines exceeds budget ${budget.maxLines}${target}`)
  }
}

if (failures.length > 0) {
  console.error('Presentational module boundary check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Presentational module boundary check passed.')
