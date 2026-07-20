/**
 * Sprint 38 — Smart loyalty recommendation engine.
 * Scores price, points earned/redeemed, membership benefits, upgrades, prefs, history, context.
 */

import type { AirlineLoyaltyStore } from './AirlineLoyaltyStore'
import type { BenefitsEngine } from './BenefitsEngine'
import type { HotelLoyaltyRegistry } from './hotelAdapters'
import type { MembershipEngine } from './MembershipEngine'
import type { PointsWallet } from './PointsWallet'
import type {
  LoyaltyCandidate,
  LoyaltyRecommendationContext,
  MembershipTier,
  ScoredLoyaltyRecommendation,
} from './types'

export class LoyaltyRecommendationEngine {
  private readonly wallet: PointsWallet
  private readonly membership: MembershipEngine
  private readonly benefits: BenefitsEngine
  private readonly airlines: AirlineLoyaltyStore
  private readonly hotels: HotelLoyaltyRegistry

  constructor(input: {
    wallet: PointsWallet
    membership: MembershipEngine
    benefits: BenefitsEngine
    airlines: AirlineLoyaltyStore
    hotels: HotelLoyaltyRegistry
  }) {
    this.wallet = input.wallet
    this.membership = input.membership
    this.benefits = input.benefits
    this.airlines = input.airlines
    this.hotels = input.hotels
  }

  recommend(
    candidates: LoyaltyCandidate[],
    context: LoyaltyRecommendationContext,
  ): ScoredLoyaltyRecommendation[] {
    const wallet = this.wallet.getOrCreate(context.userId)
    const tier = wallet.membershipTier
    const enriched = candidates.map((c) => this.enrich(c, context.userId, tier))
    const scored = enriched.map((candidate) =>
      this.score(candidate, context, tier, wallet.balance),
    )
    scored.sort((a, b) => b.score - a.score || a.netCashCost - b.netCashCost)
    return scored.map((row, index) => ({
      ...row,
      rank: index + 1,
      explanation: explain(row, index + 1),
    }))
  }

  private enrich(
    candidate: LoyaltyCandidate,
    userId: string,
    tier: MembershipTier,
  ): LoyaltyCandidate {
    if (candidate.serviceKind === 'hotel') {
      const est = this.hotels.estimateForCandidate(userId, candidate)
      return {
        ...candidate,
        hotelBrand: est.brand,
        estimatedPartnerMilesOrPoints: est.points,
        estimatedRahhalPoints:
          candidate.estimatedRahhalPoints
          || Math.round(candidate.price * 10 * this.membership.earnMultiplier(tier)),
        metadata: { ...candidate.metadata, hotelProgram: est.programName },
      }
    }
    if (candidate.serviceKind === 'flight') {
      return {
        ...candidate,
        estimatedRahhalPoints:
          candidate.estimatedRahhalPoints
          || Math.round(candidate.price * 8 * this.membership.earnMultiplier(tier)),
        estimatedPartnerMilesOrPoints:
          candidate.estimatedPartnerMilesOrPoints || Math.round(candidate.price * 6),
      }
    }
    return {
      ...candidate,
      estimatedRahhalPoints:
        candidate.estimatedRahhalPoints
        || Math.round(candidate.price * 4 * this.membership.earnMultiplier(tier)),
    }
  }

