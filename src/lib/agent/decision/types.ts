/**
 * Intelligent Decision Engine models.
 * Attached to TripPlan as optional enrichment — core TripPlan fields stay unchanged.
 */

export type RegenerateScope =
  | 'whole'
  | 'day'
  | 'flight'
  | 'hotel'
  | 'activities'

export interface TripDecisionScores {
  /** Composite 0–100. */
  overall: number
  flight: number
  hotel: number
  dailyItinerary: number
  budget: number
  comfort: number
  timeEfficiency: number
}

export interface DecisionRationale {
  whySelected: string
  whyAlternativesRejected: string[]
  confidence: number
  estimatedSavings: number | null
  estimatedTimeSavedMinutes: number | null
  currency: string | null
}

export interface DecisionAlternative {
  kind: 'flight' | 'hotel' | 'activity' | 'day'
  title: string
  reasonRejected: string
  score: number
}

export interface DecisionConflict {
  code: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  suggestion: string | null
}

export interface TripDecision {
  scores: TripDecisionScores
  flight: DecisionRationale | null
  hotel: DecisionRationale | null
  activities: DecisionRationale | null
  conflicts: DecisionConflict[]
  alternatives: DecisionAlternative[]
  suggestions: string[]
  /** Engine version for debugging / tests. */
  version: 1
}
