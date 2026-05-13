type MetricKind = 'counter' | 'gauge' | 'histogram'

type Metric = {
  kind: MetricKind
  name: string
  help: string
  values: Map<string, number>
}

const metrics = new Map<string, Metric>()

function labelKey(labels?: Record<string, string | number | boolean | undefined>): string {
  if (!labels) return ''
  return Object.entries(labels)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${JSON.stringify(String(value))}`)
    .join(',')
}

function formatLabels(key: string): string {
  return key ? `{${key}}` : ''
}

function getMetric(kind: MetricKind, name: string, help: string): Metric {
  const existing = metrics.get(name)
  if (existing) return existing
  const metric = { kind, name, help, values: new Map<string, number>() }
  metrics.set(name, metric)
  return metric
}

export function incrementMetric(
  name: string,
  help: string,
  labels?: Record<string, string | number | boolean | undefined>,
  amount = 1,
): void {
  const metric = getMetric('counter', name, help)
  const key = labelKey(labels)
  metric.values.set(key, (metric.values.get(key) ?? 0) + amount)
}

export function setGaugeMetric(
  name: string,
  help: string,
  labels: Record<string, string | number | boolean | undefined> | undefined,
  value: number,
): void {
  const metric = getMetric('gauge', name, help)
  metric.values.set(labelKey(labels), value)
}

export function observeDurationMs(
  name: string,
  help: string,
  labels: Record<string, string | number | boolean | undefined> | undefined,
  durationMs: number,
): void {
  const metric = getMetric('histogram', `${name}_ms`, help)
  const key = labelKey(labels)
  metric.values.set(key, (metric.values.get(key) ?? 0) + durationMs)
  incrementMetric(`${name}_count`, `${help} count`, labels)
}

export function recordHttpRequest(args: {
  method: string
  pathname: string
  status: number
  durationMs: number
}): void {
  const labels = {
    method: args.method,
    route: normalizeRoute(args.pathname),
    status: args.status,
  }
  incrementMetric('overlay_http_requests_total', 'Total HTTP requests handled by Overlay', labels)
  observeDurationMs('overlay_http_request_duration', 'Total HTTP request duration in milliseconds', labels, args.durationMs)
}

export function recordProviderHealth(args: {
  domain: string
  providerId: string
  status: 'ok' | 'degraded' | 'down'
  latencyMs?: number
}): void {
  const labels = { domain: args.domain, provider: args.providerId }
  setGaugeMetric('overlay_provider_health', 'Provider health status, 1 for ok and 0 for degraded/down', labels, args.status === 'ok' ? 1 : 0)
  if (args.latencyMs !== undefined) {
    setGaugeMetric('overlay_provider_health_latency_ms', 'Provider health check latency in milliseconds', labels, args.latencyMs)
  }
}

export function getMetricsText(extraLines: string[] = []): string {
  const lines: string[] = []
  for (const metric of metrics.values()) {
    lines.push(`# HELP ${metric.name} ${metric.help}`)
    lines.push(`# TYPE ${metric.name} ${metric.kind === 'histogram' ? 'gauge' : metric.kind}`)
    for (const [key, value] of metric.values.entries()) {
      lines.push(`${metric.name}${formatLabels(key)} ${Number.isFinite(value) ? value : 0}`)
    }
  }
  lines.push(...extraLines)
  return `${lines.join('\n')}\n`
}

export function resetMetricsForTests(): void {
  metrics.clear()
}

function normalizeRoute(pathname: string): string {
  return pathname
    .replace(/[0-9a-f]{16,}/gi, ':id')
    .replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, '/:id')
}
