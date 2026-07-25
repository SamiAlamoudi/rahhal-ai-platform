/**
 * Preference ↔ TripRequirements bridge.
 * Seeds agent intake from long-term PreferenceEngine and learns back.
 * Never overwrites explicit user statements.
 */

import {
  getPreferenceEngine,
  type PersonalizationProfile,
  type PreferenceEngine,
} from '../../ai/preferences'
import type { TripRequirements } from '../types'
export { isPreferenceMemoryEnabled } from './feature'
import { isPreferenceMemoryEnabled } from './feature'

/**
 * Fill only empty requirement slots from the traveler's long-term profile.
 */
export function seedRequirementsFromPreferences(
  requirements: TripRequirements,
  input: {
    userId?: string | null
    engine?: PreferenceEngine
    enabled?: boolean
  } = {},
): TripRequirements {
  if (!isPreferenceMemoryEnabled({ enabled: input.enabled })) return requirements

  const engine = input.engine ?? getPreferenceEngine()
  const profile = engine.getProfile(input.userId ?? null)
  return applyProfileToRequirements(requirements, profile)
}

export function applyProfileToRequirements(
  requirements: TripRequirements,
  profile: PersonalizationProfile,
): TripRequirements {
  const next: TripRequirements = { ...requirements }

  if (next.budgetAmount == null && profile.budget.typicalTripBudget != null) {
    next.budgetAmount = profile.budget.typicalTripBudget
    next.budgetCurrency = next.budgetCurrency ?? profile.budget.currency
  }
  if (next.budgetFlexible == null && profile.budget.flexibility === 'open') {
    next.budgetFlexible = true
  }
  if (next.budgetStyle == null && profile.budget.style) {
    next.budgetStyle = profile.budget.style
  }
  if (next.weatherPreference == null && profile.travelStyle.weatherPreference) {
    next.weatherPreference = profile.travelStyle.weatherPreference
  }
  if (next.interests.length === 0 && profile.travelStyle.interests.length > 0) {
    next.interests = [...profile.travelStyle.interests]
  }
  if (next.travelerType == null && profile.traveler.travelerTypes[0]) {
    next.travelerType = profile.traveler.travelerTypes[0]
  }
  if (next.travelers == null && profile.traveler.preferredGroupSize != null) {
    next.travelers = profile.traveler.preferredGroupSize
  }
  if (next.hotelPreference == null) {
    if (profile.hotel.preferCentral) next.hotelPreference = 'central'
    else if (profile.hotel.categories[0] === 'resort') next.hotelPreference = 'resort'
    else if (profile.hotel.categories[0] === 'boutique') next.hotelPreference = 'boutique'
    else if (profile.hotel.categories[0] === 'apartment') next.hotelPreference = 'apartment'
  }
  if (next.tripPurpose == null) {
    if (profile.traveler.travelerTypes.includes('business')) next.tripPurpose = 'business'
    else if (profile.traveler.travelerTypes.includes('family')) next.tripPurpose = 'family'
  }

  return next
}

/**
 * Persist observed preferences into long-term memory (additive merge).
 */
export function learnPreferencesFromRequirements(
  requirements: TripRequirements,
  input: {
    userId?: string | null
    engine?: PreferenceEngine
    enabled?: boolean
  } = {},
): PersonalizationProfile | null {
  if (!isPreferenceMemoryEnabled({ enabled: input.enabled })) return null

  const engine = input.engine ?? getPreferenceEngine()
  const userId = input.userId ?? null
  const current = engine.getProfile(userId)
  const next: PersonalizationProfile = {
    ...current,
    userId,
    updatedAt: new Date().toISOString(),
    traveler: { ...current.traveler },
    hotel: { ...current.hotel },
    airline: { ...current.airline },
    budget: { ...current.budget },
    travelStyle: { ...current.travelStyle },
    weights: { ...current.weights },
  }

  if (requirements.budgetAmount != null) {
    next.budget.typicalTripBudget = requirements.budgetAmount
    if (requirements.budgetCurrency) next.budget.currency = requirements.budgetCurrency
  }
  if (requirements.budgetFlexible === true) next.budget.flexibility = 'open'
  else if (requirements.budgetFlexible === false) next.budget.flexibility = 'strict'

  if (requirements.budgetStyle) next.budget.style = requirements.budgetStyle

  if (requirements.weatherPreference) {
    next.travelStyle.weatherPreference = requirements.weatherPreference
  }
  if (requirements.interests.length > 0) {
    next.travelStyle.interests = unique([
      ...next.travelStyle.interests,
      ...requirements.interests,
    ])
  }
  if (requirements.travelerType) {
    next.traveler.travelerTypes = unique([
      ...next.traveler.travelerTypes,
      requirements.travelerType,
    ]) as PersonalizationProfile['traveler']['travelerTypes']
  }
  if (requirements.travelers != null) {
    next.traveler.preferredGroupSize = requirements.travelers
  }
  if (requirements.hotelPreference === 'central') next.hotel.preferCentral = true
  if (requirements.hotelPreference === 'resort') {
    next.hotel.categories = unique([...next.hotel.categories, 'resort']) as PersonalizationProfile['hotel']['categories']
  }
  if (requirements.hotelPreference === 'boutique') {
    next.hotel.categories = unique([...next.hotel.categories, 'boutique']) as PersonalizationProfile['hotel']['categories']
  }
  if (requirements.hotelPreference === 'apartment') {
    next.hotel.categories = unique([...next.hotel.categories, 'apartment']) as PersonalizationProfile['hotel']['categories']
  }
  if (requirements.tripPurpose === 'business') {
    next.traveler.travelerTypes = unique([
      ...next.traveler.travelerTypes,
      'business',
    ]) as PersonalizationProfile['traveler']['travelerTypes']
  }

  const lockedDestination = requirements.destination
  if (lockedDestination) {
    next.travelStyle.favoriteDestinations = unique([
      lockedDestination,
      ...next.travelStyle.favoriteDestinations,
    ]).slice(0, 12)
  }

  return engine.upsertProfile(next)
}

function unique<T extends string>(values: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}
