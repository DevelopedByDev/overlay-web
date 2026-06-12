import assert from 'node:assert/strict'
import test from 'node:test'
import { mayNeedMediaGenerationTools } from './media-tool-intent'

test('mayNeedMediaGenerationTools returns false for empty or non-media prompts', () => {
  assert.equal(mayNeedMediaGenerationTools(''), false)
  assert.equal(mayNeedMediaGenerationTools('   '), false)
  assert.equal(mayNeedMediaGenerationTools('What is the capital of France?'), false)
  assert.equal(mayNeedMediaGenerationTools('Summarize this document'), false)
})

test('mayNeedMediaGenerationTools returns true when action and media noun appear together', () => {
  assert.equal(mayNeedMediaGenerationTools('Generate an image of a sunset'), true)
  assert.equal(mayNeedMediaGenerationTools('Create a logo for my startup'), true)
  assert.equal(mayNeedMediaGenerationTools('Make a short video of waves'), true)
})

test('mayNeedMediaGenerationTools returns true for image/video of patterns and standalone media nouns', () => {
  assert.equal(mayNeedMediaGenerationTools('Image of a cat wearing a hat'), true)
  assert.equal(mayNeedMediaGenerationTools('Design a thumbnail for YouTube'), true)
  assert.equal(mayNeedMediaGenerationTools('Need a wallpaper for my phone'), true)
})
