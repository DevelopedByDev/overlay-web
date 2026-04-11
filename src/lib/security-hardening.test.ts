import test from 'node:test'
import assert from 'node:assert/strict'

test('service auth tokens are path, method, user, and time bound', async () => {
  process.env.INTERNAL_API_SECRET = 'test-internal-secret'

  const serviceAuth = await import(new URL('./service-auth.ts', import.meta.url).href)

  const token = await serviceAuth.buildServiceAuthToken({
    userId: 'user_123',
    method: 'POST',
    path: '/api/app/notes',
    ttlMs: 5_000,
  })

  assert.deepEqual(
    await serviceAuth.verifyServiceAuthToken(token, {
      userId: 'user_123',
      method: 'POST',
      path: '/api/app/notes',
    }),
    { userId: 'user_123' },
  )

  assert.equal(
    await serviceAuth.verifyServiceAuthToken(token, {
      userId: 'user_123',
      method: 'GET',
      path: '/api/app/notes',
    }),
    null,
  )

  assert.equal(
    await serviceAuth.verifyServiceAuthToken(token, {
      userId: 'user_456',
      method: 'POST',
      path: '/api/app/notes',
    }),
    null,
  )

  assert.equal(
    await serviceAuth.verifyServiceAuthToken(token, {
      userId: 'user_123',
      method: 'POST',
      path: '/api/app/files',
    }),
    null,
  )
})

test('storage key ownership checks enforce user-scoped prefixes', async () => {
  const storageKeys = await import(new URL('./storage-keys.ts', import.meta.url).href)

  const ownedFileKey = storageKeys.keyForFile('user_123', 'file_1', 'report.pdf')
  const ownedOutputKey = storageKeys.keyForOutput('user_123', 'output_1', 'video.mp4')

  assert.equal(storageKeys.isOwnedFileR2Key('user_123', ownedFileKey), true)
  assert.equal(storageKeys.isOwnedFileR2Key('user_999', ownedFileKey), false)
  assert.equal(storageKeys.isOwnedOutputR2Key('user_123', ownedOutputKey), true)
  assert.equal(storageKeys.isOwnedOutputR2Key('user_999', ownedOutputKey), false)

  assert.throws(() => storageKeys.assertOwnedFileR2Key('user_999', ownedFileKey))
  assert.throws(() => storageKeys.assertOwnedOutputR2Key('user_999', ownedOutputKey))
})
