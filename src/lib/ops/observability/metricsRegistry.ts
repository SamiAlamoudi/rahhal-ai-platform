/**
 * Ops metrics registry — provider, booking, payment, ticketing, notification.
 */

export type OpsMetricName =
  | 'provider.latency_ms'
  | 'provider.failures'
  | 'provider.fallback'
  | 'provider.circuit_open'
  | 'booking.lifecycle_failures'
  | 'payment.mock_failures'
  | 'ticketing.failures'
  | 'notification.failures'
  | 'ops.rate_limited'
  | 'ops.idempotency_hits'
  | 'app.unavailable'
  | 'frontend.errors'
  | 'edge.function_failures'
  | 'auth.failures'
  | 'database.errors'
  | 'ops.slow_requests'
  | 'ops.memory_pressure'
  | 'ops.queue_backlog'
  | 'ops.secret_validation_failures'

export interface MetricSample {
  name: OpsMetricName
  value: number
  at: string
  tags: Record<string, string>
}

export interface OpsMetricsSnapshot {
  counters: Record<string, number>
  gauges: Record<string, number>
  recent: MetricSample[]
}

function key(name: string, tags: Record<string, string>): string {
  const tag = Object.keys(tags).sort().map((k) => `${k}=${tags[k]}`).join(',')
  return tag ? `${name}|${tag}` : name
}

export class OpsMetricsRegistry {
  private readonly counters = new Map<string, number>()
  private readonly gauges = new Map<string, number>()
  private readonly recent: MetricSample[] = []

  incr(name: OpsMetricName, tags: Record<string, string> = {}, by = 1): void {
    const k = key(name, tags)
    this.counters.set(k, (this.counters.get(k) ?? 0) + by)
    this.push({ name, value: by, at: new Date().toISOString(), tags })
  }

  observe(name: OpsMetricName, value: number, tags: Record<string, string> = {}): void {
    const k = key(name, tags)
    this.gauges.set(k, value)
    this.counters.set(`${k}__count`, (this.counters.get(`${k}__count`) ?? 0) + 1)
    this.counters.set(`${k}__sum`, (this.counters.get(`${k}__sum`) ?? 0) + value)
    this.push({ name, value, at: new Date().toISOString(), tags })
  }

  gauge(name: OpsMetricName, value: number, tags: Record<string, string> = {}): void {
    this.gauges.set(key(name, tags), value)
    this.push({ name, value, at: new Date().toISOString(), tags })
  }

  snapshot(): OpsMetricsSnapshot {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      recent: this.recent.slice(-100),
    }
  }

  reset(): void {
    this.counters.clear()
    this.gauges.clear()
    this.recent.length = 0
  }

  private push(sample: MetricSample): void {
    this.recent.push(sample)
    if (this.recent.length > 500) this.recent.shift()
  }
}

let defaultMetrics: OpsMetricsRegistry | null = null

export function getOpsMetrics(): OpsMetricsRegistry {
  if (!defaultMetrics) defaultMetrics = new OpsMetricsRegistry()
  return defaultMetrics
}

export function resetOpsMetrics(): void {
  defaultMetrics?.reset()
  defaultMetrics = null
}

/** Bridge Phase W live metrics/circuit into ops registry. */
export function recordProviderOutcome(input: {
  providerId: string
  durationMs: number
  failed: boolean
  fallback?: boolean
  circuitOpen?: boolean
}): void {
  const metrics = getOpsMetrics()
  metrics.observe('provider.latency_ms', input.durationMs, { providerId: input.providerId })
  if (input.failed) metrics.incr('provider.failures', { providerId: input.providerId })
  if (input.fallback) metrics.incr('provider.fallback', { providerId: input.providerId })
  if (input.circuitOpen) {
    metrics.gauge('provider.circuit_open', 1, { providerId: input.providerId })
    metrics.incr('provider.circuit_open', { providerId: input.providerId })
  }
}
