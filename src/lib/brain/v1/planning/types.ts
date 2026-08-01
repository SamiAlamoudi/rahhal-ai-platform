/**
 * Sprint 84 — Travel Planning Engine contracts (Brain v1 island).
 * Gated by `ai.brain.v1`. No UI / Voice / providers / booking / planTurn.
 */

import type { BrainV1Intent } from '../types'

export const TRAVEL_PLANNING_ENGINE_VERSION = '1.0.0-travel-planning-engine'

export type TravelGoalStatus =
  | 'draft'
  | 'active'
  | 'waiting_user'
  | 'ready'
  | 'executing'
  | 'completed'
  | 'cancelled'

export type TravelGoalPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface TravelGoal {
  goalId: string
  intent: BrainV1Intent
  /** Human-readable goal, e.g. "Travel to Morocco". */
  label: string
  priority: TravelGoalPriority
  status: TravelGoalStatus
  createdAt: string
  updatedAt: string
  confidence: number
}

/** Slot keys supported by the Slot Filling Engine. */
export type TravelPlanSlotKey =
  | 'origin'
  | 'destination'
  | 'dates'
  | 'flexibleDates'
  | 'adults'
  | 'children'
  | 'cabin'
  | 'budget'
  | 'hotelPreference'
  | 'transportation'
  | 'activities'
  | 'visa'
  | 'language'
  | 'currency'
  | 'specialRequests'

export type TravelPlanSlotValue =
  | string
  | number
  | boolean
  | string[]
  | { start: string | null; end: string | null }
  | null

export interface TravelPlanSlots {
  origin: string | null
  destination: string | null
  dates: { start: string | null; end: string | null }
  flexibleDates: boolean | null
  adults: number | null
  children: number | null
  cabin: string | null
  budget: number | null
  hotelPreference: string | null
  transportation: string | null
  activities: string[]
  visa: string | null
  language: string | null
  currency: string | null
  specialRequests: string | null
}

export type PlanningConversationState =
  | 'Planning'
  | 'WaitingUser'
  | 'UpdatingPlan'
  | 'Ready'
  | 'Executing'
  | 'Completed'
  | 'Cancelled'
  | 'Recovered'

export type TravelPlanCompletionStatus =
  | 'incomplete'
  | 'ready_for_providers'
  | 'executing'
  | 'completed'
  | 'cancelled'

export interface TravelPlanConstraint {
  id: string
  kind: 'budget_max' | 'cabin' | 'hotel' | 'dates' | 'travelers' | 'other'
  detail: string
}

export interface TravelPlanExecutionStep {
  id: string
  label: string
  status: 'pending' | 'blocked' | 'ready' | 'done' | 'skipped'
  dependsOn: string[]
}

export interface TravelPlanRevision {
  at: string
  changedSlots: TravelPlanSlotKey[]
  note: string
}

export interface TravelPlan {
  planId: string
  goal: TravelGoal
  constraints: TravelPlanConstraint[]
  knownSlots: TravelPlanSlots
  missingSlots: TravelPlanSlotKey[]
  plannerNotes: string[]
  executionSteps: TravelPlanExecutionStep[]
  completionStatus: TravelPlanCompletionStatus
  conversationState: PlanningConversationState
  revisions: TravelPlanRevision[]
  nextQuestion: TravelPlanQuestion | null
  validation: TravelPlanValidationResult
  itinerary: ItinerarySkeleton | null
  createdAt: string
  updatedAt: string
}

export interface TravelPlanQuestion {
  slot: TravelPlanSlotKey
  priority: number
  questionAr: string
  questionEn: string
}

export type TravelPlanValidationIssueKind =
  | 'missing_required'
  | 'conflict'
  | 'impossible_dates'
  | 'invalid_travelers'
  | 'budget_conflict'

export interface TravelPlanValidationIssue {
  kind: TravelPlanValidationIssueKind
  slot?: TravelPlanSlotKey
  detail: string
  severity: 'error' | 'warning'
}

export interface TravelPlanValidationResult {
  ok: boolean
  issues: TravelPlanValidationIssue[]
}

export interface ItineraryDaySkeleton {
  day: number
  date: string | null
  flights: string[]
  hotels: string[]
  transfers: string[]
  activities: string[]
  freeTime: string[]
  notes: string[]
}

/** Provider-independent itinerary structure. */
export interface ItinerarySkeleton {
  destination: string | null
  origin: string | null
  startDate: string | null
  endDate: string | null
  days: ItineraryDaySkeleton[]
  notes: string[]
}

export interface TravelPlanningTurnInput {
  text: string
  locale?: 'ar' | 'en'
  /** Resume / recover from a prior plan snapshot. */
  priorPlan?: TravelPlan | null
  /** Explicit interrupt marker — next turn becomes Recovered then continues. */
  interrupted?: boolean
}

export interface TravelPlanningTurnResult {
  version: string
  enabled: boolean
  plan: TravelPlan | null
  goal: TravelGoal | null
  conversationState: PlanningConversationState | null
  nextQuestion: TravelPlanQuestion | null
  known: Partial<Record<TravelPlanSlotKey, TravelPlanSlotValue>>
  missing: TravelPlanSlotKey[]
  revisedSlots: TravelPlanSlotKey[]
  recovered: boolean
}

export function emptyTravelPlanSlots(): TravelPlanSlots {
  return {
    origin: null,
    destination: null,
    dates: { start: null, end: null },
    flexibleDates: null,
    adults: null,
    children: null,
    cabin: null,
    budget: null,
    hotelPreference: null,
    transportation: null,
    activities: [],
    visa: null,
    language: null,
    currency: null,
    specialRequests: null,
  }
}
