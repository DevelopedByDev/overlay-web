import 'server-only'

import assert from 'node:assert/strict'
import test from 'node:test'
import { userFacingOpenRouterError } from './openrouter-service'

test('Gateway tool schema validation errors surface as provider configuration errors', () => {
  const message = userFacingOpenRouterError(
    new Error('tools.10.custom.input_schema.type: Field required'),
  )

  assert.match(message, /AI Gateway rejected one of the configured tool schemas/)
  assert.match(message, /provider configuration issue/)
})
