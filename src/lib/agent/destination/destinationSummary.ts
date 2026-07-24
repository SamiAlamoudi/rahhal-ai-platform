/**
 * Evolution Sprint 7 — DestinationConfidence + DestinationSummary / DNA / matching
 */

import {
  analyzeBudgetSuitability,
  analyzeSeason,
} from './destinationAnalyzers'
import {
  clamp01,
  clampScore,
  isoNow,
  uniqueStrings,
  type DestinationDna,
  type DestinationKnowledgeRecord,
  type DestinationLocale,
  type DestinationSnapshot,
  type TravelerMatchInput,
} from './destinationTypes'

export function destinationConfidence(record: DestinationKnowledgeRecord): number {
  const missingPenalty = record.missingKnowledge.length * 0.03
  return clamp01(record.confidence - missingPenalty)
}

export function buildDestinationDna(record: DestinationKnowledgeRecord): DestinationDna {
  const traits: Array<[string, number]> = [
    ['city', record.cityScore],
    ['nature', record.natureScore],
    ['food', record.foodScore],
    ['luxury', record.luxuryScore],
    ['adventure', record.adventureScore],
    ['family', record.familySuitability],
    ['nightlife', record.nightlifeScore],
    ['shopping', record.shoppingScore],
  ]
  traits.sort((a, b) => b[1] - a[1])
  const primary = traits[0]?.[0] ?? 'balanced'
  const secondary = traits.slice(1, 4).filter((t) => t[1] >= 65).map((t) => t[0])
  const climateGene = record.weatherPatterns[0] ?? 'varied'
  const paceGene = record.walkingScore >= 80 ? 'walkable' : record.transportationQuality >= 85 ? 'transit_rich' : 'transfer_heavy'
  return {
    primaryCharacter: primary,
    secondaryTraits: secondary,
    climateGene,
    costGene: record.costExpectations,
    paceGene,
    signature: uniqueStrings([
      primary,
      ...secondary.slice(0, 2),
      record.costExpectations,
      record.safetyBand,
    ]),
  }
}

export function matchTravelerScore(
  record: DestinationKnowledgeRecord,
  traveler?: TravelerMatchInput,
  monthHint?: number | null,
): { score: number; reasons: string[]; avoidReasons: string[] } {
  if (!traveler) {
    return { score: 50, reasons: ['No traveler hints — neutral match.'], avoidReasons: [] }
  }
  let score = 40
  const reasons: string[] = []
  const avoidReasons: string[] = []

  const purpose = (traveler.purpose ?? '').toLowerCase()
  if (purpose === 'family' || traveler.familyLean && traveler.familyLean > 0.4) {
    score += record.familySuitability * 0.25
    reasons.push(`Family suitability ${record.familySuitability}.`)
    if (record.familySuitability < 55) avoidReasons.push('Lower family suitability priors.')
  }
  if (purpose === 'honeymoon' || purpose === 'romantic') {
    score += record.luxuryScore * 0.15 + record.photographyScore * 0.1
    reasons.push('Romantic/honeymoon lean uses luxury + photography priors.')
  }
  if (purpose === 'adventure' || (traveler.adventureLean ?? 0) > 0.4) {
    score += record.adventureScore * 0.3
    reasons.push(`Adventure score ${record.adventureScore}.`)
    if (record.adventureScore < 50) avoidReasons.push('Limited adventure profile.')
  }
  if (purpose === 'cultural' || purpose === 'culture') {
    score += record.cityScore * 0.15 + record.foodScore * 0.1
    reasons.push('Cultural lean favors city + food scores.')
  }

  if ((traveler.luxuryLean ?? 0) > 0.4) {
    score += record.luxuryScore * 0.2
    reasons.push(`Luxury lean vs luxury score ${record.luxuryScore}.`)
  }
  if ((traveler.foodLean ?? 0) > 0.4) score += record.foodScore * 0.15
  if ((traveler.natureLean ?? 0) > 0.4) {
    score += record.natureScore * 0.25
    if (record.natureScore < 50) avoidReasons.push('Not a nature-first destination.')
  }
  if ((traveler.cityLean ?? 0) > 0.4) score += record.cityScore * 0.2

  if (traveler.riskTolerance === 'low' && record.safetyBand === 'caution') {
    score -= 20
    avoidReasons.push('Safety band caution conflicts with low risk tolerance.')
  }
  if (traveler.riskTolerance === 'low' && record.safetyBand === 'high') {
    score += 10
    reasons.push('High safety band fits low risk tolerance.')
  }

  const budget = analyzeBudgetSuitability(record, traveler.budgetStance)
  score += budget.score * 0.15
  reasons.push(...budget.notes.slice(0, 1))

  const season = analyzeSeason(record, monthHint ?? traveler.monthHint)
  score += season.fitScore * 0.15
  reasons.push(...season.notes.slice(0, 1))

  for (const interest of traveler.interests ?? []) {
    if (/food/i.test(interest)) score += record.foodScore * 0.05
    if (/shop/i.test(interest)) score += record.shoppingScore * 0.05
    if (/nature|beach/i.test(interest)) score += record.natureScore * 0.05
    if (/night/i.test(interest)) score += record.nightlifeScore * 0.05
    if (/photo/i.test(interest)) score += record.photographyScore * 0.05
  }

  return {
    score: clampScore(score),
    reasons: uniqueStrings(reasons).slice(0, 6),
    avoidReasons: uniqueStrings(avoidReasons).slice(0, 4),
  }
}

