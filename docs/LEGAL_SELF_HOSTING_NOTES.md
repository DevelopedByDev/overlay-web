# Legal Self-Hosting Notes

Overlay self-hosting uses the split-license policy described in [`LICENSING.md`](./LICENSING.md):

- Core product code is `AGPL-3.0-or-later`.
- Reusable SDKs, contracts, protocol packages, and shared UI packages are `Apache-2.0`.
- Overlay trademarks are governed separately by [`../TRADEMARKS.md`](../TRADEMARKS.md).

Before shipping an enterprise distribution:

- Run `npm run license:check`.
- Keep `LICENSE.md`, `NOTICE.md`, and relevant package license metadata with the distribution.
- Review `scripts/license-allowlist.json` for dependency-specific obligations that may matter for a bundled Docker image, native desktop app, or managed private deployment.
- Use a separate commercial license if the deployment needs proprietary-product rights or an AGPL exception.

This note is not legal advice.