  private score(
    candidate: LoyaltyCandidate,
    context: LoyaltyRecommendationContext,
    tier: MembershipTier,
    balance: number,
  ): ScoredLoyaltyRecommendation {
    const discount = this.benefits.applyCashDiscount(tier, candidate.price)
    const redeemPoints = context.wantToRedeemPoints
      ? Math.min(balance, context.redeemPointsAmount ?? Math.round(candidate.price * 10))
      : 0
    const redeemValue = redeemPoints / 100 // 100 points ≈ 1 currency unit
    const netCashCost = Math.max(0, round2(discount.discountedPrice - redeemValue))

    const priceFactor = 1 - Math.min(1, netCashCost / 4000)
    const earnFactor = Math.min(1, candidate.estimatedRahhalPoints / 8000)
    const redeemFactor = redeemPoints > 0 ? Math.min(1, redeemPoints / 5000) : 0.5
    const benefitFactor = discount.discountPercent / 12
    const upgradeFactor = this.benefits.upgradeEligible(tier, candidate) ? 1 : 0.4
    const preferenceFactor = preferenceScore(candidate, context)
    const historyFactor = historyScore(candidate, context)
    const conversationFactor = context.conversationNotes?.length ? 0.9 : 0.7

    let airlineBoost = 0
    if (candidate.serviceKind === 'flight') {
      const best = this.airlines.recommendBestAirline(context.userId, [candidate])
      airlineBoost = best && best.airlineCode === (candidate.brandOrAirline ?? candidate.providerId).toUpperCase()
        ? best.score
        : 0.3
    }

    const factors = {
      price: priceFactor,
      points_earned: earnFactor,
      points_redeemed: redeemFactor,
      membership_benefits: clamp01(benefitFactor + 0.4),
      status_upgrades: upgradeFactor,
      traveler_preferences: preferenceFactor,
      previous_history: historyFactor,
      conversation_context: conversationFactor,
      airline_loyalty: airlineBoost || 0.5,
    }

    const score = clamp01(
      priceFactor * 0.18
        + earnFactor * 0.16
        + redeemFactor * 0.1
        + factors.membership_benefits * 0.12
        + upgradeFactor * 0.1
        + preferenceFactor * 0.12
        + historyFactor * 0.08
        + conversationFactor * 0.06
        + (airlineBoost || 0.5) * 0.08,
    )

    const benefitsApplied = [...discount.benefitsApplied]
    if (this.benefits.upgradeEligible(tier, candidate)) benefitsApplied.push('free_upgrades')
    if (this.benefits.hasBenefit(tier, 'bonus_points')) benefitsApplied.push('bonus_points')

    const reasons = [
      `Net cost ${netCashCost} ${candidate.currency}`,
      `Earn ~${candidate.estimatedRahhalPoints} Rahhal Points`,
      redeemPoints > 0 ? `Redeem ${redeemPoints} points` : null,
      discount.discountPercent > 0 ? `${discount.discountPercent}% member discount` : null,
      preferenceFactor > 0.75 ? 'Matches traveler preferences' : null,
      this.benefits.upgradeEligible(tier, candidate) ? 'Upgrade eligible with membership' : null,
    ].filter(Boolean) as string[]

    return {
      candidate,
      rank: 0,
      score,
      factors,
      reasons,
      explanation: '',
      netCashCost,
      pointsEarned: candidate.estimatedRahhalPoints,
      pointsRedeemed: redeemPoints,
      membershipBenefitsApplied: benefitsApplied,
    }
  }
}

export function createLoyaltyRecommendationEngine(input: {
  wallet: PointsWallet
  membership: MembershipEngine
  benefits: BenefitsEngine
  airlines: AirlineLoyaltyStore
  hotels: HotelLoyaltyRegistry
}): LoyaltyRecommendationEngine {
  return new LoyaltyRecommendationEngine(input)
}

function preferenceScore(candidate: LoyaltyCandidate, context: LoyaltyRecommendationContext): number {
  const airlines = context.preferredAirlines ?? []
  const hotels = context.preferredHotels ?? []
  const prefs = context.travelerPreferences ?? []
  const hay = `${candidate.title} ${candidate.providerId} ${candidate.brandOrAirline ?? ''}`.toLowerCase()
  const hit =
    airlines.some((a) => hay.includes(a.toLowerCase()))
    || hotels.some((h) => hay.includes(h.toLowerCase()))
    || prefs.some((p) => hay.includes(p.toLowerCase()))
  if (hit) return 0.95
  if (!airlines.length && !hotels.length && !prefs.length) return 0.7
  return 0.45
}

function historyScore(candidate: LoyaltyCandidate, context: LoyaltyRecommendationContext): number {
  const history = context.previousHistory ?? []
  if (!history.length) return 0.7
  const hay = `${candidate.title} ${candidate.providerId}`.toLowerCase()
  return history.some((h) => hay.includes(h.toLowerCase())) ? 0.9 : 0.55
}

function explain(row: ScoredLoyaltyRecommendation, rank: number): string {
  return [
    `Rank #${rank}: ${row.candidate.title}`,
    `Score ${(row.score * 100).toFixed(0)}%`,
    `Net ${row.netCashCost} ${row.candidate.currency}`,
    `Earn ${row.pointsEarned} pts`,
    ...row.reasons.slice(0, 3),
  ].join('. ')
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
