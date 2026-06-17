import assert from 'node:assert/strict'
import test from 'node:test'
import { buildImageGenerationRequestBody } from './chatMediaGeneration'

test('omits null image references from image generation requests', () => {
  assert.deepEqual(
    buildImageGenerationRequestBody({
      chatId: 'conv_1',
      turnId: 'turn_1',
      modelId: 'xai/grok-imagine-image',
      promptForModel: 'image of neural net',
      imageUrl: null,
    }),
    {
      conversationId: 'conv_1',
      turnId: 'turn_1',
      modelId: 'xai/grok-imagine-image',
      prompt: 'image of neural net',
    },
  )
})

test('keeps concrete reference images for image edits', () => {
  assert.deepEqual(
    buildImageGenerationRequestBody({
      chatId: 'conv_1',
      turnId: 'turn_1',
      modelId: 'xai/grok-imagine-image',
      promptForModel: 'make this cinematic',
      imageUrl: 'data:image/png;base64,abc',
    }),
    {
      conversationId: 'conv_1',
      turnId: 'turn_1',
      modelId: 'xai/grok-imagine-image',
      prompt: 'make this cinematic',
      imageUrl: 'data:image/png;base64,abc',
    },
  )
})
