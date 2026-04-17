// Provider API keys are no longer exposed through a Convex action.
//
// Historically this file exported `getAPIKey`, a public action gated only by a
// shared `PROVIDER_KEYS_SECRET`. Because Convex actions are callable from the
// browser, a single leak of that secret would exfiltrate every provider key in
// one request. That endpoint has been removed.
//
// Server-side code that needs a provider key should read it directly from
// `process.env` inside a Next.js route handler, or call
// `getServerProviderKey(...)` from `src/lib/server-provider-keys`, which keeps
// the key server-only.
