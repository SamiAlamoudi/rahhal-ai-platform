/**
 * Phase AG — provider-neutral Trip Planner REST API metrics.
 */

import { maskMetadata } from '../../../ops/logging/mask'

export type TripPlannerApiMetricName =
  | 'trip_planner_api.request_count'
  | 'trip_planner_api.response_status'
  | 'trip_planner_api.endpoint_latency_ms'
  | 'trip_planner_api.plan_creation_latency_ms'
  | 'trip_planner_api.active_executions'
  | 'trip_planner_api.status_polling'
  | 'trip_planner_api.cancellations'
  | 'trip_planner_api.retries'
  | 'trip_planner_api.validation_failures'
  | 'trip_planner_api.authorization_failures'
  | 'trip_planner_api.idempotency_hits'
  | 'trip_planner_api.idempotency_conflicts'

export class TripPlannerApiMetrics {
  private readonly counters = new Map<string, number>()
  private readonly gauges = new Map<string, number>()

  incr(name: TripPlannerApiMetricName, tags: Record<string, string> = {}, by = 1): void {
    const key = this.key(name, tags)
    this.counters.set(key, (this.counters.get(key) ?? 0) + by)
  }

  observe(name: TripPlannerApiMetricName, valueMs: number, tags: Record<string, string> = {}): void {
    const key = this.key(name, tags)
    this.gauges.set(key, valueMs)
    this.counters.set(`${key}__count`, (this.counters.get(`${key}__count`) ?? 0) + 1)
    this.counters.set(`${key}__sum`, (this.counters.get(`${key}__sum`) ?? 0) + valueMs)
  }

  setGauge(name: TripPlannerApiMetricName, value: number, tags: Record<string, string> = {}): void {
    this.gauges.set(this.key(name, tags), value)
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries([
      ...this.counters.entries(),
      ...[...this.gauges.entries()].map(([k, v]) => [`gauge:${k}`, v] as const),
    ])
  }

  reset(): void {
    this.counters.clear()
    this.gauges.clear()
  }

  private key(name: string, tags: Record<string, string>): string {
    const safe = maskMetadata(tags) as Record<string, string>
    const tag = Object.keys(safe)
      .sort()
      .map((k) => `${k}=${String(safe[k])}`)
      .join(',')
    return tag ? `${name}|${tag}` : name
  }
}

let defaultApiMetrics: TripPlannerApiMetrics | null = null

export function getTripPlannerApiMetrics(): TripPlannerApiMetrics {
  if (!defaultApiMetrics) defaultApiMetrics = new TripPlannerApiMetrics()
  return defaultApiMetrics
}

export function resetTripPlannerApiMetrics(): void {
  defaultApiMetrics?.reset()
  defaultApiMetrics = null
}
