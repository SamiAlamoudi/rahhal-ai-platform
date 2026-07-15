/**
 * Phase AD — Itinerary Generation Engine v1 models.
 * Additive AI-layer types; does not replace agent TripPlan contracts.
 */

export type ItineraryOptimizationGoal =
  | 'minimum_travel_time'
  | 'budget_fit'
  | 'preference_score'
  | 'activity_diversity'

export type ActivitySlotKind =
  | 'flight'
  | 'hotel'
  | 'transport'
  | 'activity'
  | 'meal'
  | 'free_time'

export interface ActivitySlot {
  id: string
  kind: ActivitySlotKind
  title: string
  startTime: string
  endTime: string
  location: string
  estimatedCost: number
  currency: string
  preferenceTags: string[]
  notes: string | null
}

export interface ItineraryDay {
  day: number
  date: string | null
  title: string
  location: string
  slots: ActivitySlot[]
  /** Convenience projection of non-free-time slots. */
  activities: ActivitySlot[]
  freeTimeMinutes: number
  estimatedDayCost: number
}

export interface CostBreakdown {
  currency: string
  flights: number
  hotels: number
  activities: number
  transportation: number
  meals: number
  other: number
  total: number
  budgetAmount: number | null
  budgetDelta: number | null
  withinBudget: boolean | null
}

export interface OptimizationScores {
  travelTime: number
  budgetFit: number
  preferenceScore: number
  activityDiversity: number
  overall: number
}

export interface OptimizationResult {
  goal: ItineraryOptimizationGoal
  scores: OptimizationScores
  summary: string
  tradeOffs: string[]
  improvementsApplied: string[]
}

export interface ItineraryFlightLeg {
  id: string
  from: string
  to: string
  airline: string | null
  departAt: string | null
  arriveAt: string | null
  estimatedCost: number
  currency: string
  direct: boolean
}

export interface ItineraryHotelStay {
  id: string
  name: string
  area: string
  checkIn: string | null
  checkOut: string | null
  nights: number
  estimatedNightly: number
  estimatedTotal: number
  currency: string
  tags: string[]
}

export interface ItineraryTransportLeg {
  id: string
  mode: string
  from: string
  to: string
  day: number
  estimatedCost: number
  currency: string
  durationMinutes: number
}

export interface ItineraryExplanation {
  confidence: number
  optimizationSummary: string
  assumptions: string[]
  tradeOffs: string[]
  matchedPreferences: string[]
  unmatchedPreferences: string[]
}

export interface Itinerary {
  id: string
  title: string
  destination: string
  destinations: string[]
  startDate: string | null
  endDate: string | null
  durationDays: number
  locale: 'ar' | 'en'
  days: ItineraryDay[]
  flights: ItineraryFlightLeg[]
  hotels: ItineraryHotelStay[]
  transportation: ItineraryTransportLeg[]
  costs: CostBreakdown
  optimization: OptimizationResult
  explanation: ItineraryExplanation
  recommendationIds: string[]
  version: 1
  createdAt: string
}

export interface ItineraryEngineInput {
  destination: string
  destinations?: string[]
  locale?: 'ar' | 'en'
  startDate?: string | null
  endDate?: string | null
  durationDays: number
  budgetAmount?: number | null
  budgetCurrency?: string
  origin?: string | null
  travelerType?: 'solo' | 'couple' | 'family' | 'friends' | 'business' | null
  travelStyle?: string | null
  interests?: string[]
  constraints?: {
    mustAvoid?: string[]
    maxActivitiesPerDay?: number
    preferDirectFlights?: boolean
    preferCentralHotels?: boolean
  }
  /** Optimization goal (default preference_score). */
  optimizationGoal?: ItineraryOptimizationGoal
  /** Optional RecommendationEngine output candidate IDs / titles to seed activities. */
  recommendations?: Array<{
    id: string
    title: string
    kind: string
    score?: number
    confidence?: number
    matchedPreferences?: string[]
    tags?: string[]
    estimatedCost?: number | null
  }>
  profile?: {
    interests?: string[]
    travelStyle?: string | null
    preferDirectFlights?: boolean
    preferCentralHotels?: boolean
    budgetStyle?: 'luxury' | 'midrange' | 'budget' | null
  } | null
}
