/**
 * Sprint 83 — AI Dynamic Travel Package domain models.
 */

export const SPRINT83_DYNAMIC_PACKAGES_VERSION = '1.0.0-dynamic-packages'

export type PackageComponentKind =
  | 'flight'
  | 'hotel'
  | 'transfer'
  | 'activity'
  | 'insurance'
  | 'lounge'
  | 'esim'
  | 'visa'

export type PackageRankLabel =
  | 'best_overall'
  | 'best_budget'
  | 'best_business'
  | 'best_family'
  | 'best_luxury'
  | 'best_weekend'
  | 'best_value'

export interface PackageComponent {
  kind: PackageComponentKind
  id: string
  title: string
  price: number
  currency: string
  payload: Record<string, unknown>
}

export interface PackageScoreDimensions {
  total_cost: number
  travel_time: number
  hotel_rating: number
  walking_distance: number
  transfer_time: number
  cancellation_flexibility: number
  family_suitability: number
  luxury_level: number
  business_suitability: number
  loyalty_benefits: number
  activity_quality: number
  overall_value: number
}

export interface PackageScoreWeights {
  total_cost: number
  travel_time: number
  hotel_rating: number
  walking_distance: number
  transfer_time: number
  cancellation_flexibility: number
  family_suitability: number
  luxury_level: number
  business_suitability: number
  loyalty_benefits: number
  activity_quality: number
  overall_value: number
}

export const DEFAULT_PACKAGE_WEIGHTS: PackageScoreWeights = {
  total_cost: 0.18,
  travel_time: 0.1,
  hotel_rating: 0.12,
  walking_distance: 0.08,
  transfer_time: 0.06,
  cancellation_flexibility: 0.08,
  family_suitability: 0.07,
  luxury_level: 0.06,
  business_suitability: 0.06,
  loyalty_benefits: 0.05,
  activity_quality: 0.06,
  overall_value: 0.08,
}

export interface PackageCandidate {
  id: string
  title: string
  currency: string
  totalPrice: number
  components: PackageComponent[]
  destination: string | null
  checkIn: string | null
  checkOut: string | null
  arrivalAt: string | null
  departureAt: string | null
  score: number | null
  dimensions: PackageScoreDimensions | null
  /** 0.00–1.00 */
  confidence: number
  labels: PackageRankLabel[]
  reasons: string[]
  /** Lazy — null until explainer runs. */
  explanation: string | null
  compatible: boolean
  rejectionReasons: string[]
  normalizedKey: string
  providerConfidence: number
}

export interface NormalizedFlightOffer {
  id: string
  airline: string
  price: number
  currency: string
  durationMinutes: number | null
  stops: number
  arrivalAt: string | null
  departureAt: string | null
  destination: string | null
  origin: string | null
  cabin: string | null
  refundable: boolean
  loyaltyMatch: boolean
  seatsRemaining: number | null
  providerConfidence: number
  payload: Record<string, unknown>
}

export interface NormalizedHotelOffer {
  id: string
  name: string
  price: number
  currency: string
  stars: number | null
  rating: number | null
  walkMinutes: number | null
  checkIn: string | null
  checkOut: string | null
  destination: string | null
  familyFriendly: boolean
  refundable: boolean
  breakfastIncluded: boolean
  luxury: boolean
  businessFriendly: boolean
  providerConfidence: number
  payload: Record<string, unknown>
}

export interface NormalizedTransferOffer {
  id: string
  title: string
  price: number
  currency: string
  durationMinutes: number | null
  availableFrom: string | null
  availableTo: string | null
  destination: string | null
  providerConfidence: number
  payload: Record<string, unknown>
}

export interface NormalizedActivityOffer {
  id: string
  title: string
  price: number
  currency: string
  startAt: string | null
  endAt: string | null
  destination: string | null
  quality: number | null
  familyFriendly: boolean
  providerConfidence: number
  payload: Record<string, unknown>
}

export interface NormalizedAddonOffer {
  id: string
  kind: 'insurance' | 'lounge' | 'esim' | 'visa'
  title: string
  price: number
  currency: string
  providerConfidence: number
  payload: Record<string, unknown>
}

export interface PackageBuilderInput {
  flights: NormalizedFlightOffer[]
  hotels: NormalizedHotelOffer[]
  transfers?: NormalizedTransferOffer[]
  activities?: NormalizedActivityOffer[]
  addons?: NormalizedAddonOffer[]
  budgetCap?: number | null
  travelerType?: 'solo' | 'couple' | 'family' | 'business' | 'friends' | null
  tripPurpose?: string | null
  isWeekend?: boolean | null
  maxCandidates?: number
  /** Soft preference biases from Adaptive Learning (additive). */
  preferenceBiases?: Partial<{
    luxury: number
    family: number
    price: number
    walkability: number
    comfort: number
  }>
  /** Soft score enrichment from Price Intelligence (0–100 timing confidence). */
  priceTimingBoost?: number | null
}
