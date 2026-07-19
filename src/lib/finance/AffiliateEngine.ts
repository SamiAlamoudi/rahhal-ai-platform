/**
 * Sprint 41 — Affiliate partner commission tracking.
 */

export interface AffiliatePartner {
  affiliateId: string
  name: string
  commissionPercent: number
  active: boolean
}

export class AffiliateEngine {
  private readonly partners = new Map<string, AffiliatePartner>()
  private readonly earnings: Array<{ affiliateId: string; bookingId: string; amount: number; currency: string }> = []

  register(name: string, commissionPercent = 3): AffiliatePartner {
    const partner: AffiliatePartner = {
      affiliateId: `aff_${Math.random().toString(36).slice(2, 8)}`,
      name,
      commissionPercent,
      active: true,
    }
    this.partners.set(partner.affiliateId, partner)
    return { ...partner }
  }

  recordEarning(affiliateId: string, bookingId: string, amount: number, currency: string): void {
    if (!this.partners.has(affiliateId)) return
    this.earnings.push({ affiliateId, bookingId, amount: round2(amount), currency })
  }

  totalFor(affiliateId: string): number {
    return round2(
      this.earnings.filter((e) => e.affiliateId === affiliateId).reduce((s, e) => s + e.amount, 0),
    )
  }

  list(): AffiliatePartner[] {
    return [...this.partners.values()].map((p) => ({ ...p }))
  }
}

export function createAffiliateEngine(): AffiliateEngine {
  return new AffiliateEngine()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
