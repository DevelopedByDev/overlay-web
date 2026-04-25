# Todos

- Audit every sensitive `/api/app/*` route and add a test gate proving each route rejects requests with no browser session cookie, no valid mobile bearer token, and no valid service auth token. Do not rely on browser detection headers for auth decisions; require route-level credential validation.
