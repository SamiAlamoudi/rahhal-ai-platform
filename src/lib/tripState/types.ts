/**
 * Persistent Trip Planning State — structured memory for consultant turns.
 * Additive; derived from AgentMemory / TripRequirements, never replaces them.
 */

export type TripConversationStage =
  | 'DISCOVERY'
  | 'CLARIFICATION'
  | 'PLANNING'
  | 'RECOMMENDATIONS'
  | 'ITINERARY'
  | 'BOOKING_READY'

export type TripMissingField =
  | 'destinationCountry'
  | 'destinationCity'
  | 'travelDates'
  | 'duration'
  | 'budget'
  | 'travelStyle'
  | 'travelers'

export interface TripState {
  destinationCountry: string | null
  destinationCity: string | null
  travelDates: { start: string | null; end: string | null }
  duration: number | null
  travelers: number | null
  relationship: 'solo' | 'couple' | 'family' | 'friends' | 'business' | null
  budget: number | null
  currency: string | null
  travelStyle: string | null
  hotelPreference: string | null
  flightPreference: string | null
  activities: string[]
  foodPreferences: string[]
  visaRequired: boolean | null
  specialNeeds: string | null
  conversationStage: TripConversationStage
  completionPercentage: number
  missingFields: TripMissingField[]
  confidenceScore: number
  /** Highest-priority missing field for the next consultant question. */
  primaryMissing: TripMissingField | null
  /** True when recommendation / inventory cards may render. */
  cardsAllowed: boolean
  updatedAt: string
}

export function emptyTripState(): TripState {
  return {
    destinationCountry: null,
    destinationCity: null,
    travelDates: { start: null, end: null },
    duration: null,
    travelers: null,
    relationship: null,
    budget: null,
    currency: null,
    travelStyle: null,
    hotelPreference: null,
    flightPreference: null,
    activities: [],
    foodPreferences: [],
    visaRequired: null,
    specialNeeds: null,
    conversationStage: 'DISCOVERY',
    completionPercentage: 0,
    missingFields: ['destinationCountry'],
    confidenceScore: 0,
    primaryMissing: 'destinationCountry',
    cardsAllowed: false,
    updatedAt: new Date(0).toISOString(),
  }
}
