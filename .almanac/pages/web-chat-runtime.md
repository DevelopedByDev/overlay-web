---
title: Web Chat Runtime
topics: [systems, frontend, ai, flows]
files:
  - src/app/api/app/conversations/route.ts
  - src/components/app/ChatInterface.tsx
  - src/components/app/chat-interface/chatLogic.ts
  - src/app/api/app/conversations/act/route.ts
---

# Web Chat Runtime

The web chat surface keeps a client-side runtime per conversation in `src/components/app/ChatInterface.tsx` and sends turns to [[canonical-app-api]] through `src/app/api/app/conversations/act/route.ts`. The runtime stores local UI state, optimistic messages, generation results, pending documents, and AI SDK `Chat` instances outside the persisted conversation transcript.

## Where we use it

- `src/components/app/ChatInterface.tsx` - owns conversation runtimes, active chat refs, `loadChat` invalidation, optimistic send state, and the ask/image/video send paths.
- `src/components/app/chat-interface/chatLogic.ts` - contains shared helpers used by the chat UI.
- `src/app/api/app/conversations/route.ts` - creates conversations that receive a fresh client runtime before the first send.
- `src/app/api/app/conversations/act/route.ts` - receives chat turns and persists server-side conversation state for the same conversation ids.

## Runtime gotcha

Sends must resolve the target conversation from `activeChatIdRef.current` before falling back to `activeChatId` React state. Chat switching can update the ref before React state catches up; using only `activeChatId` allowed a prod-timing send to target the previous conversation runtime, so the previous response appeared to start loading until a reload rehydrated the current server transcript.

Creating a new chat must also increment `loadChatRequestRef.current` before the new runtime becomes active. An older in-flight `loadChat` can otherwise repaint the view after the send path creates and selects a fresh conversation.

## Future Capture

### Persistence contract

<!-- stub: capture which client runtime fields are persisted by the API and which fields are view-only. -->
