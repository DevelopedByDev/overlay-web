import test from 'node:test'
import assert from 'node:assert/strict'
// @ts-expect-error Node's strip-types test runner loads the adjacent TS module directly.
import { redactUrlForTelemetry, safeHttpUrl, sameOriginPathUrl } from './safe-url.ts'

test('safeHttpUrl only allows http and https URLs', () => {
  assert.equal(safeHttpUrl('https://example.com/a'), 'https://example.com/a')
  assert.equal(safeHttpUrl('http://example.com/a'), 'http://example.com/a')
  assert.equal(safeHttpUrl('javascript:alert(1)'), null)
  assert.equal(safeHttpUrl('data:text/html,<script></script>'), null)
  assert.equal(safeHttpUrl('/relative/path'), null)
})

test('redactUrlForTelemetry removes sensitive query values and fragments', () => {
  const redacted = redactUrlForTelemetry('https://getoverlay.io/auth/callback?code=abc&state=def&ok=1#frag')
  assert.equal(redacted, 'https://getoverlay.io/auth/callback?code=%5Bredacted%5D&state=%5Bredacted%5D&ok=1')
})

test('sameOriginPathUrl rejects network-path and external URLs', () => {
  assert.equal(
    sameOriginPathUrl('https://getoverlay.io', '/account?x=1'),
    'https://getoverlay.io/account?x=1',
  )
  assert.equal(
    sameOriginPathUrl('https://getoverlay.io', '//evil.example/phish'),
    'https://getoverlay.io/account',
  )
  assert.equal(
    sameOriginPathUrl('https://getoverlay.io', 'https://evil.example/phish'),
    'https://getoverlay.io/account',
  )
})
