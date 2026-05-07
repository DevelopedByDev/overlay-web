import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

type ValidationOptions = {
  allowLocalDev?: boolean
  requireHttps?: boolean
}

const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
  [ip4ToNumber('0.0.0.0'), ip4ToNumber('0.255.255.255')],
  [ip4ToNumber('10.0.0.0'), ip4ToNumber('10.255.255.255')],
  [ip4ToNumber('127.0.0.0'), ip4ToNumber('127.255.255.255')],
  [ip4ToNumber('169.254.0.0'), ip4ToNumber('169.254.255.255')],
  [ip4ToNumber('172.16.0.0'), ip4ToNumber('172.31.255.255')],
  [ip4ToNumber('192.168.0.0'), ip4ToNumber('192.168.255.255')],
  [ip4ToNumber('100.64.0.0'), ip4ToNumber('100.127.255.255')],
  [ip4ToNumber('224.0.0.0'), ip4ToNumber('255.255.255.255')],
]

function ip4ToNumber(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0
}

function isPrivateIpv4(address: string): boolean {
  const value = ip4ToNumber(address)
  return PRIVATE_IPV4_RANGES.some(([start, end]) => value >= start && value <= end)
}

function isUnsafeIpv6(address: string): boolean {
  const normalized = address.toLowerCase()
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('ff') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  )
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal'
}

function isUnsafeAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return isPrivateIpv4(address)
  if (family === 6) return isUnsafeIpv6(address)
  return true
}

export async function validatePublicNetworkUrl(
  raw: unknown,
  options: ValidationOptions = {},
): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, error: 'URL is required' }
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    return { ok: false, error: 'Invalid URL' }
  }

  const isDevLocalAllowed =
    options.allowLocalDev === true &&
    process.env.NODE_ENV === 'development' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]' || parsed.hostname === '::1')

  if (options.requireHttps !== false && parsed.protocol !== 'https:' && !isDevLocalAllowed) {
    return { ok: false, error: 'HTTPS required in production. HTTP is allowed only for local development.' }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'Only HTTP and HTTPS URLs are supported' }
  }
  if (isDevLocalAllowed) return { ok: true, url: parsed }
  if (isLocalHostname(parsed.hostname)) return { ok: false, error: 'Local and metadata hostnames are not allowed' }

  const literalFamily = isIP(parsed.hostname)
  if (literalFamily !== 0) {
    return isUnsafeAddress(parsed.hostname)
      ? { ok: false, error: 'Private, loopback, link-local, and metadata IPs are not allowed' }
      : { ok: false, error: 'IP literal URLs are not allowed' }
  }

  let addresses: Array<{ address: string }>
  try {
    addresses = await lookup(parsed.hostname, { all: true, verbatim: false })
  } catch {
    return { ok: false, error: 'Could not resolve URL hostname' }
  }
  if (addresses.length === 0) return { ok: false, error: 'Could not resolve URL hostname' }
  if (addresses.some((entry) => isUnsafeAddress(entry.address))) {
    return { ok: false, error: 'URL resolves to a private or local network address' }
  }
  return { ok: true, url: parsed }
}
