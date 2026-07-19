/**
 * Sprint 32 — AI Conversation Experience domain types.
 * Additive layer over UnifiedTravelPlanner / AITripOrchestrator — no planning duplication.
 */

import type {
  UnifiedFollowUpQuestion,
  UnifiedTravelPlanOption,
  UnifiedTravelPlanResult,
  UnifiedTravelPlannerContext,
  UnifiedTripCostEstimate,
} from '../../brain/unifiedTravel/types'

export type ConversationPhase =
  | 'idle'
  | 'listening'
  | 'clarifying'
  | 'planning'
  | 'presenting'
  | 'editing'
  | 'comparing'
  | 'error'

export type ConversationCommandKind =
  | 'plan'
  | 'clarify_answer'
  | 'make_cheaper'
  | 'direct_flights'
  | 'upgrade_hotel'
  | 'business_class'
  | 'travel_with_children'
  | 'stay_downtown'
  | 'shorten_trip'
  | 'increase_budget'
  | 'regenerate'
  | 'compare_options'
  | 'continue'
  | 'pay_now'
  | 'my_trip'
  | 'show_itinerary'
  | 'download_ticket'
  | 'any_delays'
  | 'what_hotel'
  | 'unknown'

export type ConversationMessageRole = 'user' | 'assistant' | 'system'

export interface ConversationMessage {
  id: string
  conversationId: string
  role: ConversationMessageRole
  content: string
  createdAt: string
  /** Structured payload for assistant turns (Sprint 32). */
  structured?: ConversationStructuredResponse | null
  commandKind?: ConversationCommandKind | null
  meta?: Record<string, unknown>
}

export interface ConversationSuggestedAction {
  id: string
  label: string
  commandHint: string
}

export interface ConversationStructuredResponse {
  summary: string
  flights: Array<{
    id: string
    airline: string
    from: string
    to: string
    cabin: string
    price: number
    currency: string
    stops: number
  }>
  hotels: Array<{
    id: string
    name: string
    area: string
    stars: number
    nightly: number
    currency: string
  }>
  dailyItinerary: Array<{
    day: number
    date: string | null
    title: string
    summary: string
    items: string[]
  }>
  estimatedTotalCost: UnifiedTripCostEstimate | null
  confidenceScore: number
  reasoning: string[]
  suggestedFollowUpActions: ConversationSuggestedAction[]
  plans: UnifiedTravelPlanOption[]
  topPlanId: string | null
  followUps: UnifiedFollowUpQuestion[]
  phase: ConversationPhase
}

export interface ConversationState {
  phase: ConversationPhase
  locale: 'ar' | 'en'
  /** Accumulated planning context across turns (incremental). */
  context: UnifiedTravelPlannerContext
  lastPlanResult: UnifiedTravelPlanResult | null
  pendingFollowUpField: string | null
  /** True once the user explicitly stated traveler count. */
  travelersConfirmed: boolean
  editCount: number
  compareMode: boolean
  lastCommand: ConversationCommandKind | null
  updatedAt: string
}

export interface ConversationSession {
  id: string
  conversationId: string
  title: string
  state: ConversationState
  messages: ConversationMessage[]
  createdAt: string
  updatedAt: string
}

export type ConversationEventType =
  | 'session_started'
  | 'turn_started'
  | 'command_detected'
  | 'follow_up'
  | 'planning_started'
  | 'planning_completed'
  | 'response_composed'
  | 'stream_delta'
  | 'stream_done'
  | 'turn_completed'
  | 'error'

export interface ConversationEvent {
  type: ConversationEventType
  at: string
  conversationId: string
  data?: Record<string, unknown>
}

export interface ConversationTurnInput {
  conversationId: string
  userText: string
  locale?: 'ar' | 'en'
  userId?: string
  signal?: AbortSignal
  /** Continue an existing session id (same conversation). */
  sessionId?: string
}

export interface ConversationTurnResult {
  session: ConversationSession
  userMessage: ConversationMessage
  assistantMessage: ConversationMessage
  structured: ConversationStructuredResponse
  renderedText: string
  planResult: UnifiedTravelPlanResult | null
  commandKind: ConversationCommandKind
  durationMs: number
}
