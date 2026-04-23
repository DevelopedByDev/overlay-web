/**
 * Lightweight sanity checks for unified tool policy vs bucket mapping.
 * Run: npx tsx scripts/unified-tools-sanity.ts   (or: node --experimental-strip-types)
 */
import { overlayToolIdSet } from '../src/lib/tools/policy.ts'
import {
  shouldPersistToolInvocation,
  toolCostBucketForId,
} from '../src/lib/tools/tool-buckets.ts'

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

const overlayIds = [...overlayToolIdSet()]

for (const id of overlayIds) {
  const b = toolCostBucketForId(id)
  if (b !== 'internal') {
    fail(`Expected overlay tool "${id}" to map to internal bucket, got ${b}`)
  }
}

const mustRecord = [
  'perplexity_search',
  'parallel_search',
  'generate_image',
  'generate_video',
  'COMPOSIO_EXAMPLE_TOOL',
]
for (const id of mustRecord) {
  const b = toolCostBucketForId(id)
  if (!shouldPersistToolInvocation(b)) {
    fail(`Expected "${id}" (bucket ${b}) to be persisted`)
  }
}

if (shouldPersistToolInvocation(toolCostBucketForId('search_knowledge'))) {
  fail('search_knowledge should not persist to toolInvocations')
}

console.log('unified-tools-sanity: ok', { overlayCount: overlayIds.length })
