import test from 'node:test'
import assert from 'node:assert/strict'

test('service auth tokens are path, method, user, time, and replay bound', async () => {
  process.env.INTERNAL_API_SECRET = 'test-internal-secret'
  process.env.INTERNAL_SERVICE_AUTH_SECRET = 'test-service-auth-secret'

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

  // Allow the same token to be verified twice for the common middleware + route hop.
  assert.deepEqual(
    await serviceAuth.verifyServiceAuthToken(token, {
      userId: 'user_123',
      method: 'POST',
      path: '/api/app/notes',
    }),
    { userId: 'user_123' },
  )

  // Reject further reuse to narrow replay opportunities.
  assert.equal(
    await serviceAuth.verifyServiceAuthToken(token, {
      userId: 'user_123',
      method: 'POST',
      path: '/api/app/notes',
    }),
    null,
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

test('service auth can separate middleware verification from route replay consumption', async () => {
  process.env.INTERNAL_API_SECRET = 'test-internal-secret'
  process.env.INTERNAL_SERVICE_AUTH_SECRET = 'test-service-auth-secret'

  const serviceAuth = await import(new URL('./service-auth.ts', import.meta.url).href)
  const token = await serviceAuth.buildServiceAuthToken({
    userId: 'user_789',
    method: 'POST',
    path: '/api/app/automations/run',
    ttlMs: 5_000,
  })

  assert.deepEqual(
    await serviceAuth.verifyServiceAuthToken(token, {
      userId: 'user_789',
      method: 'POST',
      path: '/api/app/automations/run',
      consumeReplay: false,
    }),
    { userId: 'user_789' },
  )

  let consumed = false
  assert.deepEqual(
    await serviceAuth.verifyServiceAuthToken(token, {
      userId: 'user_789',
      method: 'POST',
      path: '/api/app/automations/run',
      replayConsumer: () => {
        if (consumed) return false
        consumed = true
        return true
      },
    }),
    { userId: 'user_789' },
  )

  assert.equal(
    await serviceAuth.verifyServiceAuthToken(token, {
      userId: 'user_789',
      method: 'POST',
      path: '/api/app/automations/run',
      replayConsumer: () => false,
    }),
    null,
  )
})

test('media tools are exposed only for explicit media requests', async () => {
  const exposure = await import(new URL('./tools/exposure-policy.ts', import.meta.url).href)

  const ordinaryTurn = exposure.allowedOverlayToolIdsForTurn({
    latestUserText: 'Summarize my notes from yesterday.',
  })
  assert.equal(ordinaryTurn.includes('generate_image'), false)
  assert.equal(ordinaryTurn.includes('generate_video'), false)
  assert.equal(ordinaryTurn.includes('animate_image'), false)

  const imageTurn = exposure.allowedOverlayToolIdsForTurn({
    latestUserText: 'Please create a product thumbnail image for this launch.',
  })
  assert.equal(imageTurn.includes('generate_image'), true)
  assert.equal(imageTurn.includes('generate_video'), false)

  const videoTurn = exposure.allowedOverlayToolIdsForTurn({
    latestUserText: 'Animate this image into a short product video.',
  })
  for (const toolId of [
    'generate_video',
    'animate_image',
    'generate_video_with_reference',
    'apply_motion_control',
    'edit_video',
  ]) {
    assert.equal(videoTurn.includes(toolId), true)
  }
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
