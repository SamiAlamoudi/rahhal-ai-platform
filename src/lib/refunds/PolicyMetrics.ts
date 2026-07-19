/**
 * Sprint 36 — Admin metrics for cancellations & refunds.
 */

import type { CancellationReason, PolicyMetricsSnapshot } from './types'

export class PolicyMetrics {
  private refundVolume = 0
  private refundCount = 0
  private refundSuccesses = 0
  private refundAttempts = 0
  private businessDaysTotal = 0
  private providerRefundLatencyMsTotal = 0
  private failures = 0
  private rollbacks = 0
  private readonly refundReasons: Record<string, number> = {}
  private readonly cancellationReasons: Record<string, number> = {}

  recordQuote(reason: CancellationReason): void {
    this.cancellationReasons[reason] = (this.cancellationReasons[reason] ?? 0) + 1
  }

  recordRefundAttempt(reason: CancellationReason): void {
    this.refundAttempts += 1
    this.refundReasons[reason] = (this.refundReasons[reason] ?? 0) + 1
  }

  recordRefundSuccess(amount: number, businessDays: number, latencyMs: number): void {
    this.refundSuccesses += 1
    this.refundCount += 1
    this.refundVolume += Math.max(0, amount)
    this.businessDaysTotal += Math.max(0, businessDays)
    this.providerRefundLatencyMsTotal += Math.max(0, latencyMs)
  }

  recordFailure(): void {
    this.failures += 1
    this.refundAttempts += 1
  }

  recordRollback(): void {
    this.rollbacks += 1
  }

  snapshot(): PolicyMetricsSnapshot {
    return {
      refundVolume: round2(this.refundVolume),
      refundCount: this.refundCount,
      averageRefundBusinessDays:
        this.refundCount > 0
          ? round2(this.businessDaysTotal / this.refundCount)
          : 0,
      refundSuccessRate:
        this.refundAttempts > 0 ? this.refundSuccesses / this.refundAttempts : 0,
      providerRefundLatencyMsTotal: this.providerRefundLatencyMsTotal,
      refundReasons: { ...this.refundReasons },
      cancellationReasons: { ...this.cancellationReasons },
      failures: this.failures,
      rollbacks: this.rollbacks,
    }
  }

  reset(): void {
    this.refundVolume = 0
    this.refundCount = 0
    this.refundSuccesses = 0
    this.refundAttempts = 0
    this.businessDaysTotal = 0
    this.providerRefundLatencyMsTotal = 0
    this.failures = 0
    this.rollbacks = 0
    for (const key of Object.keys(this.refundReasons)) delete this.refundReasons[key]
    for (const key of Object.keys(this.cancellationReasons)) delete this.cancellationReasons[key]
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
