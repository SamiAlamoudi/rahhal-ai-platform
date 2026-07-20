/**
 * Conversational recommendation bridge.
 *
 * Uses Phase AB RecommendationEngine only — never live supplier catalogs.
 * Candidates are consultant framing options derived from agent requirements
 * + soft signals. Provider ranking/search stays outside Concierge.
 */

import type { AgentLocale, TripRequirements } from '../agent/types'
import {
  createRecommendationEngine,
  type RecommendationEngine,
  type RecommendationResult,
} from '../ai'
import type { ConciergeSoftSignals } from './types'

export interface ConciergeRecommendationInput {
  locale: AgentLocale
  requirements: TripRequirements
  softSignals: ConciergeSoftSignals
  engine?: RecommendationEngine
}

export interface ConciergeRecommendationView {
  optionLines: string[]
  overallConfidence: number
  explanations: string[]
  /** Raw AB result for tests/meta — still provider-agnostic. */
  result: RecommendationResult
}

export function buildConciergeRecommendations(
  input: ConciergeRecommendationInput,
): ConciergeRecommendationView {
  const engine = input.engine ?? createRecommendationEngine()
  const destination = input.requirements.destination
    || input.requirements.destinations[0]
    || (input.locale === 'ar' ? 'وجهتك' : 'your trip')

  const candidates = buildFramingCandidates(input)
  const result = engine.recommend({
    destination,
    destinations: input.requirements.destinations,
    locale: input.locale,
    maxResults: 3,
    candidates,
  })

  const ordered = [
    result.primary,
    ...result.alternatives,
  ].filter((row): row is NonNullable<typeof row> => Boolean(row))

  const optionLines = ordered.slice(0, 3).map((row) => {
    const why = row.whySelected[0]
    return why ? `${row.title} — ${why}` : row.title
  })

  return {
    optionLines,
    overallConfidence: result.overallConfidence,
    explanations: result.explanations,
    result,
  }
}

function buildFramingCandidates(input: ConciergeRecommendationInput) {
  const { requirements, softSignals, locale } = input

  // Sprint 45 — when open-ended discovery filled destination suggestions, frame those.
  if (
    requirements.destinationFlexible
    && !requirements.destination
    && requirements.destinations.length > 0
  ) {
    return requirements.destinations.slice(0, 3).map((name, index) => ({
      id: `dest-${index}-${name.toLowerCase().replace(/\s+/g, '-')}`,
      kind: 'itinerary' as const,
      title: locale === 'ar' ? `وجهة مقترحة: ${name}` : `Suggested destination: ${name}`,
      baseScore: 0.9 - index * 0.08,
      comfort: 0.75,
      price: requirements.budgetAmount ?? null,
      rating: 0.8,
    }))
  }

  const dest = requirements.destination || requirements.destinations[0] || ''
  const label = dest || (locale === 'ar' ? 'الرحلة' : 'Trip')
  const comfortBias = softSignals.pace === 'relaxed'
    || requirements.budgetStyle === 'luxury'
    || softSignals.mustHaves.includes('beach')
  const cultureBias = softSignals.mustHaves.includes('culture')
    || requirements.interests.includes('culture')
  const valueBias = requirements.budgetStyle === 'budget'
    || softSignals.flexibleDimensions.includes('budget')

  return [
    {
      id: 'frame-comfort',
      kind: 'itinerary' as const,
      title: locale === 'ar'
        ? `${label}: راحة أولاً`
        : `${label}: comfort-first`,
      baseScore: comfortBias ? 0.92 : 0.7,
      comfort: comfortBias ? 0.95 : 0.65,
      price: requirements.budgetAmount ?? null,
      rating: 0.85,
    },
    {
      id: 'frame-balanced',
      kind: 'itinerary' as const,
      title: locale === 'ar'
        ? `${label}: توازن معالم وتجارب`
        : `${label}: balanced landmarks & local`,
      baseScore: cultureBias ? 0.9 : 0.82,
      comfort: 0.75,
      timeEfficiency: softSignals.pace === 'packed' ? 0.9 : 0.7,
      rating: 0.8,
    },
    {
      id: 'frame-value',
      kind: 'itinerary' as const,
      title: locale === 'ar'
        ? `${label}: قيمة ومرونة ميزانية`
        : `${label}: value & budget flexibility`,
      baseScore: valueBias ? 0.88 : 0.68,
      price: requirements.budgetAmount != null
        ? Math.max(0, requirements.budgetAmount * 0.75)
        : 500,
      comfort: 0.55,
      rating: 0.7,
    },
  ]
}
