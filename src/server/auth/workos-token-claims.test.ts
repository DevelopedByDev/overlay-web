import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACCESS_TOKEN_REFRESH_LEEWAY_MS,
  decodeJwtExpMs,
  shouldRefreshAccessToken,
  toTokenClaims,
  toUserProfile,
} from './workos-token-claims'

function unsignedJwt(payload: Record<string, unknown>): string {
  return [
    Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'signature',
  ].join('.')
}

test('decodeJwtExpMs and shouldRefreshAccessToken preserve refresh policy', () => {
  const now = 1_700_000_000_000
  const fresh = unsignedJwt({ exp: Math.floor((now + ACCESS_TOKEN_REFRESH_LEEWAY_MS + 10_000) / 1000) })
  const stale = unsignedJwt({ exp: Math.floor((now + ACCESS_TOKEN_REFRESH_LEEWAY_MS - 10_000) / 1000) })

  assert.equal(decodeJwtExpMs(fresh), 1_700_000_130_000)
  assert.equal(shouldRefreshAccessToken(fresh, now), false)
  assert.equal(shouldRefreshAccessToken(stale, now), true)
  assert.equal(shouldRefreshAccessToken('opaque-token', now), true)
})

test('token claim and profile mapping preserve required claim handling', () => {
  assert.equal(toTokenClaims({ iss: 'issuer', exp: 123 }), null)

  const claims = toTokenClaims({
    iss: 'issuer',
    sub: 'user_1',
    exp: 123,
    aud: ['aud1'],
    iat: 100,
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    profilePictureUrl: 'https://example.com/avatar.png',
    emailVerified: true,
  })

  assert.deepEqual(claims, {
    iss: 'issuer',
    sub: 'user_1',
    exp: 123,
    aud: ['aud1'],
    iat: 100,
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    profilePictureUrl: 'https://example.com/avatar.png',
    emailVerified: true,
  })
  assert.deepEqual(claims ? toUserProfile(claims) : null, {
    id: 'user_1',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    profilePictureUrl: 'https://example.com/avatar.png',
    emailVerified: true,
  })
})
