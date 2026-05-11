// @overlay/core — extracted from src/lib/ssrf.ts
// Server-side request forgery prevention. Uses node:dns and node:net.

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
  return false
}

export async function isSafeUrl(url: string, options: ValidationOptions = {}): Promise<boolean> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  // Protocol check
  if (options.requireHttps && parsed.protocol !== 'https:') {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false
  }

  // Hostname checks
  if (!options.allowLocalDev && isLocalHostname(parsed.hostname)) {
    return false
  }

  // IP literal checks
  const ipFamily = isIP(parsed.hostname)
  if (ipFamily === 4) {
    return options.allowLocalDev ? true : !isPrivateIpv4(parsed.hostname)
  }
  if (ipFamily === 6) {
    return options.allowLocalDev ? true : !isUnsafeIpv6(parsed.hostname)
  }

  // DNS resolution check
  try {
    const addresses = await lookup(parsed.hostname, { all: true })
    for (const { address } of addresses) {
      if (isUnsafeAddress(address)) {
        return false
      }
    }
  } catch {
    // DNS failure — conservative: block
    return false
  }

  return true
}
