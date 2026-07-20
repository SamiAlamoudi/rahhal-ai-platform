/**
 * Sprint 41 — Supplier / agency / affiliate commission calculations.
 */

export class CommissionEngine {
  supplierCommission(baseFare: number, percent = 10): number {
    return round2(baseFare * (percent / 100))
  }

  agencyCommission(customerTotal: number, percent = 5): number {
    return round2(customerTotal * (percent / 100))
  }

  affiliateCommission(rahhalRevenue: number, percent = 3): number {
    return round2(rahhalRevenue * (percent / 100))
  }
}

export function createCommissionEngine(): CommissionEngine {
  return new CommissionEngine()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
