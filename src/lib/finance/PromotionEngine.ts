/**
 * Sprint 41 — Coupons, promo campaigns, cashback.
 */

export class PromotionEngine {
  couponDiscount(amount: number, couponValue = 0): number {
    return round2(Math.min(amount, Math.max(0, couponValue)))
  }

  promoPercentDiscount(amount: number, percent = 0): number {
    return round2(amount * (Math.max(0, percent) / 100))
  }

  cashback(amount: number, cashbackAmount = 0): number {
    return round2(Math.max(0, Math.min(amount, cashbackAmount)))
  }

  rewardPointsValue(points: number, pointsPerCurrency = 100): number {
    return round2(Math.max(0, points) / Math.max(1, pointsPerCurrency))
  }
}

export function createPromotionEngine(): PromotionEngine {
  return new PromotionEngine()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
