import assert from 'node:assert/strict'
import test from 'node:test'
import { constrainStreamingScrollTop } from './constrain-streaming-scroll'

test('streaming scroll stays unchanged while the latest exchange tail is visible', () => {
  assert.equal(constrainStreamingScrollTop({
    clientHeight: 800,
    containerTop: 100,
    markerTop: 300,
    scrollTop: 500,
  }), 500)
})

test('streaming scroll is clamped before the latest exchange leaves the viewport', () => {
  assert.equal(constrainStreamingScrollTop({
    clientHeight: 800,
    containerTop: 100,
    markerTop: 20,
    scrollTop: 500,
  }), 260)
})
