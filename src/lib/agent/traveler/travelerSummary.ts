/**
 * Evolution Sprint 5 — TravelerSummary
 * Snapshot / Personality / Travel DNA / Planning Bias / Recommendation Bias.
 */

import { overallTravelerConfidence } from './travelerConfidence'
import { listPreferences } from './travelerPreferenceModel'
import {
  clamp01,
  isoNow,
  type PlanningBias,
  type RecommendationBias,
  type StoredPreference,
  type TravelDna,
  type TravelerModelState,
  type TravelerPersonality,
  type TravelerSnapshot,
} from './travelerTypes'

function pref(
  map: Partial<Record<string, StoredPreference>>,
  key: string,
): StoredPreference | undefined {
  return map[key]
}

export function buildTravelDna(state: TravelerModelState): TravelDna {
  const p = state.preferences
  const style = pref(p, 'travel_style')
  const budget = pref(p, 'budget_flexibility')
  const pace = pref(p, 'pace')
  const risk = pref(p, 'risk_tolerance')
  const place = pref(p, 'nature_vs_cities')
  const food = pref(p, 'food_exploration')
  const activity = pref(p, 'activity_density')
  const climate = pref(p, 'climate_preference')
  const luxury = pref(p, 'luxury_preference')
  const adventure = pref(p, 'adventure_preference')

  const secondary: string[] = []
  if (luxury && luxury.lean > 0.4) secondary.push('luxury')
  if (adventure && adventure.lean > 0.4) secondary.push('adventure')
  if (pref(p, 'family_friendliness')?.lean && (pref(p, 'family_friendliness')!.lean > 0.4)) {
    secondary.push('family')
  }
  if (food && food.lean > 0.4) secondary.push('foodie')

  const signature = [
    style?.value,
    budget?.value,
    pace?.value,
    place?.value,
    climate?.value,
  ].filter(Boolean) as string[]

  return {
    primaryStyle: style?.value ?? 'emerging',
    secondaryStyles: [...new Set(secondary)].slice(0, 4),
    budgetGene: budget?.value ?? 'unknown',
    paceGene: pace?.value ?? 'unknown',
    riskGene: risk?.value ?? 'unknown',
    placeGene: place?.value ?? 'unknown',
    foodGene: food?.value ?? 'unknown',
    activityGene: activity?.value ?? 'unknown',
    climateGene: climate?.value ?? 'unknown',
    signature,
  }
}

export function buildPersonality(state: TravelerModelState): TravelerPersonality {
  const dna = buildTravelDna(state)
  const traits: string[] = []
  if (dna.primaryStyle !== 'emerging') traits.push(`style:${dna.primaryStyle}`)
  if (dna.budgetGene !== 'unknown') traits.push(`budget:${dna.budgetGene}`)
  if (dna.paceGene !== 'unknown') traits.push(`pace:${dna.paceGene}`)
  if (dna.riskGene !== 'unknown') traits.push(`risk:${dna.riskGene}`)
  if (dna.placeGene !== 'unknown') traits.push(`place:${dna.placeGene}`)
  traits.push(...dna.secondaryStyles.map((s) => `lean:${s}`))

  const summary =
    state.locale === 'ar'
      ? `نموذج سلوكي متطور: أسلوب ${dna.primaryStyle}، ميزانية ${dna.budgetGene}، إيقاع ${dna.paceGene}.`
      : `Evolving behavioral model: style ${dna.primaryStyle}, budget ${dna.budgetGene}, pace ${dna.paceGene}.`

  return { traits: [...new Set(traits)], summary, locale: state.locale }
}

