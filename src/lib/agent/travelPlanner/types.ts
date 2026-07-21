/**
 * Sprint 78 — AI Travel Strategy Planner contracts (additive).
 */

export type TravelPurpose =
  | 'business'
  | 'vacation'
  | 'family'
  | 'conference'
  | 'medical'
  | 'education'
  | 'religious'
  | 'luxury'
  | 'weekend'
  | 'adventure'
  | 'shopping'
  | 'honeymoon'
  | 'unknown'

export type TripType =
  | 'one_way'
  | 'round_trip'
  | 'multi_city'
  | 'weekend_getaway'
  | 'extended_stay'
  | 'unknown'

export type PlannerTravelerType =
  | 'solo'
  | 'couple'
  | 'family'
  | 'friends'
  | 'business'
  | 'group'
  | 'unknown'

export type ConstraintKind =
  | 'budget'
  | 'visa'
  | 'dates'
  | 'airport'
  | 'airline'
  | 'hotel_brand'
  | 'children'
  | 'senior_travelers'
  | 'medical_needs'
  | 'accessibility'
  | 'layover_limit'
  | 'direct_flight'
  | 'meeting_time'
  | 'check_in_time'
  | 'weather'
  | 'origin'
  | 'destination'

export interface DetectedConstraint {
  kind: ConstraintKind
  value: string | number | boolean | null
  required: boolean
  note?: string
}

export interface PlannerPreference {
  kind: string
  value: string
  polarity: 'prefer' | 'avoid' | 'neutral'
}

export interface PriorityWeights {
  price: number
  speed: number
  comfort: number
  convenience: number
  luxury: number
  family: number
  business: number
}

export type SearchToolHint =
  | 'flights'
  | 'hotels'
  | 'weather'
  | 'visa'
  | 'maps'
  | 'attractions'
  | 'transportation'
  | 'currency'

export interface SearchPlan {
  searchImmediately: boolean
  shouldAskQuestion: boolean
  needVisaCheck: boolean
  needWeather: boolean
  needAirportTransfer: boolean
  hotelFirst: boolean
  flightsFirst: boolean
  multiCity: boolean
  flexibleDates: boolean
  recommendedSearchOrder: SearchToolHint[]
  skipTools: SearchToolHint[]
}

export interface TravelStrategy {
  summary: string
  approach: string
  engines: SearchToolHint[]
  rationale: string[]
}

export interface PlannerDecisions {
  shouldAskQuestion: boolean
  searchImmediately: boolean
  needVisaCheck: boolean
  needWeather: boolean
  needAirportTransfer: boolean
  needHotelFirst: boolean
  needFlightsFirst: boolean
  needMultiCity: boolean
  needFlexibleDates: boolean
}

export interface TravelPlannerDiagnostics {
  travelStrategy: string
  constraints: DetectedConstraint[]
  priorityWeights: PriorityWeights
  plannerReasoning: string[]
  confidenceScore: number
  questionsAsked: string[]
  searchPlan: SearchPlan
}

export interface TravelPlannerResult {
  version: string
  travelPurpose: TravelPurpose
  tripType: TripType
  travelerType: PlannerTravelerType
  constraints: DetectedConstraint[]
  preferences: PlannerPreference[]
  missingInformation: string[]
  requiredQuestions: string[]
  /** Single combined question when asking is required. */
  combinedQuestion: string | null
  recommendedSearchOrder: SearchToolHint[]
  priorityWeights: PriorityWeights
  riskFlags: string[]
  travelStrategy: TravelStrategy
  confidenceScore: number
  decisions: PlannerDecisions
  searchPlan: SearchPlan
  diagnostics: TravelPlannerDiagnostics
  recommendationFacts: string[]
  durationMs: number
}

export const SPRINT78_TRAVEL_PLANNER_VERSION = '1.0.0-travel-planner'
