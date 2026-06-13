# Overlay Chat Stream Worker

Cloudflare Durable Object relay for persistent chat streaming.

## What the relay does

The relay is not an LLM provider and does not choose or call models itself. For an
existing conversation it:

1. Authorizes the signed-in user against the Next app.
2. Forwards the `/api/v1/conversations/act` request to Next/Vercel.
3. Stores streamed SSE frames in a per-turn Durable Object.
4. Replays those frames when a browser reconnects or reloads.
5. Preserves partial output so stopping or disconnecting does not lose the turn.

The Next app still performs entitlement checks, model routing, provider calls,
tool execution, usage accounting, and durable conversation persistence.

## Why the first turn bypasses the relay

A new chat initially has only a browser-generated `conversationClientId`. The
persisted `conversationId` is created inside `/api/v1/conversations/act`. The
relay requires that persisted ID before it can authorize access and derive the
stable Durable Object key for `(user, conversation, turn, variant)`.

The first turn therefore calls `/act` directly using Convex-delta persistence.
Once `/act` creates the conversation, subsequent turns use the Cloudflare relay
and gain resumable streaming.

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
