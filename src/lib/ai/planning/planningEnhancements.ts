/**
 * Phase AB — AI planning improvements (foundation helpers).
 * Additive APIs; does not change TripPlan / applyIntelligentDecisions signatures.
 */

import type { PreferenceWeights, PersonalizationProfile } from '../preferences/types'
import type {
  AlternativeItineraryVariant,
  ExplainableRecommendation,
  MultiDestinationOutline,
  MultiDestinationPlanInput,
  PlanningConfidence,
} from './types'

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Distribute nights across destinations for multi-city foundations. */
export function buildMultiDestinationOutline(
  input: MultiDestinationPlanInput,
): MultiDestinationOutline {
  const destinations = [...new Set(input.destinations.map((d) => d.trim()).filter(Boolean))]
  if (destinations.length === 0) {
    return {
      destinations: [],
      segments: [],
      totalNights: Math.max(0, input.durationDays - 1),
      confidence: 0,
    }
  }

  const totalNights = Math.max(destinations.length, input.durationDays - 1)
  const base = Math.floor(totalNights / destinations.length)
  let remainder = totalNights - base * destinations.length
  const interests = input.interests ?? []

  const segments = destinations.map((destination, index) => {
    const extra = remainder > 0 ? 1 : 0
    if (remainder > 0) remainder -= 1
    const nights = Math.max(1, base + extra)
    const focus = interests[index % Math.max(1, interests.length)]
      ?? (input.locale === 'ar' ? 'استكشاف المدينة' : 'City exploration')
    return {
      order: index + 1,
      destination,
      nights,
      focus,
    }
  })

  const confidence = clamp01(0.55 + Math.min(0.35, destinations.length * 0.08))
  return {
    destinations,
    segments,
    totalNights,
    confidence: Number(confidence.toFixed(4)),
  }
}

/** Generate alternative itinerary variants for the same destination set. */
export function generateAlternativeItineraries(input: {
  destinations: string[]
  locale?: 'ar' | 'en'
  budgetStyle?: 'luxury' | 'midrange' | 'budget' | null
}): AlternativeItineraryVariant[] {
  const destLabel = input.destinations.join(' → ') || (input.locale === 'ar' ? 'وجهة' : 'destination')
  const ar = input.locale === 'ar'
  return [
    {
      id: 'alt_balanced',
      label: ar ? 'خطة متوازنة' : 'Balanced plan',
      style: 'balanced',
      summary: ar ? `خطة متوازنة لـ ${destLabel}` : `Balanced plan for ${destLabel}`,
      confidence: 0.78,
      estimatedBudgetDeltaPct: 0,
      reasons: [ar ? 'توازن بين الراحة والتكلفة' : 'Balances comfort and cost'],
    },
    {
      id: 'alt_budget',
      label: ar ? 'خطة اقتصادية' : 'Budget plan',
      style: 'budget',
      summary: ar ? `خطة اقتصادية لـ ${destLabel}` : `Budget-focused plan for ${destLabel}`,
      confidence: input.budgetStyle === 'budget' ? 0.82 : 0.7,
      estimatedBudgetDeltaPct: -15,
      reasons: [ar ? 'تقليل التكاليف وتفضيل العروض' : 'Minimizes cost and prefers value offers'],
    },
    {
      id: 'alt_comfort',
      label: ar ? 'خطة مريحة' : 'Comfort plan',
      style: 'comfort',
      summary: ar ? `خطة مريحة لـ ${destLabel}` : `Comfort-focused plan for ${destLabel}`,
      confidence: input.budgetStyle === 'luxury' ? 0.84 : 0.72,
      estimatedBudgetDeltaPct: 18,
      reasons: [ar ? 'رحلات مباشرة وفنادق مركزية' : 'Prefers direct flights and central hotels'],
    },
    {
      id: 'alt_adventure',
      label: ar ? 'خطة مغامرة' : 'Adventure plan',
      style: 'adventure',
      summary: ar ? `خطة مغامرة لـ ${destLabel}` : `Adventure-focused plan for ${destLabel}`,
      confidence: 0.68,
      estimatedBudgetDeltaPct: 8,
      reasons: [ar ? 'أنشطة أكثر وتنقل أوسع' : 'More activities and broader mobility'],
    },
  ]
}

/** Score planning confidence from coverage + preference fit signals. */
export function scorePlanningConfidence(input: {
  destinationCount: number
  hasBudget: boolean
  hasDates: boolean
  preferenceFit?: number | null
}): PlanningConfidence {
  const destinationCoverage = clamp01(input.destinationCount / 3)
  const budgetFit = input.hasBudget ? 0.8 : 0.45
  const scheduleFeasibility = input.hasDates ? 0.85 : 0.5
  const preferenceFit = clamp01(input.preferenceFit ?? 0.5)
  const overall = clamp01(
    (destinationCoverage * 0.25)
    + (budgetFit * 0.25)
    + (scheduleFeasibility * 0.25)
    + (preferenceFit * 0.25),
  )
  return {
    overall: Number(overall.toFixed(4)),
    destinationCoverage: Number(destinationCoverage.toFixed(4)),
    budgetFit: Number(budgetFit.toFixed(4)),
    preferenceFit: Number(preferenceFit.toFixed(4)),
    scheduleFeasibility: Number(scheduleFeasibility.toFixed(4)),
  }
}

/** Build explainable recommendation payload from scored choice + rejects. */
export function buildExplainableRecommendation(input: {
  subjectId: string
  subjectKind: ExplainableRecommendation['subjectKind']
  whySelected: string[]
  rejectedTitles?: string[]
  confidence: number
  weightsApplied?: boolean
}): ExplainableRecommendation {
  return {
    subjectId: input.subjectId,
    subjectKind: input.subjectKind,
    whySelected: [...input.whySelected],
    whyAlternativesRejected: (input.rejectedTitles ?? []).map(
      (title) => `${title} ranked lower for current preferences`,
    ),
    confidence: clamp01(input.confidence),
    preferenceWeightsApplied: Boolean(input.weightsApplied),
  }
}

/** Apply user preference weights to a base score vector (0–1). */
export function applyPreferenceWeighting(
  scores: {
    price: number
    comfort: number
    time: number
    rating: number
    personalization: number
  },
  weights: PreferenceWeights,
): number {
  const sum = Math.max(
    0.0001,
    weights.price + weights.comfort + weights.time + weights.rating + weights.personalization,
  )
  return Number((
    (scores.price * weights.price
      + scores.comfort * weights.comfort
      + scores.time * weights.time
      + scores.rating * weights.rating
      + scores.personalization * weights.personalization) / sum
  ).toFixed(4))
}

/** Estimate preference fit (0–1) for a profile against declared interests. */
export function estimatePreferenceFit(
  profile: PersonalizationProfile | null | undefined,
  interests: string[],
): number {
  if (!profile) return 0.5
  if (!interests.length) return 0.55
  const overlap = interests.filter((i) =>
    profile.travelStyle.interests.map((x) => x.toLowerCase()).includes(i.toLowerCase()),
  ).length
  return clamp01(0.5 + overlap / Math.max(1, interests.length) * 0.5)
}
