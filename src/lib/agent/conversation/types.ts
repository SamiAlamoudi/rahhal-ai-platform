/**
 * Phase 3 Stage 1 — Conversation Orchestrator types.
 * Conversation management contracts only. No planning / scoring algorithms.
 */

export type ConversationLocale = 'ar' | 'en'

export type ConversationIntent =
  | 'destination_discovery'
  | 'trip_planning'
  | 'recommendation'
  | 'budget_optimization'
  | 'itinerary_refinement'
  | 'compare_destinations'
  | 'general_travel_advice'
  | 'clarification_reply'
  | 'continue_previous'

export type ConversationReplyFormat =
  | 'executive'
  | 'short'
  | 'detailed'
  | 'consultant'

export type ConfidenceBand = 'high' | 'medium' | 'low'

export interface ConversationKnownFacts {
  destination?: string | null
  origin?: string | null
  budgetAmount?: number | null
  budgetCurrency?: string | null
  durationDays?: number | null
  adults?: number | null
  children?: number | null
  monthHint?: number | null
  interests?: string[]
  tripPurpose?: string | null
  compareWith?: string | null
}

export interface ConversationTurnRecord {
  turnNumber: number
  role: 'user' | 'assistant'
  text: string
  intent: ConversationIntent | null
  timestamp: string
}

export interface ConversationState {
  conversationId: string
  locale: ConversationLocale
  turnNumber: number
  answeredQuestions: string[]
  missingInformation: string[]
  activeGoals: string[]
  currentTrip: {
    destination?: string | null
    durationDays?: number | null
    budgetAmount?: number | null
    budgetCurrency?: string | null
  }
  pendingClarification: string | null
  conversationHistory: ConversationTurnRecord[]
  knownFacts: ConversationKnownFacts
  lastIntent: ConversationIntent | null
  updatedAt: string
}

export interface ConversationOrchestratorInput {
  conversationId: string
  userText: string
  locale?: ConversationLocale
  /** Prior known facts (append-only; user corrections win). */
  known?: ConversationKnownFacts
  format?: ConversationReplyFormat
  /** Existing conversation state (optional — loaded from memory when omitted). */
  state?: ConversationState | null
  tripPlan?: unknown
  requirements?: unknown
  toolResults?: unknown[]
  signal?: AbortSignal
  enabled?: boolean
  now?: Date
}

export interface ConversationOrchestratorResult {
  enabled: true
  conversationId: string
  intent: ConversationIntent
  confidenceBand: ConfidenceBand
  confidence: number
  stagesRequested: string[]
  reply: string
  spokenText: string
  format: ConversationReplyFormat
  clarificationQuestion: string | null
  state: ConversationState
  /** Opaque runtime coordinator snapshot (read-only). */
  runtime: unknown | null
  /** Opaque unified consultant response (read-only). */
  consultantResponse: unknown | null
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

export function isoNow(now?: Date): string {
  return (now ?? new Date()).toISOString()
}

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.7) return 'high'
  if (score >= 0.35) return 'medium'
  return 'low'
}
