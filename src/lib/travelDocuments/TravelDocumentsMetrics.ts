/**
 * Sprint 39 — Travel documents metrics.
 */

export interface TravelDocumentsMetricsSnapshot {
  evaluations: number
  visaFreeCount: number
  visaRequiredCount: number
  passportWarnings: number
  alertsGenerated: number
  averageConfidence: number
  byDestination: Record<string, number>
}

export class TravelDocumentsMetrics {
  private evaluations = 0
  private visaFreeCount = 0
  private visaRequiredCount = 0
  private passportWarnings = 0
  private alertsGenerated = 0
  private confidenceTotal = 0
  private readonly byDestination: Record<string, number> = {}

  recordEvaluation(input: {
    destination: string
    visaFree: boolean
    passportWarnings: number
    alerts: number
    confidence: number
  }): void {
    this.evaluations += 1
    if (input.visaFree) this.visaFreeCount += 1
    else this.visaRequiredCount += 1
    this.passportWarnings += input.passportWarnings
    this.alertsGenerated += input.alerts
    this.confidenceTotal += clamp01(input.confidence)
    this.byDestination[input.destination] =
      (this.byDestination[input.destination] ?? 0) + 1
  }

  snapshot(): TravelDocumentsMetricsSnapshot {
    return {
      evaluations: this.evaluations,
      visaFreeCount: this.visaFreeCount,
      visaRequiredCount: this.visaRequiredCount,
      passportWarnings: this.passportWarnings,
      alertsGenerated: this.alertsGenerated,
      averageConfidence:
        this.evaluations > 0 ? round2(this.confidenceTotal / this.evaluations) : 0,
      byDestination: { ...this.byDestination },
    }
  }

  reset(): void {
    this.evaluations = 0
    this.visaFreeCount = 0
    this.visaRequiredCount = 0
    this.passportWarnings = 0
    this.alertsGenerated = 0
    this.confidenceTotal = 0
    for (const key of Object.keys(this.byDestination)) delete this.byDestination[key]
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
