/**
 * Sprint 112 — TravelerProfile helpers for Memory Engine profiles.
 */

import type { MemoryTravelerProfile, TravelStyleKind } from './types'

export function emptyMemoryTravelerProfile(
  userId: string,
  now = new Date().toISOString(),
): MemoryTravelerProfile {
  return {
    userId,
    version: 1,
    preferredAirlines: [],
    preferredHotelChains: [],
    preferredCabinClass: null,
    preferredHotelStars: null,
    preferredDestinations: [],
    preferredCountries: [],
    budgetRange: null,
    typicalTripDurationDays: null,
    travelStyles: [],
    isBusinessTraveler: false,
    isFamilyTraveler: false,
    isLuxuryTraveler: false,
    isAdventureTraveler: false,
    isBeachTraveler: false,
    isShoppingTraveler: false,
    preferredDepartureAirports: [],
    preferredArrivalAirports: [],
    preferredLayover: null,
    preferredDepartureTimes: [],
    preferredSeatType: null,
    preferredMealOptions: [],
    preferredHotelAmenities: [],
    language: null,
    currency: null,
    timezone: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function syncTravelStyleFlags(
  profile: MemoryTravelerProfile,
): MemoryTravelerProfile {
  const styles = new Set(
    profile.travelStyles
      .filter((s) => s.polarity === 'prefer')
      .map((s) => s.value),
  )
  return {
    ...profile,
    isBusinessTraveler: styles.has('business'),
    isFamilyTraveler: styles.has('family'),
    isLuxuryTraveler: styles.has('luxury'),
    isAdventureTraveler: styles.has('adventure'),
    isBeachTraveler: styles.has('beach'),
    isShoppingTraveler: styles.has('shopping'),
  }
}

export function topPreferredValues(
  list: Array<{ value: string; confidence: number; polarity: string }>,
  limit = 5,
): string[] {
  return [...list]
    .filter((p) => p.polarity === 'prefer')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit)
    .map((p) => p.value)
}

export function hasTravelStyle(
  profile: MemoryTravelerProfile,
  style: TravelStyleKind,
): boolean {
  return profile.travelStyles.some(
    (s) => s.value === style && s.polarity === 'prefer' && s.confidence >= 0.4,
  )
}

export class TravelerProfile {
  static empty(userId: string): MemoryTravelerProfile {
    return emptyMemoryTravelerProfile(userId)
  }

  static syncFlags(profile: MemoryTravelerProfile): MemoryTravelerProfile {
    return syncTravelStyleFlags(profile)
  }
}

export function createTravelerProfileHelpers(): typeof TravelerProfile {
  return TravelerProfile
}
