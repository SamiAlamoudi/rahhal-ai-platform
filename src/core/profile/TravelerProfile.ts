/**
 * Sprint 80 — Adaptive traveler profile domain models.
 * Local online learning only — no external training / no data leakage.
 */

export type PreferenceKind =
  | 'airline'
  | 'hotel_brand'
  | 'room_type'
  | 'cabin'
  | 'seat'
  | 'airport'
  | 'transfer_tolerance'
  | 'hotel_budget_style'
  | 'luxury_vs_value'
  | 'food'
  | 'activity'
  | 'travel_pace'
  | 'trip_duration'
  | 'favorite_destination'
  | 'disliked_destination'
  | 'booking_habit'
  | 'loyalty'
  | 'departure_time'
  | 'arrival_time'
  | 'family_pattern'
  | 'solo_pattern'
  | 'walkability'

export type PreferencePolarity = 'prefer' | 'avoid' | 'neutral'

/** Discrete confidence ladder (Sprint 80). */
export const CONFIDENCE_LEVELS = [0.1, 0.25, 0.4, 0.6, 0.8, 0.95] as const
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number]

export interface PreferenceEntry {
  kind: PreferenceKind
  value: string
  polarity: PreferencePolarity
  confidence: number
  observations: number
  updatedAt: string
  source: LearningSource
}

export type LearningSource =
  | 'conversation'
  | 'search_history'
  | 'accepted_recommendation'
  | 'rejected_recommendation'
  | 'booking_selection'
  | 'trip_completion'
  | 'user_correction'
  | 'explicit'
  | 'implicit'
  | 'repeated_behavior'

export interface BehaviorEvent {
  id: string
  type: LearningSource | 'search' | 'view' | 'select' | 'reject' | 'book' | 'complete' | 'correct'
  at: string
  payload: Record<string, unknown>
}

export interface TravelerProfile {
  userId: string
  version: 1
  learningEnabled: boolean
  preferences: PreferenceEntry[]
  behaviorHistory: BehaviorEvent[]
  /** Soft scoring weight biases derived from preferences (0–1 scale adjustments). */
  weightBiases: Partial<{
    price: number
    luxury: number
    walkability: number
    comfort: number
    speed: number
    family: number
  }>
  createdAt: string
  updatedAt: string
}

export interface LearningSession {
  sessionId: string
  userId: string
  startedAt: string
  completedAt: string | null
  eventsProcessed: number
  preferencesUpdated: number
  learningEnabled: boolean
}

export const SPRINT80_ADAPTIVE_LEARNING_VERSION = '1.0.0-adaptive-learning'
