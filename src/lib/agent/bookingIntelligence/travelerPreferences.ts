/**
 * Personal Preference Engine for booking intelligence.
 * Persists traveler taste that influences ranking automatically.
 */

import type { TripRequirements } from '../types'
import { emptyRequirements } from '../types'
import type { BookingTravelerPreferences, TripPersona } from './types'

const store = new Map<string, BookingTravelerPreferences>()

export function emptyBookingPreferences(userId: string): BookingTravelerPreferences {
  return {
    userId,
    preferredAirlines: [],
    preferredHotelChains: [],
    seatType: null,
    hotelStarsMin: null,
    maxWalkingDistanceMeters: null,
    preferredAirports: [],
    mealPreference: null,
    budgetStyle: null,
    persona: null,
    pastSelectedOfferIds: [],
    pastSelectedProviderIds: [],
    updatedAt: new Date().toISOString(),
  }
}

export function getBookingPreferences(userId: string): BookingTravelerPreferences {
  return store.get(userId) ?? emptyBookingPreferences(userId)
}

export function saveBookingPreferences(prefs: BookingTravelerPreferences): BookingTravelerPreferences {
  const next = { ...prefs, updatedAt: new Date().toISOString() }
  store.set(prefs.userId, next)
  return next
}

export function resetBookingPreferences(userId?: string): void {
  if (userId) store.delete(userId)
  else store.clear()
}

export function learnBookingPreferences(input: {
  userId: string
  requirements: TripRequirements
  selectedOfferIds?: string[]
  selectedProviderIds?: string[]
  preferredAirlines?: string[]
}): BookingTravelerPreferences {
  const current = getBookingPreferences(input.userId)
  const next: BookingTravelerPreferences = {
    ...current,
    budgetStyle: input.requirements.budgetStyle ?? current.budgetStyle,
    persona: inferPersona(input.requirements) ?? current.persona,
    hotelStarsMin: inferHotelStars(input.requirements) ?? current.hotelStarsMin,
    mealPreference: input.requirements.interests.includes('food')
      ? (current.mealPreference || 'local_food')
      : current.mealPreference,
    preferredAirlines: unique([
      ...current.preferredAirlines,
      ...(input.preferredAirlines ?? []),
    ]),
    preferredAirports: unique([
      ...current.preferredAirports,
      ...(input.requirements.origin ? [input.requirements.origin] : []),
    ]),
    maxWalkingDistanceMeters: input.requirements.hotelPreference === 'central'
      ? Math.min(current.maxWalkingDistanceMeters ?? 1200, 900)
      : current.maxWalkingDistanceMeters,
    pastSelectedOfferIds: unique([
      ...current.pastSelectedOfferIds,
      ...(input.selectedOfferIds ?? []),
    ]).slice(-40),
    pastSelectedProviderIds: unique([
      ...current.pastSelectedProviderIds,
      ...(input.selectedProviderIds ?? []),
    ]).slice(-20),
  }
  return saveBookingPreferences(next)
}

export function recordBookingSelection(input: {
  userId: string
  offerId: string
  providerId: string
  requirements?: TripRequirements
}): BookingTravelerPreferences {
  return learnBookingPreferences({
    userId: input.userId,
    requirements: input.requirements ?? emptyRequirements(),
    selectedOfferIds: [input.offerId],
    selectedProviderIds: [input.providerId],
  })
}

function inferPersona(requirements: TripRequirements): TripPersona {
  if (requirements.travelerType === 'business' || requirements.tripPurpose === 'business') return 'business'
  if (requirements.travelerType === 'family' || requirements.tripPurpose === 'family') return 'family'
  if (requirements.travelerType === 'couple' || requirements.tripPurpose === 'honeymoon') return 'couple'
  if (requirements.travelerType === 'solo') return 'solo'
  if (requirements.travelerType === 'friends') return 'friends'
  if (requirements.budgetStyle === 'luxury') return 'luxury'
  return null
}

function inferHotelStars(requirements: TripRequirements): number | null {
  if (requirements.budgetStyle === 'luxury') return 5
  if (requirements.budgetStyle === 'midrange') return 4
  if (requirements.budgetStyle === 'budget') return 3
  return null
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}
