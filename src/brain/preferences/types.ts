import type { CurrencyCode } from '../types'
import type { TripGoal } from '../travel/types'

export type BudgetLevel = 'low' | 'mid' | 'high' | 'luxury' | 'unknown'
export type LuxuryLevel = 'essential' | 'comfort' | 'premium' | 'ultra' | 'unknown'
export type SeatPreference = 'window' | 'aisle' | 'extra_legroom' | 'any' | 'unknown'
export type TravelStyle = TripGoal

export type UserPreferenceProfile = {
  favoriteAirlines: string[]
  favoriteHotels: string[]
  preferredSeat: SeatPreference
  budgetLevel: BudgetLevel
  luxuryLevel: LuxuryLevel
  travelStyle: TravelStyle
  preferredCurrency: CurrencyCode | 'unknown'
  /** Soft weights learned from signals — not hardcoded product rules. */
  signalWeights: Record<string, number>
}

export type PreferenceSignal = {
  key: string
  value: string
  strength?: number
}

export function emptyPreferenceProfile(): UserPreferenceProfile {
  return {
    favoriteAirlines: [],
    favoriteHotels: [],
    preferredSeat: 'unknown',
    budgetLevel: 'unknown',
    luxuryLevel: 'unknown',
    travelStyle: 'unknown',
    preferredCurrency: 'unknown',
    signalWeights: {},
  }
}
