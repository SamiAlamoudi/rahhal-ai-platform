/**
 * Sprint 37 — AI Decision Engine (deterministic ranking of recovery plans).
 */

import type {
  DetectedDisruption,
  DisruptionContext,
  PassengerImpact,
  RankedRecoveryPlan,
  RecoveryOption,
} from './types'

export class RecoveryRanker {
  /**
   * Compose options into ranked plans and score by cost, arrival, disruption,
   * preferences, loyalty, cabin, hotel rating, traveler type, visa, context.
   */
  rank(
    options: RecoveryOption[],
    disruption: DetectedDisruption,
    context: DisruptionContext,
    impact: PassengerImpact,
  ): RankedRecoveryPlan[] {
    const plans = composePlans(options, disruption, context)
    const scored = plans.map((plan) => scorePlan(plan, disruption, context, impact))
    scored.sort((a, b) => b.score - a.score || a.totalExtraCost - b.totalExtraCost)
    return scored.map((plan, index) => ({
      ...plan,
      rank: index + 1,
      explanation: explainPlan(plan, index + 1),
    }))
  }
}

export function createRecoveryRanker(): RecoveryRanker {
  return new RecoveryRanker()
}

function composePlans(
  options: RecoveryOption[],
  disruption: DetectedDisruption,
  context: DisruptionContext,
): RankedRecoveryPlan[] {
  const byKind = (kind: RecoveryOption['kind']) => options.filter((o) => o.kind === kind)
  const flights = byKind('alternative_flight')
  const routes = byKind('alternative_route')
  const hotels = byKind('alternative_hotel')
  const transport = byKind('alternative_transport')
  const activities = byKind('alternative_activity')
  const cars = byKind('alternative_car')

  const bundles: RecoveryOption[][] = []

  // Plan A: cheapest protection (prefer zero-cost flight + transport + activity shift)
  const cheapFlight = [...flights].sort((a, b) => a.extraCost - b.extraCost)[0]
  if (cheapFlight) {
    bundles.push(
      [cheapFlight, transport[0], activities[0], hotels[0]].filter(Boolean) as RecoveryOption[],
    )
  }

  // Plan B: earliest arrival (max delay reduction)
  const fastFlight = [...flights, ...routes].sort(
    (a, b) => b.delayReductionMinutes - a.delayReductionMinutes,
  )[0]
  if (fastFlight) {
    bundles.push(
      [fastFlight, transport[0], hotels[0]].filter(Boolean) as RecoveryOption[],
    )
  }

  // Plan C: minimum disruption / preference aligned
  const preferred = options.filter((o) =>
    (context.preferredAirlines ?? []).some((a) =>
      o.providerId.toLowerCase().includes(a.toLowerCase()),
    )
    || (context.preferredHotels ?? []).some((h) =>
      o.providerId.toLowerCase().includes(h.toLowerCase())
      || o.title.toLowerCase().includes(h.toLowerCase()),
    ),
  )
  if (preferred.length) {
    bundles.push(uniqueOptions([...preferred, transport[0]].filter(Boolean) as RecoveryOption[]))
  }

  // Hotel-only / car-only disruptions
  if (disruption.eventType.startsWith('hotel_') && hotels[0]) {
    bundles.push([hotels[0]])
  }
  if (disruption.eventType === 'car_unavailable' && cars[0]) {
    bundles.push([cars[0], transport[0]].filter(Boolean) as RecoveryOption[])
  }
  if (disruption.eventType === 'activity_cancelled' && activities[0]) {
    bundles.push([activities[0]])
  }

  if (!bundles.length && options.length) {
    bundles.push(options.slice(0, 3))
  }

  return bundles.map((opts, i) => {
    const currency = context.currency || opts[0]?.currency || 'SAR'
    const totalExtraCost = round2(opts.reduce((s, o) => s + o.extraCost, 0))
    const estimatedDelayMinutes = Math.max(
      0,
      disruption.delayMinutes - Math.max(...opts.map((o) => o.delayReductionMinutes), 0),
    )
    const confidenceScore = clamp01(
      opts.reduce((s, o) => s + o.confidence, 0) / Math.max(1, opts.length),
    )
    return {
      planId: `rp_${i}_${Math.random().toString(36).slice(2, 7)}`,
      rank: 0,
      title: titleFor(opts, i),
      options: opts,
      totalExtraCost,
      currency,
      estimatedDelayMinutes,
      confidenceScore,
      score: 0,
      factors: {},
      reasons: [],
      explanation: '',
    }
  })
}

