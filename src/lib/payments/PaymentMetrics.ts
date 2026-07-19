/**
 * Sprint 34 — Payment metrics aggregator.
 */

export interface PaymentMetricsSnapshot {
  checkoutsStarted: number
  paymentsSucceeded: number
  paymentsFailed: number
  paymentsDeclined: number
  paymentsTimedOut: number
  refunds: number
  rollbacks: number
  providerFailovers: number
  totalChargeLatencyMs: number
  avgChargeLatencyMs: number
  successRate: number
  failureRate: number
}

export class PaymentMetrics {
  private checkoutsStarted = 0
  private paymentsSucceeded = 0
  private paymentsFailed = 0
  private paymentsDeclined = 0
  private paymentsTimedOut = 0
  private refunds = 0
  private rollbacks = 0
  private providerFailovers = 0
  private totalChargeLatencyMs = 0

  recordCheckoutStarted(): void {
    this.checkoutsStarted += 1
  }

  recordSuccess(latencyMs: number): void {
    this.paymentsSucceeded += 1
    this.totalChargeLatencyMs += Math.max(0, latencyMs)
  }

  recordFailed(latencyMs: number): void {
    this.paymentsFailed += 1
    this.totalChargeLatencyMs += Math.max(0, latencyMs)
  }

  recordDeclined(): void {
    this.paymentsDeclined += 1
  }

  recordTimeout(): void {
    this.paymentsTimedOut += 1
  }

  recordRefund(): void {
    this.refunds += 1
  }

  recordRollback(): void {
    this.rollbacks += 1
  }

  recordFailover(): void {
    this.providerFailovers += 1
  }

  snapshot(): PaymentMetricsSnapshot {
    const finished = this.paymentsSucceeded + this.paymentsFailed
    return {
      checkoutsStarted: this.checkoutsStarted,
      paymentsSucceeded: this.paymentsSucceeded,
      paymentsFailed: this.paymentsFailed,
      paymentsDeclined: this.paymentsDeclined,
      paymentsTimedOut: this.paymentsTimedOut,
      refunds: this.refunds,
      rollbacks: this.rollbacks,
      providerFailovers: this.providerFailovers,
      totalChargeLatencyMs: this.totalChargeLatencyMs,
      avgChargeLatencyMs:
        finished > 0 ? Math.round((this.totalChargeLatencyMs / finished) * 100) / 100 : 0,
      successRate: finished > 0 ? this.paymentsSucceeded / finished : 0,
      failureRate: finished > 0 ? this.paymentsFailed / finished : 0,
    }
  }

  reset(): void {
    this.checkoutsStarted = 0
    this.paymentsSucceeded = 0
    this.paymentsFailed = 0
    this.paymentsDeclined = 0
    this.paymentsTimedOut = 0
    this.refunds = 0
    this.rollbacks = 0
    this.providerFailovers = 0
    this.totalChargeLatencyMs = 0
  }
}
