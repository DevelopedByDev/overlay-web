---
title: "JavaScript SDK"
description: "Patterns for integrating with Overlay from JavaScript/TypeScript."
---

# JavaScript SDK

Overlay does not ship a dedicated JS SDK. Use standard fetch with the patterns below.

## Client Setup

```typescript
const BASE_URL = 'https://overlay.yourcompany.com'

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

## Bootstrap

```typescript
const bootstrap = await api('/app/bootstrap')
console.log(bootstrap.user, bootstrap.entitlements)
```

## Ask (Streaming)

```typescript
const response = await fetch(`${BASE_URL}/api/app/conversations/ask`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationId: 'abc',
    message: 'Hello',
    modelId: 'claude-sonnet-4-6',
  }),
})

const reader = response.body!.getReader()
const decoder = new TextDecoder()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log(decoder.decode(value))
}
```

## Type Definitions

Import shared types from `src/lib/app-contracts.ts`:

```typescript
import type { AppBootstrapResponse, ConversationSummary } from '@overlay/core'
```
