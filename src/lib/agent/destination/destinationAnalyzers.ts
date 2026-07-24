/**
 * Evolution Sprint 7 — domain analyzers over DestinationKnowledgeRecord.
 * Thin, deterministic readouts — no network.
 */

import type { DestinationKnowledgeRecord, MonthlyClimateNote, SeasonQuality } from './destinationTypes'
import { clampScore } from './destinationTypes'

export function analyzeClimate(record: DestinationKnowledgeRecord): {
  patterns: string[]
  byMonth: string[]
  notes: string[]
} {
  return {
    patterns: [...record.weatherPatterns],
    byMonth: [...record.climateByMonth],
    notes: [
      `Climate priors for ${record.nameEn} are offline qualitative patterns.`,
      ...(record.bestSeasons.length
        ? [`Best months: ${record.bestSeasons.join(', ')}.`]
        : []),
    ],
  }
}

export function analyzeSeason(
  record: DestinationKnowledgeRecord,
  monthHint?: number | null,
): {
  best: number[]
  worst: number[]
  monthNotes: MonthlyClimateNote[]
  fitScore: number
  notes: string[]
} {
  const monthNotes: MonthlyClimateNote[] = record.climateByMonth.map((label, i) => {
    const month = i + 1
    let seasonQuality: SeasonQuality = 'mixed'
    if (record.bestSeasons.includes(month)) seasonQuality = 'best'
    else if (record.worstSeasons.includes(month)) seasonQuality = 'worst'
    else if (label === 'mild' || label === 'cool') seasonQuality = 'good'
    else if (label === 'hot' || label === 'rainy') seasonQuality = 'poor'
    return {
      month,
      label,
      crowd: record.crowdByMonth[i] ?? 'unknown',
      seasonQuality,
    }
  })

  let fitScore = 55
  const notes: string[] = []
  if (typeof monthHint === 'number' && monthHint >= 1 && monthHint <= 12) {
    if (record.bestSeasons.includes(monthHint)) {
      fitScore = 90
      notes.push(`Month ${monthHint} is among best seasons.`)
    } else if (record.worstSeasons.includes(monthHint)) {
      fitScore = 25
      notes.push(`Month ${monthHint} is among worst seasons.`)
    } else {
      fitScore = 60
      notes.push(`Month ${monthHint} is neither peak-best nor worst.`)
    }
  } else {
    notes.push('No month hint — season fit is generic.')
  }

  return {
    best: [...record.bestSeasons],
    worst: [...record.worstSeasons],
    monthNotes,
    fitScore: clampScore(fitScore),
    notes,
  }
}

export function analyzeCrowd(record: DestinationKnowledgeRecord, monthHint?: number | null): {
  level: string
  notes: string[]
} {
  if (typeof monthHint === 'number' && monthHint >= 1 && monthHint <= 12) {
    const level = record.crowdByMonth[monthHint - 1] ?? 'unknown'
    return { level, notes: [`Crowd prior for month ${monthHint}: ${level}.`] }
  }
  const peakMonths = record.crowdByMonth
    .map((c, i) => (c === 'peak' || c === 'high' ? i + 1 : null))
    .filter(Boolean)
  return {
    level: 'varies',
    notes: [`High/peak crowd months (prior): ${peakMonths.join(', ') || 'none marked'}.`],
  }
}

export function analyzeSafety(record: DestinationKnowledgeRecord): {
  band: string
  indicators: string[]
  score: number
} {
  const score =
    record.safetyBand === 'high' ? 90 : record.safetyBand === 'moderate' ? 70 : record.safetyBand === 'caution' ? 45 : 50
  return { band: record.safetyBand, indicators: [...record.safetyIndicators], score }
}

export function analyzeTransportation(record: DestinationKnowledgeRecord): {
  quality: number
  walking: number
  notes: string[]
} {
  return {
    quality: record.transportationQuality,
    walking: record.walkingScore,
    notes: [
      `Transit quality prior: ${record.transportationQuality}/100.`,
      `Walking score prior: ${record.walkingScore}/100.`,
    ],
  }
}

