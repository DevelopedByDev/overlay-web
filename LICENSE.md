# Overlay License

Copyright (c) 2026 LayerNorm Inc. (contact: divyansh@layernorm.co)

Overlay uses a split license model. The default license for this repository is **AGPL-3.0-or-later**, with explicit **Apache-2.0** exceptions for reusable ecosystem packages.

## Core Product: AGPL-3.0-or-later

Unless a file, package manifest, or written commercial agreement says otherwise, the Overlay core product is licensed under `AGPL-3.0-or-later`.

This includes:

- The main web app and server code under `src/`.
- Convex schema, queries, mutations, actions, and HTTP functions under `convex/`.
- Product workers under `workers/`.
- First-party desktop, mobile, and Chrome app code under `overlay-desktop/`, `overlay-mobile/`, and `overlay-chrome/`.
- Product documentation and configuration examples unless otherwise noted.

Official license text: https://www.gnu.org/licenses/agpl-3.0.en.html

## Ecosystem Packages: Apache-2.0

Reusable packages intended for integrations, SDKs, contracts, protocol glue, and shared UI are licensed under `Apache-2.0`.

This currently includes:

- `packages/overlay-api-client`
- `packages/overlay-app-core`
- `packages/overlay-auth-contracts`
- `packages/overlay-storage-contracts`
- `packages/overlay-tools-core`
- `packages/overlay-agent-runtime`
- `packages/overlay-billing`
- `packages/overlay-chat-core`
- `packages/overlay-chat-react`
- `packages/overlay-extension-sdk`
- `packages/overlay-llm-gateway`
- `packages/overlay-modules-react`
- `packages/overlay-ui`
- `overlay-chrome/packages/overlay-extension-contracts`

For published packages, the package's own `package.json` `license` field is authoritative for that package.

Official license text: https://www.apache.org/licenses/LICENSE-2.0.html

## Commercial License

Commercial licenses, AGPL exceptions, enterprise support, managed private deployments, and proprietary-product terms are available separately from LayerNorm Inc.

Contact: divyansh@layernorm.co

## Trademarks

The AGPL and Apache licenses do not grant trademark rights. The Overlay name, logos, domains, and brand assets are governed by `TRADEMARKS.md`.

## Third-Party Dependencies

Third-party dependencies keep their own licenses. Run `npm run license:check` before publishing a release artifact or enterprise distribution.