function scorePlan(
  plan: RankedRecoveryPlan,
  disruption: DetectedDisruption,
  context: DisruptionContext,
  impact: PassengerImpact,
): RankedRecoveryPlan {
  const lowestCost = 1 - Math.min(1, plan.totalExtraCost / 600)
  const earliestArrival = 1 - Math.min(1, plan.estimatedDelayMinutes / 720)
  const minDisruption = 1 - Math.min(1, impact.stressScore)
  const preferences = preferenceScore(plan, context)
  const loyalty = loyaltyScore(plan, context)
  const cabin = cabinScore(plan, context)
  const hotelRating = hotelScore(plan, context)
  const travelerType = travelerScore(plan, context, impact)
  const visa = context.visaRestricted ? (plan.options.some((o) => o.kind === 'alternative_route') ? 0.5 : 0.85) : 1
  const conversationContext = context.conversationNotes?.length
    ? 0.9
    : 0.75

  const factors = {
    lowest_total_cost: lowestCost,
    earliest_arrival: earliestArrival,
    minimum_disruption: minDisruption,
    traveler_preferences: preferences,
    loyalty_programs: loyalty,
    cabin_class: cabin,
    hotel_rating: hotelRating,
    family_business_traveler: travelerType,
    visa_restrictions: visa,
    conversation_context: conversationContext,
  }

  const score = clamp01(
    lowestCost * 0.18
      + earliestArrival * 0.18
      + minDisruption * 0.12
      + preferences * 0.12
      + loyalty * 0.08
      + cabin * 0.08
      + hotelRating * 0.08
      + travelerType * 0.08
      + visa * 0.04
      + conversationContext * 0.04,
  )

  const reasons = [
    plan.totalExtraCost === 0 ? 'No extra cost' : `Extra cost ${plan.totalExtraCost} ${plan.currency}`,
    `Residual delay ~${plan.estimatedDelayMinutes} min`,
    preferences > 0.7 ? 'Aligned with traveler preferences' : null,
    loyalty > 0.7 ? 'Loyalty program friendly' : null,
    context.businessTravel ? 'Optimized for business timing' : null,
    context.familyTravel || context.travelerProfile === 'family'
      ? 'Family-friendly recovery'
      : null,
    disruption.severity === 'critical' ? 'Prioritized safety-critical recovery' : null,
  ].filter(Boolean) as string[]

  return { ...plan, score, factors, reasons }
}

function preferenceScore(plan: RankedRecoveryPlan, context: DisruptionContext): number {
  const airlines = context.preferredAirlines ?? []
  const hotels = context.preferredHotels ?? []
  if (!airlines.length && !hotels.length) return 0.7
  const hit = plan.options.some((o) =>
    airlines.some((a) => o.providerId.toLowerCase().includes(a.toLowerCase()) || o.title.toLowerCase().includes(a.toLowerCase()))
    || hotels.some((h) => o.title.toLowerCase().includes(h.toLowerCase()) || o.providerId.toLowerCase().includes(h.toLowerCase())),
  )
  return hit ? 0.95 : 0.55
}

function loyaltyScore(plan: RankedRecoveryPlan, context: DisruptionContext): number {
  const programs = context.loyaltyPrograms ?? []
  if (!programs.length) return 0.7
  const hit = plan.options.some((o) =>
    programs.some((p) => o.title.toLowerCase().includes(p.toLowerCase()) || String(o.metadata.loyalty ?? '').toLowerCase().includes(p.toLowerCase())),
  )
  return hit ? 0.9 : 0.65
}

function cabinScore(plan: RankedRecoveryPlan, context: DisruptionContext): number {
  if (!context.cabinClass) return 0.75
  const hit = plan.options.some(
    (o) => String(o.metadata.cabinClass ?? '').toLowerCase() === context.cabinClass!.toLowerCase(),
  )
  return hit ? 0.95 : 0.6
}

function hotelScore(plan: RankedRecoveryPlan, context: DisruptionContext): number {
  const want = context.hotelStars ?? 0
  if (!want) return 0.75
  const stars = plan.options
    .filter((o) => o.kind === 'alternative_hotel')
    .map((o) => Number(o.metadata.stars ?? 0))
  if (!stars.length) return 0.7
  const best = Math.max(...stars)
  return clamp01(1 - Math.abs(best - want) * 0.15)
}

function travelerScore(
  plan: RankedRecoveryPlan,
  context: DisruptionContext,
  impact: PassengerImpact,
): number {
  if (context.businessTravel || context.travelerProfile === 'business') {
    return plan.estimatedDelayMinutes <= 120 ? 0.95 : 0.6
  }
  if (context.familyTravel || context.travelerProfile === 'family') {
    return plan.totalExtraCost <= 200 && !impact.connectionAtRisk ? 0.9 : 0.7
  }
  return 0.75
}

function titleFor(opts: RecoveryOption[], index: number): string {
  if (opts.some((o) => o.extraCost === 0) && opts.every((o) => o.extraCost === 0)) {
    return 'Zero-cost protection plan'
  }
  if (opts.some((o) => o.kind === 'alternative_route')) return 'Fastest alternate route'
  if (index === 0) return 'Balanced recovery plan'
  return `Recovery plan ${index + 1}`
}

function explainPlan(plan: RankedRecoveryPlan, rank: number): string {
  return [
    `Rank #${rank}: ${plan.title}`,
    `Extra cost ${plan.totalExtraCost} ${plan.currency}`,
    `Estimated remaining delay ${plan.estimatedDelayMinutes} minutes`,
    `Confidence ${(plan.confidenceScore * 100).toFixed(0)}%`,
    ...plan.reasons.slice(0, 3),
  ].join('. ')
}

function uniqueOptions(options: RecoveryOption[]): RecoveryOption[] {
  const seen = new Set<string>()
  const out: RecoveryOption[] = []
  for (const o of options) {
    if (seen.has(o.optionId)) continue
    seen.add(o.optionId)
    out.push(o)
  }
  return out
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
