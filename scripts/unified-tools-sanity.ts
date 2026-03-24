/**
 * Lightweight sanity checks for unified tool policy vs bucket mapping.
 * Run: npx tsx scripts/unified-tools-sanity.ts   (or: node --experimental-strip-types)
 */
import {
  overlayToolIdsForMode,
} from '../src/lib/tools/policy.ts'
import {
  shouldPersistToolInvocation,
  toolCostBucketForId,
} from '../src/lib/tools/tool-buckets.ts'

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

const ask = [...overlayToolIdsForMode('ask')]
const act = [...overlayToolIdsForMode('act')]

for (const id of ask) {
  if (!act.includes(id)) {
    fail(`Ask tool "${id}" must be included in Act allowlist`)
  }
}

for (const id of ask) {
  const b = toolCostBucketForId(id)
  if (b !== 'internal') {
    fail(`Expected ask overlay tool "${id}" to map to internal bucket, got ${b}`)
  }
}

const mustRecord = ['perplexity_search', 'generate_image', 'generate_video', 'COMPOSIO_EXAMPLE_TOOL']
for (const id of mustRecord) {
  const b = toolCostBucketForId(id)
  if (!shouldPersistToolInvocation(b)) {
    fail(`Expected "${id}" (bucket ${b}) to be persisted`)
  }
}

if (shouldPersistToolInvocation(toolCostBucketForId('search_knowledge'))) {
  fail('search_knowledge should not persist to toolInvocations')
}

console.log('unified-tools-sanity: ok', { askCount: ask.length, actCount: act.length })
