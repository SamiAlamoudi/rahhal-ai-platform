/**
 * Sprint 38 — Benefits Engine
 * Resolves and applies membership benefits for bookings / recommendations.
 */

import type { MembershipEngine } from './MembershipEngine'
import type { BenefitKind, MembershipBenefit, MembershipTier, LoyaltyCandidate } from './types'

export class BenefitsEngine {
  private readonly membership: MembershipEngine

  constructor(membership: MembershipEngine) {
    this.membership = membership
  }

  listBenefits(tier: MembershipTier): MembershipBenefit[] {
    return this.membership.getBenefits(tier)
  }

  hasBenefit(tier: MembershipTier, kind: BenefitKind): boolean {
    return this.listBenefits(tier).some((b) => b.kind === kind && b.enabled)
  }

  applyCashDiscount(tier: MembershipTier, price: number): {
    discountedPrice: number
    discountPercent: number
    benefitsApplied: BenefitKind[]
  } {
    const discountPercent = this.membership.discountPercent(tier)
    const discountedPrice = round2(price * (1 - discountPercent / 100))
    return {
      discountedPrice,
      discountPercent,
      benefitsApplied: discountPercent > 0 ? ['extra_discounts'] : [],
    }
  }

  upgradeEligible(tier: MembershipTier, candidate: LoyaltyCandidate): boolean {
    if (!this.hasBenefit(tier, 'free_upgrades')) return false
    if (candidate.statusUpgradeEligible) return true
    return tier === 'platinum' || tier === 'diamond'
  }

  summarizeForConversation(tier: MembershipTier, locale: 'en' | 'ar' = 'en'): string {
    const benefits = this.listBenefits(tier)
    if (locale === 'ar') {
      return `مستوى العضوية: ${tier}. المزايا: ${benefits.map((b) => b.title).join('، ')}.`
    }
    return `Your membership is ${capitalize(tier)}. Benefits: ${benefits
      .map((b) => b.title)
      .join('; ')}.`
  }
}

export function createBenefitsEngine(membership: MembershipEngine): BenefitsEngine {
  return new BenefitsEngine(membership)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
