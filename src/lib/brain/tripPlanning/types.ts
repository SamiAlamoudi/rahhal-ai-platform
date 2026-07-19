/**
 * Sprint 22 — Multi-Step AI Trip Planning Engine types.
 * No LLM providers; structured planning only.
 */

import type { TripPlan as AgentTripPlan } from '../../agent/types'
import type { BrainLocale, BudgetSlot, CabinClass, TravelDates } from '../types'

export type PlanningStage =
  | 'collect'
  | 'detect_missing'
  | 'clarify'
  | 'update_memory'
  | 'produce_plan'
  | 'complete'

export type PlanningField =
  | 'destination'
  | 'departureCity'
  | 'travelDates'
  | 'travelerCount'
  | 'cabinClass'
  | 'hotelPreferences'
  | 'roomRequirements'
  | 'transportation'
  | 'activities'
  | 'budget'
  | 'airlinePreferences'
  | 'notes'

/** Planning Session — durable trip planning state across turns. */
export interface PlanningSession {
  id: string
  conversationId: string
  locale: BrainLocale
  stage: PlanningStage
  destination: string | null
  departureCity: string | null
  travelDates: TravelDates
  /** Date / plan flexibility signal. */
  flexibility: boolean
  travelerCount: number | null
  adults: number | null
  children: number | null
  infants: number | null
  cabinClass: CabinClass | null
  hotelPreferences: string[]
  roomRequirements: string | null
  transportation: string[]
  activities: string[]
  budget: BudgetSlot
  airlinePreferences: string[]
  notes: string | null
  askedFields: PlanningField[]
  answeredFields: PlanningField[]
  /** Last produced planning TripPlan id (when complete). */
  tripPlanId: string | null
  createdAt: string
  updatedAt: string
}

export type CorrectionKind =
  | 'destination'
  | 'departureCity'
  | 'travelDates'
  | 'travelers'
  | 'budget_increase'
  | 'budget_decrease'
  | 'hotel_upgrade'
  | 'cheaper_flight'
  | 'cabinClass'
  | 'airlinePreferences'
  | 'activities'
  | 'notes'

export interface CorrectionPatch {
  kind: CorrectionKind
  field: PlanningField
  previous: unknown
  next: unknown
  signal: string
}

/**
 * Structured TripPlan produced by the planning engine.
 * Embeds agent TripPlan when complete so booking workflow can continue.
 */
export interface TripPlan {
  id: string
  sessionId: string
  conversationId: string
  locale: BrainLocale
  status: 'draft' | 'partial' | 'complete'
  destination: string | null
  departureCity: string | null
  travelDates: TravelDates
  flexibility: boolean
  travelerCount: number | null
  adults: number | null
  children: number | null
  infants: number | null
  cabinClass: CabinClass | null
  hotelPreferences: string[]
  roomRequirements: string | null
  transportation: string[]
  activities: string[]
  budget: BudgetSlot
  airlinePreferences: string[]
  notes: string | null
  /** Agent-layer itinerary when status is complete (drives booking). */
  agentTripPlan: AgentTripPlan | null
  updatedAt: string
}

export interface ClarificationPlan {
  field: PlanningField | null
  question: string | null
  reason: 'missing_required' | 'none'
  /** Exactly one clarification per turn when needed. */
  singleQuestion: boolean
}

export interface TravelSummary {
  headline: string
  bullets: string[]
  completeness: number
  knownSlots: PlanningField[]
  missingSlots: PlanningField[]
}

export interface TripPlanningTurnResult {
  session: PlanningSession
  stage: PlanningStage
  clarification: ClarificationPlan
  travelSummary: TravelSummary
  tripPlan: TripPlan | null
  corrections: CorrectionPatch[]
  /** Stages visited this turn (for tests / debug). */
  stagesVisited: PlanningStage[]
}

export interface TripPlanningEngineOptions {
  conversationId?: string
  locale?: BrainLocale
  session?: PlanningSession
}
