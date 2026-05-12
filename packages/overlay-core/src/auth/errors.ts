export class UnsupportedAuthFlowError extends Error {
  constructor(providerId: string, flow: string) {
    super(`${providerId} does not support auth flow: ${flow}`)
    this.name = 'UnsupportedAuthFlowError'
  }
}
