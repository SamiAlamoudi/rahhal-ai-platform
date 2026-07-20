/**
 * Leaf types for TravelSession — no runtime imports.
 * Breaks travelSession ↔ requirementAnalyzer cycle.
 */
export type BudgetCurrency = 'SAR' | 'USD' | 'EUR' | 'GBP' | 'AED' | ''
export type VisaStatus = '' | 'visa-free' | 'visa-required' | 'visa-on-arrival' | 'has-visa'
export type FlexibleDates = '' | 'flexible' | 'fixed'
export type DirectFlightPreference = '' | 'direct-only' | 'direct-preferred' | 'any'
export type BaggagePreference = '' | 'carry-on-only' | 'checked-bag' | 'extra-baggage'
export type TransportPreference = '' | 'public-transport' | 'private-transfer' | 'rental-car' | 'taxi-ride-hail'
export type AccommodationPreference = '' | 'hotel' | 'resort' | 'apartment' | 'villa' | 'hostel'
export type CabinClass = '' | 'economy' | 'premium-economy' | 'business' | 'first'


export interface TravelSession {
  // ── Core session fields (conversation-collected) ──
  destination: string
  departureCity: string
  departureCountry: string
  departureDate: string
  returnDate: string
  durationDays: number | null
  adults: number | null
  children: number | null
  infants: number | null
  budgetAmount: number | null
  budgetCurrency: BudgetCurrency
  tripPurpose: string
  preferredAirline: string
  preferredHotelCategory: string
  cabinClass: CabinClass
  visaStatus: VisaStatus
  interests: string
  flexibleDates: FlexibleDates
  directFlightPreference: DirectFlightPreference
  baggagePreference: BaggagePreference
  transportPreference: TransportPreference
  accommodationPreference: AccommodationPreference

  // ── Analysis profile (inferred by requirementAnalyzer) ──
  travelPurpose: string
  travelerType: string
  preferredClimate: string
  hotelCategory: string
  activityStyle: string
  foodPreference: string
  transportationPreference: string
  flexibilityScore: number
  budgetPriority: string
  comfortPriority: number
  luxuryPriority: number
  familyRequirements: string
  childFriendlyRequired: boolean
  accessibilityNeeds: string
  preferredFlightTime: string
  preferredHotelArea: string
  preferredLanguage: string
  visaConcern: string
  shoppingInterest: number
  natureInterest: number
  cultureInterest: number
  entertainmentInterest: number
  beachInterest: number
  cityInterest: number
  safetyPriority: number
  fieldConfidence: Record<string, string>

  // ── Decision profile ──
  decisionProfileConfirmed: boolean
  explicitFields: string[]
  inferredFields: string[]
  inferenceConfidence: Record<string, string>
  confirmedAt: string | null

  // ── Meta ──
  lastConversationText: string
  completedFields: string[]
  missingFields: string[]
  completionPercentage: number
  lastUpdatedAt: string
}
