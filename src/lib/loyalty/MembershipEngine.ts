/**
 * Sprint 38 — Membership levels and configurable benefits.
 */

import type { MembershipBenefit, MembershipDefinition, MembershipTier } from './types'

const TIERS: MembershipDefinition[] = [
  {
    tier: 'explorer',
    rank: 1,
    minLifetimePoints: 0,
    earnMultiplier: 1,
    benefits: [
      benefit('bonus_points', 'Welcome bonus eligibility', 'Base earn rate', 1, 'boolean'),
      benefit('exclusive_offers', 'Starter offers', 'Occasional member offers', 1, 'boolean'),
    ],
  },
  {
    tier: 'silver',
    rank: 2,
    minLifetimePoints: 5000,
    earnMultiplier: 1.15,
    benefits: [
      benefit('extra_discounts', 'Silver discount', '2% member discount', 2, 'percent'),
      benefit('bonus_points', 'Silver bonus', '15% more Bilamo Points', 15, 'percent'),
      benefit('priority_support', 'Priority chat support', 'Faster support routing', 1, 'boolean'),
    ],
  },
  {
    tier: 'gold',
    rank: 3,
    minLifetimePoints: 15000,
    earnMultiplier: 1.35,
    benefits: [
      benefit('extra_discounts', 'Gold discount', '5% member discount', 5, 'percent'),
      benefit('late_checkout', 'Late checkout credits', '2 late checkout credits / year', 2, 'credits'),
      benefit('free_cancellation_credits', 'Free cancel credits', '1 free cancel credit', 1, 'credits'),
      benefit('airport_lounge_credits', 'Lounge credits', '1 lounge credit', 1, 'credits'),
      benefit('priority_ai_processing', 'Priority AI', 'Faster AI trip planning', 1, 'boolean'),
    ],
  },
  {
    tier: 'platinum',
    rank: 4,
    minLifetimePoints: 40000,
    earnMultiplier: 1.6,
    benefits: [
      benefit('extra_discounts', 'Platinum discount', '8% member discount', 8, 'percent'),
      benefit('free_upgrades', 'Upgrade preference', 'Complimentary upgrade when available', 1, 'boolean'),
      benefit('airport_lounge_credits', 'Lounge credits', '3 lounge credits', 3, 'credits'),
      benefit('late_checkout', 'Late checkout credits', '4 late checkout credits / year', 4, 'credits'),
      benefit('free_cancellation_credits', 'Free cancel credits', '3 free cancel credits', 3, 'credits'),
      benefit('priority_ai_processing', 'Priority AI', 'Top-queue AI processing', 1, 'boolean'),
      benefit('exclusive_offers', 'Platinum exclusives', 'Exclusive partner offers', 1, 'boolean'),
    ],
  },
  {
    tier: 'diamond',
    rank: 5,
    minLifetimePoints: 100000,
    earnMultiplier: 2,
    benefits: [
      benefit('extra_discounts', 'Diamond discount', '12% member discount', 12, 'percent'),
      benefit('free_upgrades', 'Guaranteed upgrade attempt', 'Highest upgrade priority', 1, 'boolean'),
      benefit('airport_lounge_credits', 'Lounge credits', '6 lounge credits', 6, 'credits'),
      benefit('late_checkout', 'Late checkout credits', 'Unlimited late checkout attempts', 99, 'credits'),
      benefit('free_cancellation_credits', 'Free cancel credits', '6 free cancel credits', 6, 'credits'),
      benefit('bonus_points', 'Diamond bonus', '100% more Bilamo Points', 100, 'percent'),
      benefit('priority_support', 'Concierge support', 'Dedicated priority support', 1, 'boolean'),
      benefit('priority_ai_processing', 'Priority AI', 'Highest AI priority', 1, 'boolean'),
      benefit('exclusive_offers', 'Diamond exclusives', 'Invitation-only offers', 1, 'boolean'),
    ],
  },
]

export class MembershipEngine {
  listTiers(): MembershipDefinition[] {
    return TIERS.map(cloneTier)
  }

  getDefinition(tier: MembershipTier): MembershipDefinition {
    const found = TIERS.find((t) => t.tier === tier)
    return cloneTier(found ?? TIERS[0])
  }

  resolveTier(lifetimeEarned: number): MembershipTier {
    let current: MembershipTier = 'explorer'
    for (const tier of TIERS) {
      if (lifetimeEarned >= tier.minLifetimePoints) current = tier.tier
    }
    return current
  }

  getBenefits(tier: MembershipTier): MembershipBenefit[] {
    return this.getDefinition(tier).benefits.map((b) => ({ ...b }))
  }

  earnMultiplier(tier: MembershipTier): number {
    return this.getDefinition(tier).earnMultiplier
  }

  discountPercent(tier: MembershipTier): number {
    const benefit = this.getBenefits(tier).find((b) => b.kind === 'extra_discounts' && b.enabled)
    return benefit?.unit === 'percent' ? benefit.value : 0
  }
}

export function createMembershipEngine(): MembershipEngine {
  return new MembershipEngine()
}

function benefit(
  kind: MembershipBenefit['kind'],
  title: string,
  description: string,
  value: number,
  unit: MembershipBenefit['unit'],
): MembershipBenefit {
  return { kind, title, description, value, unit, enabled: true }
}

function cloneTier(tier: MembershipDefinition): MembershipDefinition {
  return {
    ...tier,
    benefits: tier.benefits.map((b) => ({ ...b })),
  }
}
