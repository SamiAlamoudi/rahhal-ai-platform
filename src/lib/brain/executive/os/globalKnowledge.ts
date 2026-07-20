/**
 * Sprint 52 — Global Knowledge Engine data model.
 * Structured destination intelligence derived from the reasoning catalog.
 */

import {
  DESTINATION_CATALOG,
  findDestinationProfile,
} from '../../../agent/reasoning/destinationCatalog'
import type { DestinationClimateProfile } from '../../../agent/reasoning/types'
import { cacheWrap } from './computationCache'
import type { DestinationIntelligence } from './types'

export function buildDestinationIntelligence(
  profile: DestinationClimateProfile,
  month?: number | null,
): DestinationIntelligence {
  const monthIndex = month != null ? Math.max(0, Math.min(11, month - 1)) : new Date().getMonth()
  const climate = profile.climateByMonth[monthIndex] ?? 'mild'
  const tags = new Set(profile.bestFor)
  const risks = profile.risks

  const visaEase =
    profile.visaFromSaudi === 'visa_free' ? 0.95
      : profile.visaFromSaudi === 'visa_on_arrival' ? 0.85
        : profile.visaFromSaudi === 'evisa' ? 0.7
          : 0.35

  const riskScore = clamp01(
    0.15
    + (risks.some((r) => r.includes('visa') || r.includes('schengen')) ? 0.2 : 0)
    + (risks.some((r) => r.includes('high_cost')) ? 0.1 : 0)
    + (risks.some((r) => r.includes('weather') || r.includes('mountain') || r.includes('storm')) ? 0.15 : 0)
    + (risks.some((r) => r.includes('busy') || r.includes('crowd')) ? 0.1 : 0),
  )

  return {
    id: profile.id,
    nameEn: profile.nameEn,
    nameAr: profile.nameAr,
    region: profile.region,
    weather: climate,
    visa: profile.visaFromSaudi,
    safety: clamp01(0.9 - riskScore * 0.5),
    crowdedness: tags.has('city') || tags.has('shopping') ? 0.7 : 0.4,
    seasonality: climate,
    food: tags.has('food') ? 0.85 : 0.55,
    transportation: profile.flightHoursFromRiyadh <= 5 ? 0.8 : 0.55,
    internet: tags.has('city') || tags.has('business') ? 0.85 : 0.65,
    familyFriendliness: tags.has('family') ? 0.9 : tags.has('romance') ? 0.45 : 0.6,
    luxuryScore: profile.dailyBudgetSar.high >= 1800 ? 0.85 : profile.dailyBudgetSar.high >= 1200 ? 0.65 : 0.4,
    businessScore: tags.has('city') || tags.has('business') ? 0.8 : 0.4,
    nightlife: tags.has('city') || tags.has('shopping') ? 0.7 : 0.35,
    nature: tags.has('nature') || tags.has('adventure') || tags.has('beach') ? 0.85 : 0.35,
    shopping: tags.has('shopping') ? 0.9 : 0.45,
    adventure: tags.has('adventure') ? 0.9 : 0.4,
    medicalAccess: tags.has('city') ? 0.8 : 0.55,
    religionFriendliness: 0.85,
    languageDifficulty: profile.region.includes('Europe') ? 0.55 : 0.35,
    averageDailyCostSar: profile.dailyBudgetSar.mid,
    politicalStability: clamp01(0.88 - riskScore * 0.3),
    tourismPopularity: tags.has('culture') || tags.has('city') ? 0.8 : 0.55,
    airportQuality: profile.flightHoursFromRiyadh <= 4 ? 0.75 : 0.65,
    flightAccessibility: clamp01(1 - profile.flightHoursFromRiyadh / 20),
    environmental: tags.has('nature') ? 0.8 : 0.55,
    riskScore,
  }
}

export function getAllDestinationIntelligence(month?: number | null): DestinationIntelligence[] {
  const key = `dest-intel:${month ?? 'now'}`
  return cacheWrap(key, 120_000, () =>
    DESTINATION_CATALOG.map((profile) => buildDestinationIntelligence(profile, month)))
}

export function getDestinationIntelligence(
  nameOrId: string,
  month?: number | null,
): DestinationIntelligence | null {
  const profile = findDestinationProfile(nameOrId)
  if (!profile) return null
  return buildDestinationIntelligence(profile, month)
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
