import type { UserPreferenceProfile } from '../preferences/types'
import { MOCK_FLIGHTS, MOCK_HOTELS, MOCK_PACKAGES } from '../travel/mockCatalog'
import type { MockFlightOption, MockHotelOption, MockPackageOption, TravelDraft } from '../travel/types'
import type { Scored } from '../types'
import { clamp01 } from '../types'

export type Recommendable = MockFlightOption | MockHotelOption | MockPackageOption

export type RecommendationKind = 'flight' | 'hotel' | 'package'

function priceScore(price: number, budget?: number): number {
  if (budget == null || budget <= 0) return 0.6
  if (price <= budget * 0.7) return 1
  if (price <= budget) return 0.8
  if (price <= budget * 1.15) return 0.45
  return 0.15
}

function preferenceBoost(label: string, favorites: string[]): number {
  return favorites.some((f) => f.toLowerCase() === label.toLowerCase()) ? 0.15 : 0
}

/**
 * Ranks mock travel options — no live inventory.
 */
export class RecommendationEngine {
  rankFlights(
    draft: TravelDraft,
    prefs: UserPreferenceProfile,
    goals: string[] = [],
  ): Scored<MockFlightOption>[] {
    return MOCK_FLIGHTS.map((item) => {
      const reasons: string[] = []
      let score = 0
      const p = priceScore(item.price, draft.budgetAmount)
      score += p * 0.35
      reasons.push(`price:${p.toFixed(2)}`)
      score += item.quality * 0.3
      reasons.push(`quality:${item.quality}`)
      const duration = clamp01(1 - item.durationHours / 12)
      score += duration * 0.2
      reasons.push(`duration:${duration.toFixed(2)}`)
      const pref = preferenceBoost(item.airline, prefs.favoriteAirlines)
      score += pref
      if (pref) reasons.push('preferred_airline')
      if (draft.destination && item.destination.toLowerCase().includes(draft.destination.slice(0, 3).toLowerCase())) {
        score += 0.1
        reasons.push('destination_match')
      }
      if (goals.includes('business') && item.quality >= 0.9) {
        score += 0.05
        reasons.push('business_goal')
      }
      return { item, score: clamp01(score), reasons }
    }).sort((a, b) => b.score - a.score)
  }

  rankHotels(draft: TravelDraft, prefs: UserPreferenceProfile): Scored<MockHotelOption>[] {
    return MOCK_HOTELS.map((item) => {
      const reasons: string[] = []
      let score = item.quality * 0.35
      reasons.push(`quality:${item.quality}`)
      const nightlyBudget =
        draft.budgetAmount && draft.durationNights
          ? draft.budgetAmount / Math.max(draft.durationNights, 1)
          : draft.budgetAmount
      const p = priceScore(item.pricePerNight, nightlyBudget)
      score += p * 0.35
      reasons.push(`price:${p.toFixed(2)}`)
      if (draft.hotelClass && item.stars === draft.hotelClass) {
        score += 0.15
        reasons.push('class_match')
      }
      const pref = preferenceBoost(item.name, prefs.favoriteHotels)
      score += pref
      if (pref) reasons.push('preferred_hotel')
      if (
        draft.destination &&
        item.city.toLowerCase() === draft.destination.toLowerCase()
      ) {
        score += 0.15
        reasons.push('city_match')
      }
      return { item, score: clamp01(score), reasons }
    }).sort((a, b) => b.score - a.score)
  }

  rankPackages(draft: TravelDraft, prefs: UserPreferenceProfile): Scored<MockPackageOption>[] {
    return MOCK_PACKAGES.map((item) => {
      const reasons: string[] = []
      let score = item.quality * 0.4
      reasons.push(`quality:${item.quality}`)
      const p = priceScore(item.totalPrice, draft.budgetAmount)
      score += p * 0.4
      reasons.push(`price:${p.toFixed(2)}`)
      if (prefs.travelStyle === 'luxury' && item.quality >= 0.85) {
        score += 0.1
        reasons.push('luxury_goal')
      }
      if (
        draft.destination &&
        item.destination.toLowerCase() === draft.destination.toLowerCase()
      ) {
        score += 0.1
        reasons.push('destination_match')
      }
      return { item, score: clamp01(score), reasons }
    }).sort((a, b) => b.score - a.score)
  }
}
