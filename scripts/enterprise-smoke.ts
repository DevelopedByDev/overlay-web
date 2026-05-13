const baseUrl = process.env.OVERLAY_SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function assertOk(path: string) {
  const response = await fetch(`${baseUrl}${path}`)
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${path} failed with HTTP ${response.status}: ${text.slice(0, 500)}`)
  }
  return text
}

async function main() {
  const health = await assertOk('/api/health/dependencies')
  if (!health.includes('database') || !health.includes('storage') || !health.includes('cache')) {
    throw new Error(`/api/health/dependencies did not include provider health: ${health.slice(0, 500)}`)
  }
  console.log(`[enterprise:smoke] Provider health OK at ${baseUrl}.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
