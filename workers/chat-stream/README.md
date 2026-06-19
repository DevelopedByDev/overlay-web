# Overlay Chat Stream Worker

Cloudflare Durable Object replay log for persistent chat streaming.

## What the relay does

The Worker is not an LLM provider and does not choose or call models itself. In
the default web flow, the browser calls `/api/v1/conversations/act` on the Next
app directly for low time-to-first-token. Next tees the same UI-message stream
to this Worker in the background. For a turn it:

1. Accepts authenticated `/ingest` streams from the Next app.
2. Stores streamed SSE frames in a per-turn Durable Object.
3. Replays those frames when a browser reconnects or reloads.
4. Preserves partial output so stopping or disconnecting does not lose the turn.

The legacy `/start` endpoint still supports routing `/act` through the Durable
Object for compatibility and debugging, but normal persistent turns should use
the passive mirror path.

The Next app still performs entitlement checks, model routing, provider calls,
tool execution, usage accounting, and durable conversation persistence.

## Why direct streaming is the default

Putting Cloudflare before `/act` adds origin validation, stream auth, Durable
Object routing, and an upstream `/act` fetch before the browser can receive the
first token. Direct streaming removes that setup from the critical path. The
Next app derives the persisted conversation id before it mirrors the stream, so
even first turns can be written to the replay log after `/act` creates the
conversation.

## Debug correlation

The browser generates an `x-request-id` for every chat request. Search that ID
across browser console lines, Worker logs, and Vercel runtime logs. Relay errors
also include:

- `phase`: validation, authorization, routing, or upstream.
- `fallbackSafe`: whether the browser can safely retry `/act` directly.
- `status` / `upstreamStatus`: relay and Next response status.
- `modelId`, `turnId`, and `variantIndex`: non-prompt routing context.

Required Worker secrets and vars:

- `CHAT_STREAM_RELAY_SECRET`: shared with the Next app; distinct from Convex/internal API secrets.
- `OVERLAY_NEXT_ORIGIN`: origin for the deployed Next app, for example `https://overlay.vercel.app`.
- `OVERLAY_APP_ORIGIN`: browser-facing app origin that owns `/api/chat-stream/*`.

Required Next env:

- `CHAT_STREAM_RELAY_SECRET`: same value as the Worker secret.
- `NEXT_PUBLIC_CHAT_STREAM_RELAY_URL`: same-origin relay base, normally `/api/chat-stream/v1/streams`.

Production routing should mount this Worker at `/api/chat-stream/*` on the same origin as the app so the browser sends the existing `overlay_session` httpOnly cookie.

For local replay testing, run the Next app with
`NEXT_PUBLIC_CHAT_STREAM_RELAY_LOCAL=true` and run `npm run chat-stream:dev`.
The development Next config proxies `/api/chat-stream/*` to
`CHAT_STREAM_RELAY_DEV_ORIGIN` (default `http://127.0.0.1:8787`), preserving the
localhost session cookie.
