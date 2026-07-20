/**
 * Sprint 37 — Disruption handling metrics.
 */

export interface DisruptionMetricsSnapshot {
  disruptionsDetected: number
  recoveriesGenerated: number
  plansApplied: number
  zeroCostRecoveries: number
  averageConfidence: number
  averageExtraCost: number
  byEventType: Record<string, number>
}

export class DisruptionMetrics {
  private disruptionsDetected = 0
  private recoveriesGenerated = 0
  private plansApplied = 0
  private zeroCostRecoveries = 0
  private confidenceTotal = 0
  private extraCostTotal = 0
  private readonly byEventType: Record<string, number> = {}

  recordDetected(eventType: string): void {
    this.disruptionsDetected += 1
    this.byEventType[eventType] = (this.byEventType[eventType] ?? 0) + 1
  }

  recordRecoveries(count: number): void {
    this.recoveriesGenerated += count
  }

  recordApplied(extraCost: number, confidence: number): void {
    this.plansApplied += 1
    if (extraCost <= 0) this.zeroCostRecoveries += 1
    this.extraCostTotal += Math.max(0, extraCost)
    this.confidenceTotal += clamp01(confidence)
  }

  snapshot(): DisruptionMetricsSnapshot {
    return {
      disruptionsDetected: this.disruptionsDetected,
      recoveriesGenerated: this.recoveriesGenerated,
      plansApplied: this.plansApplied,
      zeroCostRecoveries: this.zeroCostRecoveries,
      averageConfidence:
        this.plansApplied > 0 ? round2(this.confidenceTotal / this.plansApplied) : 0,
      averageExtraCost:
        this.plansApplied > 0 ? round2(this.extraCostTotal / this.plansApplied) : 0,
      byEventType: { ...this.byEventType },
    }
  }

  reset(): void {
    this.disruptionsDetected = 0
    this.recoveriesGenerated = 0
    this.plansApplied = 0
    this.zeroCostRecoveries = 0
    this.confidenceTotal = 0
    this.extraCostTotal = 0
    for (const key of Object.keys(this.byEventType)) delete this.byEventType[key]
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
