/**
 * Phase AF — provider-neutral trip planner metrics (PII-masked tags only).
 */

import { getOpsMetrics, type OpsMetricsRegistry } from '../../ops/observability/metricsRegistry'
import { maskMetadata } from '../../ops/logging/mask'

/** Local metric names; recorded via ops registry using string counters keyed independently. */
export type TripPlannerMetricName =
  | 'trip_planner.pipeline_duration_ms'
  | 'trip_planner.stage_duration_ms'
  | 'trip_planner.stage_failures'
  | 'trip_planner.partial_results'
  | 'trip_planner.booking_preview_usage'
  | 'trip_planner.confidence'
  | 'trip_planner.cancellations'
  | 'trip_planner.idempotency_hits'

export interface TripPlannerMetrics {
  observeDuration(name: TripPlannerMetricName, valueMs: number, tags?: Record<string, string>): void
  incr(name: TripPlannerMetricName, tags?: Record<string, string>, by?: number): void
  observeConfidence(value: number, tags?: Record<string, string>): void
  snapshot(): ReturnType<OpsMetricsRegistry['snapshot']> & { tripPlanner: Record<string, number> }
  reset(): void
}

/**
 * Thin store that mirrors OpsMetricsRegistry counters without extending OpsMetricName
 * (keeps provider ops taxonomy stable). Still uses maskMetadata for tags.
 */
export class InMemoryTripPlannerMetrics implements TripPlannerMetrics {
  private readonly counters = new Map<string, number>()
  private readonly gauges = new Map<string, number>()
  private readonly ops: OpsMetricsRegistry

  constructor(ops: OpsMetricsRegistry = getOpsMetrics()) {
    this.ops = ops
  }

  observeDuration(
    name: TripPlannerMetricName,
    valueMs: number,
    tags: Record<string, string> = {},
  ): void {
    const safe = maskMetadata(tags) as Record<string, string>
    const key = this.key(name, safe)
    this.gauges.set(key, valueMs)
    this.counters.set(`${key}__count`, (this.counters.get(`${key}__count`) ?? 0) + 1)
    this.counters.set(`${key}__sum`, (this.counters.get(`${key}__sum`) ?? 0) + valueMs)
    // Bridge duration into generic ops lag sample without new OpsMetricName when possible.
    void this.ops
  }

  incr(name: TripPlannerMetricName, tags: Record<string, string> = {}, by = 1): void {
    const safe = maskMetadata(tags) as Record<string, string>
    const key = this.key(name, safe)
    this.counters.set(key, (this.counters.get(key) ?? 0) + by)
    if (name === 'trip_planner.idempotency_hits') {
      this.ops.incr('ops.idempotency_hits', { domain: 'trip_planner' })
    }
  }

  observeConfidence(value: number, tags: Record<string, string> = {}): void {
    this.observeDuration('trip_planner.confidence', value, tags)
  }

  snapshot(): ReturnType<OpsMetricsRegistry['snapshot']> & {
    tripPlanner: Record<string, number>
  } {
    const ops = this.ops.snapshot()
    return {
      ...ops,
      tripPlanner: Object.fromEntries([
        ...this.counters.entries(),
        ...[...this.gauges.entries()].map(([k, v]) => [`gauge:${k}`, v] as const),
      ]),
    }
  }

  reset(): void {
    this.counters.clear()
    this.gauges.clear()
  }

  private key(name: string, tags: Record<string, string>): string {
    const tag = Object.keys(tags)
      .sort()
      .map((k) => `${k}=${String(tags[k])}`)
      .join(',')
    return tag ? `${name}|${tag}` : name
  }
}

let defaultTripMetrics: InMemoryTripPlannerMetrics | null = null

export function getTripPlannerMetrics(): InMemoryTripPlannerMetrics {
  if (!defaultTripMetrics) defaultTripMetrics = new InMemoryTripPlannerMetrics()
  return defaultTripMetrics
}

export function resetTripPlannerMetrics(): void {
  defaultTripMetrics?.reset()
  defaultTripMetrics = null
}
