export const STREAM_IDEMPOTENCY_RESPONSE_MARKER = '__overlay_stream_started__'

export const STREAM_IDEMPOTENCY_KIND_HEADER = 'x-overlay-idempotency-kind'

export function isStreamIdempotencyMarker(responseBody: string | undefined): boolean {
  return responseBody === STREAM_IDEMPOTENCY_RESPONSE_MARKER
}