export function analyzeFamilySuitability(record: DestinationKnowledgeRecord) {
  return { score: record.familySuitability, profiles: record.typicalTravelerProfiles.filter((p) => /family/i.test(p)) }
}
export function analyzeLuxurySuitability(record: DestinationKnowledgeRecord) {
  return { score: record.luxuryScore, cost: record.costExpectations }
}
export function analyzeAdventureSuitability(record: DestinationKnowledgeRecord) {
  return { score: record.adventureScore }
}
export function analyzeFoodCulture(record: DestinationKnowledgeRecord) {
  return { score: record.foodScore }
}
export function analyzeShopping(record: DestinationKnowledgeRecord) {
  return { score: record.shoppingScore }
}
export function analyzeNature(record: DestinationKnowledgeRecord) {
  return { score: record.natureScore }
}
export function analyzeCity(record: DestinationKnowledgeRecord) {
  return { score: record.cityScore }
}
export function analyzeNightlife(record: DestinationKnowledgeRecord) {
  return { score: record.nightlifeScore }
}
export function analyzePhotography(record: DestinationKnowledgeRecord) {
  return { score: record.photographyScore }
}
export function analyzeAccessibility(record: DestinationKnowledgeRecord) {
  return { score: record.accessibilityScore }
}
export function analyzeLocalEvents(record: DestinationKnowledgeRecord) {
  return { notes: [...record.localEventsNotes] }
}
export function analyzeBudgetSuitability(
  record: DestinationKnowledgeRecord,
  budgetStance?: string | null,
): { score: number; band: string; notes: string[] } {
  let score = 60
  const notes: string[] = [`Cost band prior: ${record.costExpectations}.`]
  if (budgetStance === 'strict' || budgetStance === 'cheap') {
    score = record.costExpectations === 'budget' ? 85 : record.costExpectations === 'moderate' ? 65 : 35
    notes.push('Strict budget travelers may feel premium/luxury destinations tightly.')
  } else if (budgetStance === 'comfort_first' || budgetStance === 'luxury') {
    score = record.luxuryScore
    notes.push('Comfort/luxury stance aligns with luxury score.')
  } else if (budgetStance === 'value_seeking' || budgetStance === 'flexible') {
    score = record.costExpectations === 'luxury' ? 55 : 75
  }
  return { score: clampScore(score), band: record.costExpectations, notes }
}
export function analyzeVisaComplexity(record: DestinationKnowledgeRecord) {
  return { band: record.visaComplexity, notes: [...record.visaNotes] }
}

export const ClimateAnalyzer = { analyze: analyzeClimate }
export const SeasonAnalyzer = { analyze: analyzeSeason }
export const CrowdAnalyzer = { analyze: analyzeCrowd }
export const SafetyAnalyzer = { analyze: analyzeSafety }
export const TransportationAnalyzer = { analyze: analyzeTransportation }
export const FamilySuitability = { analyze: analyzeFamilySuitability }
export const LuxurySuitability = { analyze: analyzeLuxurySuitability }
export const AdventureSuitability = { analyze: analyzeAdventureSuitability }
export const FoodCultureAnalyzer = { analyze: analyzeFoodCulture }
export const ShoppingAnalyzer = { analyze: analyzeShopping }
export const NatureAnalyzer = { analyze: analyzeNature }
export const CityAnalyzer = { analyze: analyzeCity }
export const NightlifeAnalyzer = { analyze: analyzeNightlife }
export const PhotographyAnalyzer = { analyze: analyzePhotography }
export const AccessibilityAnalyzer = { analyze: analyzeAccessibility }
export const LocalEventsAnalyzer = { analyze: analyzeLocalEvents }
export const BudgetSuitability = { analyze: analyzeBudgetSuitability }
export const VisaComplexity = { analyze: analyzeVisaComplexity }
