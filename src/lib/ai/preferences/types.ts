/**
 * Phase AB — personalization foundation (taste profiles, not passenger PII).
 * Distinct from trips/TravelerProfile (passport/identity).
 */

export type TravelStyle =
  | 'relaxed'
  | 'balanced'
  | 'packed'
  | 'adventure'
  | 'cultural'
  | 'luxury_focus'
  | 'budget_focus'

export interface TravelerPreferences {
  travelerTypes: Array<'solo' | 'couple' | 'family' | 'friends' | 'business'>
  preferredGroupSize: number | null
  accessibilityNeeds: string[]
  dietaryNotes: string[]
}

export interface HotelPreferences {
  categories: Array<'hotel' | 'resort' | 'apartment' | 'boutique'>
  preferCentral: boolean
  preferBreakfast: boolean
  minStars: number | null
  maxNightly: number | null
  currency: string | null
}

export interface AirlinePreferences {
  preferredAirlines: string[]
  avoidedAirlines: string[]
  preferDirect: boolean
  preferRefundable: boolean
  cabin: 'economy' | 'premium_economy' | 'business' | 'first' | null
}

export interface BudgetProfile {
  currency: string
  typicalTripBudget: number | null
  flexibility: 'strict' | 'flexible' | 'open'
  style: 'luxury' | 'midrange' | 'budget' | null
}

export interface TravelStyleProfile {
  style: TravelStyle
  pace: 'slow' | 'balanced' | 'fast'
  interests: string[]
  weatherPreference: string | null
}

export interface PreferenceWeights {
  price: number
  comfort: number
  time: number
  rating: number
  personalization: number
}

export interface PersonalizationProfile {
  userId: string | null
  version: 1
  traveler: TravelerPreferences
  hotel: HotelPreferences
  airline: AirlinePreferences
  budget: BudgetProfile
  travelStyle: TravelStyleProfile
  weights: PreferenceWeights
  updatedAt: string
}

export function defaultPreferenceWeights(): PreferenceWeights {
  return {
    price: 0.3,
    comfort: 0.25,
    time: 0.2,
    rating: 0.15,
    personalization: 0.1,
  }
}

export function emptyPersonalizationProfile(userId: string | null = null): PersonalizationProfile {
  return {
    userId,
    version: 1,
    traveler: {
      travelerTypes: [],
      preferredGroupSize: null,
      accessibilityNeeds: [],
      dietaryNotes: [],
    },
    hotel: {
      categories: ['hotel'],
      preferCentral: true,
      preferBreakfast: false,
      minStars: null,
      maxNightly: null,
      currency: 'SAR',
    },
    airline: {
      preferredAirlines: [],
      avoidedAirlines: [],
      preferDirect: true,
      preferRefundable: false,
      cabin: 'economy',
    },
    budget: {
      currency: 'SAR',
      typicalTripBudget: null,
      flexibility: 'flexible',
      style: 'midrange',
    },
    travelStyle: {
      style: 'balanced',
      pace: 'balanced',
      interests: [],
      weatherPreference: null,
    },
    weights: defaultPreferenceWeights(),
    updatedAt: new Date().toISOString(),
  }
}
