/**
 * Phase AF — deterministic recommendation candidate seeding from trip request.
 * Does not score candidates; RecommendationEngine owns scoring/ranking.
 */

import type { RecommendationCandidateInput } from '../recommendations/models'
import type { TripPlannerRequest } from './models'
import { resolveCurrency, resolveDurationDays } from './validation'

function hashSeed(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

function unit(seed: number, salt: number): number {
  const x = Math.sin(seed * 0.001 + salt * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Build a stable candidate set from destinations / style / duration.
 * Scoring is deferred entirely to RecommendationEngine.recommendV1.
 */
export function buildRecommendationCandidates(
  request: TripPlannerRequest,
): RecommendationCandidateInput[] {
  const destinations = request.destinations.map((d) => d.trim()).filter(Boolean)
  const primary = destinations[0] ?? 'Destination'
  const duration = resolveDurationDays(request)
  const currency = resolveCurrency(request)
  const budget = request.budget?.amount ?? null
  const style = (request.travelStyle ?? request.explicitPreferences?.travelStyle ?? 'balanced')
    .toString()
    .toLowerCase()
  const interests = request.explicitPreferences?.interests ?? []
  const seed = hashSeed(`${request.idempotencyKey}|${primary}|${duration}|${style}`)

  const baseCost = budget != null ? Math.round(budget * 0.85) : 1500 + duration * 180
  const travelerType = request.travelers.travelerType ?? request.explicitPreferences?.travelerType ?? null

  const candidates: RecommendationCandidateInput[] = [
    {
      id: `cand_${primary.toLowerCase().replace(/\s+/g, '_')}_culture`,
      kind: 'itinerary',
      title: `${primary} Cultural Discovery`,
      estimatedCost: Math.round(baseCost * (0.9 + unit(seed, 1) * 0.1)),
      currency,
      durationDays: duration,
      popularity: 0.82 + unit(seed, 2) * 0.1,
      seasonalityTags: ['spring', 'autumn'],
      travelStyles: ['cultural', 'balanced', style],
      travelerTypes: travelerType ? [travelerType] : ['couple', 'solo', 'family'],
      tags: [...new Set(['culture', 'museum', ...interests])],
      destination: primary,
      baseScore: 78,
    },
    {
      id: `cand_${primary.toLowerCase().replace(/\s+/g, '_')}_adventure`,
      kind: 'itinerary',
      title: `${primary} Adventure Highlights`,
      estimatedCost: Math.round(baseCost * (1.05 + unit(seed, 3) * 0.15)),
      currency,
      durationDays: duration,
      popularity: 0.65 + unit(seed, 4) * 0.2,
      seasonalityTags: ['summer', 'spring'],
      travelStyles: ['adventure', 'packed', style],
      travelerTypes: ['friends', 'solo', 'couple'],
      tags: [...new Set(['adventure', 'outdoor', ...interests])],
      destination: primary,
      baseScore: 72,
    },
    {
      id: `cand_${primary.toLowerCase().replace(/\s+/g, '_')}_budget`,
      kind: 'itinerary',
      title: `${primary} Value Stay`,
      estimatedCost: Math.round(baseCost * (0.55 + unit(seed, 5) * 0.1)),
      currency,
      durationDays: duration,
      popularity: 0.7 + unit(seed, 6) * 0.15,
      seasonalityTags: ['winter', 'autumn'],
      travelStyles: ['budget', 'balanced', style],
      travelerTypes: travelerType ? [travelerType] : ['solo', 'friends'],
      tags: [...new Set(['budget', 'food', ...interests])],
      destination: primary,
      baseScore: 70,
    },
  ]

  if (destinations.length > 1) {
    const secondary = destinations[1]!
    candidates.push({
      id: `cand_multi_${secondary.toLowerCase().replace(/\s+/g, '_')}`,
      kind: 'destination',
      title: `${primary} + ${secondary} Dual City`,
      estimatedCost: Math.round(baseCost * 1.15),
      currency,
      durationDays: duration,
      popularity: 0.75,
      seasonalityTags: ['spring', 'autumn', 'summer'],
      travelStyles: ['cultural', 'balanced', style],
      travelerTypes: travelerType ? [travelerType] : ['couple', 'friends'],
      tags: [...new Set(['multi-city', 'culture', ...interests])],
      destination: secondary,
      baseScore: 76,
    })
  }

  // Activity seeds — still scored by RecommendationEngine
  for (const interest of interests.slice(0, 3)) {
    candidates.push({
      id: `cand_act_${interest.toLowerCase().replace(/\s+/g, '_')}`,
      kind: 'activity',
      title: `${interest} experience in ${primary}`,
      estimatedCost: Math.round(40 + unit(seed, interest.length) * 80),
      currency,
      durationDays: 1,
      popularity: 0.6 + unit(seed, interest.length + 7) * 0.3,
      travelStyles: [style],
      travelerTypes: travelerType ? [travelerType] : undefined,
      tags: [interest, 'activity'],
      destination: primary,
      baseScore: 65,
    })
  }

  return candidates
}
