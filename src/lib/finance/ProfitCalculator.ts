/**
 * Sprint 41 — Profit & margin calculator.
 */

export class ProfitCalculator {
  profit(input: {
    rahhalMarkup: number
    serviceFee: number
    otherFees: number
    agencyCommission: number
    affiliateCommission: number
    cashback: number
    refundLoss?: number
  }): number {
    return round2(
      input.rahhalMarkup
        + input.serviceFee
        + input.otherFees
        - input.agencyCommission
        - input.affiliateCommission
        - input.cashback
        - (input.refundLoss ?? 0),
    )
  }

  marginPercent(profit: number, revenue: number): number {
    if (revenue <= 0) return 0
    return round2((profit / revenue) * 100)
  }
}

export function createProfitCalculator(): ProfitCalculator {
  return new ProfitCalculator()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
