---
title: AI Model Routing
topics: [systems, ai, backend]
files:
  - src/lib/models.ts
  - src/lib/ai-gateway.ts
  - src/lib/openrouter-service.ts
  - src/lib/nvidia-nim-openai.ts
  - src/app/api/app/conversations/act/route.ts
  - src/lib/tools/build.ts
---

# AI Model Routing

Overlay keeps the chat, image, and video model catalogs in `src/lib/models.ts` and routes language models through Vercel AI Gateway, OpenRouter, or NVIDIA NIM depending on model metadata. The conversation execution path combines model routing with budget checks, retrieval injection, memory injection, tool orchestration, streaming, and assistant-turn persistence.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `src/lib/models.ts` - defines model IDs, provider metadata, cost, speed, intelligence, free-tier IDs, media models, defaults, and quality ordering.
- `src/lib/ai-gateway.ts` - routes models to AI Gateway or OpenRouter and provides gateway image, video, and provider-tool helpers.
- `src/lib/openrouter-service.ts` - handles OpenRouter-specific API mapping and retry behavior.
- `src/lib/nvidia-nim-openai.ts` - adapts NVIDIA NIM chat models.
- `src/app/api/app/conversations/act/route.ts` - uses the routing layer during streamed agentic conversation turns.
- `src/lib/tools/build.ts` - defines tool surfaces used by conversation execution.

## Configuration

Environment variables visible in `.env.example`: `AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, and `NVIDIA_API_KEY`.

## Future Capture

### Invariants

<!-- stub: capture model catalog ordering, free-tier behavior, and provider-routing rules. -->

### Known gotchas

<!-- stub: capture provider-specific streaming, tool-call, and routed-model issues. -->