export function whoShouldAvoid(record: DestinationKnowledgeRecord): string[] {
  const out: string[] = []
  if (record.costExpectations === 'luxury' || record.costExpectations === 'premium') {
    out.push('Strict ultra-budget travelers may feel priced out.')
  }
  if (record.adventureScore < 45) out.push('High-adrenaline adventure seekers may find limited thrills.')
  if (record.natureScore < 45) out.push('Nature-first travelers may prefer elsewhere.')
  if (record.familySuitability < 60) out.push('Families with very young children may face friction.')
  if (record.visaComplexity === 'complex') out.push('Travelers wanting zero visa process friction.')
  if (record.walkingScore < 50) out.push('Travelers who require highly walkable cores without cars/taxis.')
  if (record.nightlifeScore < 50) out.push('Nightlife-centric travelers.')
  return out.slice(0, 6)
}

export function bestTravelerMatch(record: DestinationKnowledgeRecord): string[] {
  return [
    ...record.typicalTravelerProfiles,
    ...(record.familySuitability >= 80 ? ['family_friendly_seekers'] : []),
    ...(record.luxuryScore >= 85 ? ['luxury_seekers'] : []),
    ...(record.foodScore >= 88 ? ['food_explorers'] : []),
  ].slice(0, 8)
}

export function buildDestinationSnapshot(options: {
  record: DestinationKnowledgeRecord
  locale: DestinationLocale
  traveler?: TravelerMatchInput
  monthHint?: number | null
  now?: Date
}): DestinationSnapshot {
  const { record, locale, traveler, monthHint, now } = options
  const season = analyzeSeason(record, monthHint ?? traveler?.monthHint)
  const match = matchTravelerScore(record, traveler, monthHint ?? traveler?.monthHint)
  const budget = analyzeBudgetSuitability(record, traveler?.budgetStance)
  const conf = destinationConfidence(record)
  const dna = buildDestinationDna(record)

  const safetyBoost = record.safetyBand === 'high' ? 12 : record.safetyBand === 'moderate' ? 8 : 4
  const overallFixed = clampScore(
    match.score * 0.45 + season.fitScore * 0.2 + budget.score * 0.15 + safetyBoost + conf * 10,
  )

  const name = locale === 'ar' ? record.nameAr : record.nameEn
  const summary =
    locale === 'ar'
      ? `${name}: طابع ${dna.primaryCharacter}، تكلفة ${dna.costGene}، ثقة ${(conf * 100).toFixed(0)}٪.`
      : `${name}: character ${dna.primaryCharacter}, cost ${dna.costGene}, confidence ${(conf * 100).toFixed(0)}%.`

  return {
    id: record.id,
    locale,
    timestamp: isoNow(now),
    name,
    destinationDna: dna,
    strengths: [...record.topStrengths],
    weaknesses: [...record.knownWeaknesses],
    bestTravelerMatch: bestTravelerMatch(record),
    whoShouldAvoid: uniqueStrings([...whoShouldAvoid(record), ...match.avoidReasons]),
    confidence: conf,
    evidence: [...record.evidence],
    missingKnowledge: [...record.missingKnowledge],
    scores: {
      family: record.familySuitability,
      luxury: record.luxuryScore,
      adventure: record.adventureScore,
      food: record.foodScore,
      shopping: record.shoppingScore,
      walking: record.walkingScore,
      transportation: record.transportationQuality,
      nightlife: record.nightlifeScore,
      photography: record.photographyScore,
      nature: record.natureScore,
      city: record.cityScore,
      accessibility: record.accessibilityScore,
      budgetFit: budget.score,
      seasonFit: season.fitScore,
      overall: overallFixed,
    },
    seasonal: {
      bestSeasons: season.best,
      worstSeasons: season.worst,
      monthNotes: season.monthNotes,
    },
    summary,
  }
}

export const DestinationConfidence = { of: destinationConfidence }
export const DestinationSummary = {
  dna: buildDestinationDna,
  snapshot: buildDestinationSnapshot,
  match: matchTravelerScore,
  avoid: whoShouldAvoid,
  bestMatch: bestTravelerMatch,
}
