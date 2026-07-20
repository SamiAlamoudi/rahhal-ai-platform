/**
 * Sprint 38 — Loyalty platform metrics.
 */

export interface LoyaltyMetricsSnapshot {
  earns: number
  redeems: number
  bonuses: number
  recommendations: number
  pointsEarnedTotal: number
  pointsRedeemedTotal: number
  averageRecommendationScore: number
  byServiceKind: Record<string, number>
}

export class LoyaltyMetrics {
  private earns = 0
  private redeems = 0
  private bonuses = 0
  private recommendations = 0
  private pointsEarnedTotal = 0
  private pointsRedeemedTotal = 0
  private recommendationScoreTotal = 0
  private readonly byServiceKind: Record<string, number> = {}

  recordEarn(points: number, serviceKind?: string): void {
    this.earns += 1
    this.pointsEarnedTotal += Math.max(0, points)
    if (serviceKind) {
      this.byServiceKind[serviceKind] = (this.byServiceKind[serviceKind] ?? 0) + 1
    }
  }

  recordRedeem(points: number): void {
    this.redeems += 1
    this.pointsRedeemedTotal += Math.max(0, points)
  }

  recordBonus(points: number): void {
    this.bonuses += 1
    this.pointsEarnedTotal += Math.max(0, points)
  }

  recordRecommendation(score: number): void {
    this.recommendations += 1
    this.recommendationScoreTotal += clamp01(score)
  }

  snapshot(): LoyaltyMetricsSnapshot {
    return {
      earns: this.earns,
      redeems: this.redeems,
      bonuses: this.bonuses,
      recommendations: this.recommendations,
      pointsEarnedTotal: this.pointsEarnedTotal,
      pointsRedeemedTotal: this.pointsRedeemedTotal,
      averageRecommendationScore:
        this.recommendations > 0
          ? round2(this.recommendationScoreTotal / this.recommendations)
          : 0,
      byServiceKind: { ...this.byServiceKind },
    }
  }

  reset(): void {
    this.earns = 0
    this.redeems = 0
    this.bonuses = 0
    this.recommendations = 0
    this.pointsEarnedTotal = 0
    this.pointsRedeemedTotal = 0
    this.recommendationScoreTotal = 0
    for (const key of Object.keys(this.byServiceKind)) delete this.byServiceKind[key]
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
