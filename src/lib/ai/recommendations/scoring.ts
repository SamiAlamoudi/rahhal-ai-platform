/**
 * Phase AC — deterministic recommendation scoring components.
 */

import type { PersonalizationProfile, PreferenceWeights } from '../preferences/types'
import type {
  RecommendationCandidateInput,
  RecommendationContext,
  RecommendationReason,
  RecommendationScore,
  RecommendationScoreComponents,
  SeasonName,
} from './models'

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n))
}

export function seasonFromMonth(month: number | null): SeasonName | null {
  if (month == null || month < 1 || month > 12) return null
  if (month === 12 || month <= 2) return 'winter'
  if (month <= 5) return 'spring'
  if (month <= 8) return 'summer'
  return 'autumn'
}

export function resolveSeason(context: RecommendationContext): SeasonName | null {
  return context.season ?? seasonFromMonth(context.travelMonth)
}

function destinationPopularityScore(
  candidate: RecommendationCandidateInput,
  context: RecommendationContext,
): number {
  if (candidate.popularity != null) return clamp01(candidate.popularity)
  const dest = (candidate.destination ?? context.destination).toLowerCase()
  const popular = (context.popularDestinations ?? context.destinations).map((d) => d.toLowerCase())
  if (popular.includes(dest)) return 0.85
  if (context.destinations.map((d) => d.toLowerCase()).includes(dest)) return 0.7
  return 0.45
}

function budgetFitScore(
  candidate: RecommendationCandidateInput,
  context: RecommendationContext,
  profile: PersonalizationProfile | null,
): number {
  const budget = context.budgetAmount
    ?? profile?.budget.typicalTripBudget
    ?? null
  if (budget == null || candidate.estimatedCost == null) return 0.55
  const cost = candidate.estimatedCost
  if (cost <= budget * 0.7) return 0.95
  if (cost <= budget) return 0.8
  if (cost <= budget * 1.15) return 0.55
  if (cost <= budget * 1.4) return 0.35
  return 0.15
}

function travelStyleScore(
  candidate: RecommendationCandidateInput,
  context: RecommendationContext,
  profile: PersonalizationProfile | null,
): number {
  const style = (context.travelStyle ?? profile?.travelStyle.style ?? '').toLowerCase()
  if (!style) return 0.5
  const tags = [
    ...(candidate.travelStyles ?? []),
    ...(candidate.tags ?? []),
  ].map((t) => t.toLowerCase())
  if (tags.includes(style)) return 0.95
  if (style.includes('budget') && tags.some((t) => t.includes('budget') || t.includes('value'))) return 0.85
  if (style.includes('luxury') && tags.some((t) => t.includes('luxury') || t.includes('comfort'))) return 0.85
  if (style.includes('adventure') && tags.some((t) => t.includes('adventure') || t.includes('outdoor'))) return 0.85
  if (style.includes('cultural') && tags.some((t) => t.includes('culture') || t.includes('museum'))) return 0.85
  return 0.4
}

function seasonalityScore(
  candidate: RecommendationCandidateInput,
  context: RecommendationContext,
): number {
  const season = resolveSeason(context)
  if (!season) return 0.55
  const tags = candidate.seasonalityTags ?? []
  if (!tags.length) return 0.5
  if (tags.includes(season)) return 0.95
  return 0.3
}

function durationScore(
  candidate: RecommendationCandidateInput,
  context: RecommendationContext,
): number {
  const tripDays = context.tripDurationDays
  if (tripDays == null) return 0.55
  const itemDays = candidate.durationDays
  if (itemDays == null) {
    // itinerary without duration inherits trip length fitness
    return candidate.kind === 'itinerary' || candidate.kind === 'destination' ? 0.7 : 0.55
  }
  const delta = Math.abs(itemDays - tripDays)
  if (delta === 0) return 1
  if (delta === 1) return 0.85
  if (delta <= 2) return 0.65
  if (delta <= 4) return 0.4
  return 0.2
}

function travelerPreferenceScore(
  candidate: RecommendationCandidateInput,
  context: RecommendationContext,
  profile: PersonalizationProfile | null,
): { score: number; matched: string[]; unmatched: string[] } {
  const matched: string[] = []
  const unmatched: string[] = []
  let hits = 0
  let checks = 0

  const travelerType = context.travelerType
    ?? profile?.traveler.travelerTypes[0]
    ?? null
  if (travelerType) {
    checks += 1
    const ok = (candidate.travelerTypes ?? []).includes(travelerType)
      || (candidate.tags ?? []).map((t) => t.toLowerCase()).includes(travelerType)
    if (ok) {
      hits += 1
      matched.push(`travelerType:${travelerType}`)
    } else {
      unmatched.push(`travelerType:${travelerType}`)
    }
  }

  const interests = [
    ...context.interests,
    ...(profile?.travelStyle.interests ?? []),
  ].map((i) => i.toLowerCase())
  const tags = (candidate.tags ?? []).map((t) => t.toLowerCase())
  for (const interest of [...new Set(interests)].slice(0, 6)) {
    checks += 1
    if (tags.includes(interest) || candidate.title.toLowerCase().includes(interest)) {
      hits += 1
      matched.push(`interest:${interest}`)
    } else {
      unmatched.push(`interest:${interest}`)
    }
  }

  if (profile?.airline.preferDirect && candidate.kind === 'flight') {
    checks += 1
    const direct = tags.includes('direct') || tags.includes('nonstop')
    if (direct) {
      hits += 1
      matched.push('airline:preferDirect')
    } else {
      unmatched.push('airline:preferDirect')
    }
  }

  if (profile?.hotel.preferCentral && candidate.kind === 'hotel') {
    checks += 1
    const central = tags.includes('central') || tags.includes('downtown')
    if (central) {
      hits += 1
      matched.push('hotel:preferCentral')
    } else {
      unmatched.push('hotel:preferCentral')
    }
  }

  if (checks === 0) return { score: 0.5, matched, unmatched }
  return { score: clamp01(hits / checks), matched, unmatched }
}