export function buildPlanningBias(state: TravelerModelState): PlanningBias {
  const p = state.preferences
  const flex = pref(p, 'budget_flexibility')
  const risk = pref(p, 'risk_tolerance')
  const comfort = pref(p, 'comfort_preference')
  const decision = pref(p, 'decision_confidence')
  const notes: string[] = []

  const preferValueOverCheapest =
    (flex?.value === 'value_seeking' || (flex?.lean ?? 0) > 0.2) && flex?.value !== 'low'
  const preferLowFriction = (risk?.lean ?? 0) < -0.3 || (comfort?.lean ?? 0) > 0.4
  const preferComfort = (comfort?.lean ?? 0) > 0.35 || (pref(p, 'luxury_preference')?.lean ?? 0) > 0.4
  const preferFlexibleDates = (flex?.lean ?? 0) > 0.4

  let clarifyAggressiveness: PlanningBias['clarifyAggressiveness'] = 'medium'
  if ((decision?.lean ?? 0) > 0.5) clarifyAggressiveness = 'low'
  if ((decision?.lean ?? 0) < -0.4) clarifyAggressiveness = 'high'

  if (preferValueOverCheapest) notes.push('Bias toward value over cheapest.')
  if (preferLowFriction) notes.push('Bias toward low-friction logistics.')
  if (preferComfort) notes.push('Bias toward comfort.')

  return {
    preferFlexibleDates,
    preferValueOverCheapest: Boolean(preferValueOverCheapest),
    preferLowFriction,
    preferComfort,
    clarifyAggressiveness,
    notes,
  }
}

export function buildRecommendationBias(state: TravelerModelState): RecommendationBias {
  const p = state.preferences
  const dest = pref(p, 'destination_affinity')
  const favorDestinations = dest && dest.value !== 'open' && dest.value !== 'unknown' ? [String(dest.value)] : []
  const avoidThemes: string[] = []
  if ((pref(p, 'nightlife_preference')?.lean ?? 0) < -0.5) avoidThemes.push('nightlife')
  if ((pref(p, 'adventure_preference')?.lean ?? 0) < -0.4) avoidThemes.push('high_adventure')
  if ((pref(p, 'risk_tolerance')?.lean ?? 0) < -0.5) avoidThemes.push('high_friction')

  const w = (key: string) => clamp01(((pref(p, key)?.lean ?? 0) + 1) / 2)

  return {
    favorDestinations,
    avoidThemes,
    weightLuxury: w('luxury_preference'),
    weightAdventure: w('adventure_preference'),
    weightFamily: w('family_friendliness'),
    weightFood: w('food_exploration'),
    weightNightlife: w('nightlife_preference'),
    weightNature: clamp01(1 - w('nature_vs_cities') + ((pref(p, 'nature_vs_cities')?.value === 'nature') ? 0.5 : 0)),
    notes: [
      ...(favorDestinations.length ? [`Affinity: ${favorDestinations.join(', ')}`] : []),
      ...(avoidThemes.length ? [`Avoid themes: ${avoidThemes.join(', ')}`] : []),
    ],
  }
}

export function buildSummaryText(state: TravelerModelState): string {
  const personality = buildPersonality(state)
  const conf = overallTravelerConfidence(state.preferences)
  const prefs = listPreferences(state).length
  if (state.locale === 'ar') {
    return `${personality.summary} تفضيلات متتبعة: ${prefs}. ثقة النموذج ${(conf * 100).toFixed(0)}٪.`
  }
  return `${personality.summary} Tracked preferences: ${prefs}. Model confidence ${(conf * 100).toFixed(0)}%.`
}

export function buildTravelerSnapshot(state: TravelerModelState, now?: Date): TravelerSnapshot {
  return {
    modelId: state.id,
    locale: state.locale,
    timestamp: isoNow(now),
    preferences: listPreferences(state),
    personality: buildPersonality(state),
    travelDna: buildTravelDna(state),
    planningBias: buildPlanningBias(state),
    recommendationBias: buildRecommendationBias(state),
    overallConfidence: overallTravelerConfidence(state.preferences),
    summary: buildSummaryText(state),
  }
}

export const TravelerSummary = {
  dna: buildTravelDna,
  personality: buildPersonality,
  planningBias: buildPlanningBias,
  recommendationBias: buildRecommendationBias,
  snapshot: buildTravelerSnapshot,
  text: buildSummaryText,
}
