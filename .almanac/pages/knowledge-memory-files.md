---
title: Knowledge, Memory, and Files
topics: [systems, data, storage, backend, ai]
files:
  - convex/files.ts
  - convex/knowledge.ts
  - convex/memories.ts
  - src/lib/ask-knowledge-context.ts
  - src/app/api/app/files/route.ts
  - src/app/api/app/knowledge/search/route.ts
  - src/app/api/app/memory/route.ts
---

# Knowledge, Memory, and Files

Overlay stores user files, memories, project context, and knowledge-search metadata in Convex while using the app API as the client-facing contract. Conversation routes use knowledge and memory helpers to inject relevant context into AI turns rather than making clients assemble retrieval context themselves.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `convex/files.ts` - stores file metadata and logical file tree state.
- `convex/knowledge.ts` - supports knowledge indexing and search behavior.
- `convex/memories.ts` - stores durable user memories and memory segments.
- `src/lib/ask-knowledge-context.ts` - builds retrieval bundles for ask and act turns.
- `src/app/api/app/files/route.ts` - exposes file operations through the canonical app API.
- `src/app/api/app/knowledge/search/route.ts` - exposes knowledge search.
- `src/app/api/app/memory/route.ts` - exposes memory operations.

## Future Capture

### Invariants

<!-- stub: capture retrieval rules, memory scoping, and persistence expectations. -->

### Known gotchas

<!-- stub: capture indexing, reindexing, and client sync failure modes. -->
