# Overlay Chat Stream Worker

Cloudflare Durable Object relay for persistent chat streaming.

Required Worker secrets and vars:

- `CHAT_STREAM_RELAY_SECRET`: shared with the Next app; distinct from Convex/internal API secrets.
- `OVERLAY_NEXT_ORIGIN`: origin for the deployed Next app, for example `https://overlay.vercel.app`.
- `OVERLAY_APP_ORIGIN`: browser-facing app origin that owns `/api/chat-stream/*`.

Required Next env:

- `CHAT_STREAM_RELAY_SECRET`: same value as the Worker secret.
- `NEXT_PUBLIC_CHAT_STREAM_RELAY_URL`: same-origin relay base, normally `/api/chat-stream/v1/streams`.

Production routing should mount this Worker at `/api/chat-stream/*` on the same origin as the app so the browser sends the existing `overlay_session` httpOnly cookie.