const COMPONENT_WEIGHTS = {
  travelerPreferences: 0.22,
  destinationPopularity: 0.15,
  budgetFit: 0.2,
  travelStyle: 0.18,
  seasonality: 0.12,
  tripDuration: 0.13,
} as const

export interface ScoredCandidate {
  candidate: RecommendationCandidateInput
  components: RecommendationScoreComponents
  overall01: number
  confidence: number
  reasons: RecommendationReason[]
  matchedPreferences: string[]
  unmatchedPreferences: string[]
}

export function scoreCandidate(
  candidate: RecommendationCandidateInput,
  context: RecommendationContext,
  profile: PersonalizationProfile | null,
  weights?: PreferenceWeights,
): ScoredCandidate {
  const traveler = travelerPreferenceScore(candidate, context, profile)
  const components: RecommendationScoreComponents = {
    travelerPreferences: traveler.score,
    destinationPopularity: destinationPopularityScore(candidate, context),
    budgetFit: budgetFitScore(candidate, context, profile),
    travelStyle: travelStyleScore(candidate, context, profile),
    seasonality: seasonalityScore(candidate, context),
    tripDuration: durationScore(candidate, context),
  }

  // Blend component weights with optional profile preference weights on personalization axis.
  const personalizationBoost = weights?.personalization ?? 0.1
  const overall01 = clamp01(
    components.travelerPreferences * COMPONENT_WEIGHTS.travelerPreferences
    + components.destinationPopularity * COMPONENT_WEIGHTS.destinationPopularity
    + components.budgetFit * COMPONENT_WEIGHTS.budgetFit
    + components.travelStyle * COMPONENT_WEIGHTS.travelStyle
    + components.seasonality * COMPONENT_WEIGHTS.seasonality
    + components.tripDuration * COMPONENT_WEIGHTS.tripDuration
    + (candidate.baseScore != null ? clamp01(candidate.baseScore > 1 ? candidate.baseScore / 100 : candidate.baseScore) * personalizationBoost * 0.5 : 0),
  )

  const confidence = clamp01(
    (components.travelerPreferences
      + components.budgetFit
      + components.travelStyle
      + (components.seasonality > 0.5 ? components.seasonality : 0.5)) / 4,
  )

  const reasons = buildReasons(components, context, candidate)
  return {
    candidate,
    components,
    overall01,
    confidence,
    reasons,
    matchedPreferences: traveler.matched,
    unmatchedPreferences: traveler.unmatched,
  }
}

function buildReasons(
  components: RecommendationScoreComponents,
  context: RecommendationContext,
  candidate: RecommendationCandidateInput,
): RecommendationReason[] {
  const ar = context.locale === 'ar'
  const reasons: RecommendationReason[] = []
  const push = (
    category: RecommendationReason['category'],
    code: string,
    weight: number,
    en: string,
    arMsg: string,
  ) => {
    reasons.push({
      code,
      category,
      weight: Number(weight.toFixed(3)),
      message: ar ? arMsg : en,
    })
  }

  if (components.travelerPreferences >= 0.6) {
    push('traveler', 'traveler_match', components.travelerPreferences,
      'Matches traveler preferences', 'يتوافق مع تفضيلات المسافر')
  }
  if (components.destinationPopularity >= 0.7) {
    push('destination', 'popular_destination', components.destinationPopularity,
      `Strong destination fit for ${candidate.destination ?? context.destination}`,
      `ملاءمة قوية للوجهة ${candidate.destination ?? context.destination}`)
  }
  if (components.budgetFit >= 0.7) {
    push('budget', 'budget_fit', components.budgetFit,
      'Fits the stated budget', 'يناسب الميزانية المحددة')
  } else if (components.budgetFit < 0.4) {
    push('budget', 'budget_stretch', components.budgetFit,
      'May stretch the stated budget', 'قد يتجاوز الميزانية المحددة')
  }
  if (components.travelStyle >= 0.7) {
    push('travel_style', 'style_match', components.travelStyle,
      'Aligns with travel style', 'يتوافق مع أسلوب السفر')
  }
  if (components.seasonality >= 0.8) {
    push('seasonality', 'season_match', components.seasonality,
      'Suitable for the travel season', 'مناسب لموسم السفر')
  }
  if (components.tripDuration >= 0.8) {
    push('duration', 'duration_match', components.tripDuration,
      'Matches trip duration', 'يتوافق مع مدة الرحلة')
  }
  if (!reasons.length) {
    push('other', 'baseline', 0.5,
      'Baseline recommendation score', 'درجة توصية أساسية')
  }
  return reasons.sort((a, b) => b.weight - a.weight || a.code.localeCompare(b.code))
}

export function toRecommendationScore(scored: ScoredCandidate): RecommendationScore {
  return {
    overall: clamp100(Number((scored.overall01 * 100).toFixed(2))),
    components: {
      travelerPreferences: Number((scored.components.travelerPreferences * 100).toFixed(2)),
      destinationPopularity: Number((scored.components.destinationPopularity * 100).toFixed(2)),
      budgetFit: Number((scored.components.budgetFit * 100).toFixed(2)),
      travelStyle: Number((scored.components.travelStyle * 100).toFixed(2)),
      seasonality: Number((scored.components.seasonality * 100).toFixed(2)),
      tripDuration: Number((scored.components.tripDuration * 100).toFixed(2)),
    },
    confidence: Number(scored.confidence.toFixed(4)),
  }
}
