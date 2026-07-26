/**
 * Sprint 57 — Normalized Rahhal travel domain models.
 * Conversation Brain never sees provider-specific payloads.
 */

/** Provenance on every travel-data result (live / mock / estimated). */
export interface DataProvenance {
  /** 0..1 confidence in this row. */
  confidence: number
  /** ISO timestamp when the provider produced the row. */
  lastUpdated: string
  /** Stable provider id (e.g. mock_flights, amadeus). */
  provider: string
  /** True when values are estimated / offline rather than live inventory. */
  estimated: boolean
}

export interface Location {
  id: string
  name: string
  city: string | null
  country: string | null
  countryCode: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
}

export interface Price {
  amount: number
  currency: string
  /** Per night / per person / total — free-form unit for UI later. */
  unit?: 'total' | 'per_night' | 'per_person' | 'per_day' | null
}

export interface CurrencyQuote {
  base: string
  quote: string
  rate: number
  provenance: DataProvenance
}

export interface Flight {
  id: string
  origin: string
  destination: string
  departAt: string
  arriveAt: string
  airline: string
  flightNumber: string
  cabin: 'economy' | 'premium_economy' | 'business' | 'first'
  stops: number
  durationMinutes: number
  price: Price
  provenance: DataProvenance
}

export interface Hotel {
  id: string
  name: string
  city: string
  country: string | null
  stars: number | null
  neighbourhood: string | null
  amenities: string[]
  price: Price
  rating: number | null
  provenance: DataProvenance
}

export interface Activity {
  id: string
  title: string
  city: string
  category: string
  durationHours: number | null
  price: Price | null
  provenance: DataProvenance
}

export interface Restaurant {
  id: string
  name: string
  city: string
  cuisine: string
  priceLevel: 1 | 2 | 3 | 4
  neighbourhood: string | null
  rating: number | null
  provenance: DataProvenance
}

export interface Weather {
  location: string
  date: string
  summary: string
  tempC: { min: number; max: number }
  precipitationChance: number | null
  provenance: DataProvenance
}

export interface MapRoute {
  id: string
  from: Location
  to: Location
  distanceKm: number
  durationMinutes: number
  mode: 'walk' | 'drive' | 'transit'
  provenance: DataProvenance
}

export interface VisaInfo {
  id: string
  nationality: string
  destinationCountry: string
  requirement: 'visa_free' | 'visa_on_arrival' | 'evisa' | 'embassy' | 'unknown'
  maxStayDays: number | null
  notes: string
  provenance: DataProvenance
}

/** Ranked bundle the service can return to planning layers later. */
export interface TripOffer {
  id: string
  label: string
  destination: string
  flights: Flight[]
  hotels: Hotel[]
  activities: Activity[]
  restaurants: Restaurant[]
  weather: Weather[]
  score: number
  provenance: DataProvenance
}

export type TravelDomain =
  | 'flights'
  | 'hotels'
  | 'activities'
  | 'restaurants'
  | 'weather'
  | 'maps'
  | 'currency'
  | 'visa'
