/**
 * Sprint 33 — Execution metrics aggregator.
 */

import type { ExecutionMetricsSnapshot } from './ExecutionTypes'

export class ExecutionMetrics {
  private started = 0
  private completed = 0
  private failed = 0
  private rollbacks = 0
  private retries = 0
  private totalDurationMs = 0
  private flightLatencyMsTotal = 0
  private hotelLatencyMsTotal = 0

  recordStarted(): void {
    this.started += 1
  }

  recordCompleted(durationMs: number): void {
    this.completed += 1
    this.totalDurationMs += Math.max(0, durationMs)
  }

  recordFailed(durationMs: number): void {
    this.failed += 1
    this.totalDurationMs += Math.max(0, durationMs)
  }

  recordRollback(): void {
    this.rollbacks += 1
  }

  recordRetry(): void {
    this.retries += 1
  }

  recordFlightLatency(ms: number): void {
    this.flightLatencyMsTotal += Math.max(0, ms)
  }

  recordHotelLatency(ms: number): void {
    this.hotelLatencyMsTotal += Math.max(0, ms)
  }

  snapshot(): ExecutionMetricsSnapshot {
    const finished = this.completed + this.failed
    return {
      executionsStarted: this.started,
      executionsCompleted: this.completed,
      executionsFailed: this.failed,
      rollbacks: this.rollbacks,
      retries: this.retries,
      totalDurationMs: this.totalDurationMs,
      avgDurationMs: finished > 0 ? Math.round((this.totalDurationMs / finished) * 100) / 100 : 0,
      flightLatencyMsTotal: this.flightLatencyMsTotal,
      hotelLatencyMsTotal: this.hotelLatencyMsTotal,
      successRate: finished > 0 ? this.completed / finished : 0,
      failureRate: finished > 0 ? this.failed / finished : 0,
    }
  }

  reset(): void {
    this.started = 0
    this.completed = 0
    this.failed = 0
    this.rollbacks = 0
    this.retries = 0
    this.totalDurationMs = 0
    this.flightLatencyMsTotal = 0
    this.hotelLatencyMsTotal = 0
  }
}

let sharedMetrics: ExecutionMetrics | null = null

export function getExecutionMetrics(): ExecutionMetrics {
  if (!sharedMetrics) sharedMetrics = new ExecutionMetrics()
  return sharedMetrics
}

export function resetExecutionMetrics(): void {
  sharedMetrics?.reset()
  sharedMetrics = null
}
