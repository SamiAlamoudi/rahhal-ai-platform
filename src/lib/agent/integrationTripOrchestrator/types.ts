/**
 * Integration Sprint 4 — AI Trip Orchestrator contracts.
 * Coordinates flights/hotels (and future domains). Does not replace providers.
 */

export const INTEGRATION_TRIP_ORCHESTRATOR_VERSION = '1.0.0-integration-trip-orchestrator'

export type OrchestratorStepId =
  | 'extract'
  | 'budget'
  | 'search_flights'
  | 'search_hotels'
  | 'compare'
  | 'recommend'
  | 'itinerary'
  | 'summarize'

export type OrchestratorStepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed'

export interface OrchestratorStep {
  id: OrchestratorStepId
  label: string
  status: OrchestratorStepStatus
  parallelGroup?: number | null
  detail?: string | null
}

export interface OrchestratorExecutionPlan {
  steps: OrchestratorStep[]
  parallelGroups: number[]
}

export interface OrchestratorBudgetSplit {
  total: number
  currency: string
  flights: number
  hotels: number
  transportation: number
  activities: number
  /** Soft contingency retained from total. */
  buffer: number
  explanationAr: string
  explanationEn: string
}

export type OrchestratorConflictCode =
  | 'missing_destination'
  | 'missing_dates'
  | 'budget_conflict'
  | 'date_conflict'
  | 'flights_unavailable'
  | 'hotels_unavailable'
  | 'over_budget'

export interface OrchestratorConflict {
  code: OrchestratorConflictCode
  severity: 'info' | 'warn' | 'blocker'
  messageAr: string
  messageEn: string
  suggestionAr?: string
  suggestionEn?: string
}

export interface OrchestratorItineraryDay {
  day: number
  title: string
  location: string
  items: string[]
}

export interface OrchestratorItinerary {
  departure: string | null
  arrival: string | null
  hotel: string | null
  checkIn: string | null
  checkOut: string | null
  returnDate: string | null
  days: OrchestratorItineraryDay[]
}

export interface OrchestratorRecommendation {
  flight: Record<string, unknown> | null
  hotel: Record<string, unknown> | null
  whyFlightAr: string
  whyFlightEn: string
  whyHotelAr: string
  whyHotelEn: string
  whyComboAr: string
  whyComboEn: string
  tradeOffsAr: string
  tradeOffsEn: string
  estimatedTotal: number | null
  currency: string
}

export interface TripOrchestratorResult {
  version: string
  enabled: boolean
  ok: boolean
  incomplete: boolean
  missingFields: string[]
  executionPlan: OrchestratorExecutionPlan
  budget: OrchestratorBudgetSplit | null
  conflicts: OrchestratorConflict[]
  recommendation: OrchestratorRecommendation | null
  itinerary: OrchestratorItinerary | null
  consultantSummaryAr: string
  consultantSummaryEn: string
  usedLiveFlights: boolean
  usedLiveHotels: boolean
  parallelMs: number
  latencyMs: number
  scenario: string | null
  logs: string[]
}
