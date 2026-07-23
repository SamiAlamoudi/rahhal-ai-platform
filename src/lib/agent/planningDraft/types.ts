/**
 * Planning Draft — internal trip intelligence (not a booking, not a final itinerary).
 * Deterministic estimates for Conversation Brain reasoning only.
 *
 * Hard rules:
 * - Never invent travelerCount (null when unknown).
 * - Never silently default unknown scalars.
 * - Every money estimate is a range with confidence + reason.
 */

export type PlanningConfidence = 'low' | 'medium' | 'high'

export type CityBudgetFit = 'comfortable' | 'balanced' | 'tight' | 'stretch'

/** One estimated money line — always a range with uncertainty metadata. */
export interface PlanningEstimate {
  low: number
  mid: number
  high: number
  currency: string
  confidence: PlanningConfidence
  reason: string
}

export interface PlanningDraftBreakdown {
  flights: PlanningEstimate
  hotels: PlanningEstimate
  food: PlanningEstimate
  transportation: PlanningEstimate
  activities: PlanningEstimate
  estimatedTotal: PlanningEstimate
}

export interface PlanningDraftCityOption {
  name: string
  /** Relative hotel/cost pressure vs sibling cities. */
  relativeHotelCost: 'lower' | 'typical' | 'higher'
  fit: CityBudgetFit
  why: string
  /** City trip total as a range (not a false point). */
  estimatedTotal: PlanningEstimate
  hotelNightly: PlanningEstimate
}

export interface PlanningDraft {
  kind: 'planning_draft'
  destination: string
  cities: PlanningDraftCityOption[]
  /** Ranked city names (best fit first). */
  rankedCities: string[]
  /**
   * Explicit duration only (durationDays or closed start/end window).
   * null when not stated — never invent 5/7.
   */
  durationDays: number | null
  /**
   * Soft planning suggestion when durationDays is null.
   * Never used as a silent fact; always listed under missingAssumptions.
   */
  recommendedDurationDays: number | null
  /**
   * Explicit traveler count only.
   * Derived from travelers, or solo→1 / couple→2 when travelerType was extracted.
   * null otherwise — never invent 2.
   */
  travelerCount: number | null
  budgetAmount: number | null
  budgetCurrency: string
  budgetFlexible: boolean
  breakdown: PlanningDraftBreakdown
  dailySpendEstimate: PlanningEstimate
  confidence: PlanningConfidence
  /** Numeric 0–1 companion to the label. */
  confidenceScore: number
  missingAssumptions: string[]
  tradeoffs: string[]
  /** One-line consultant insight derived from ranking (not a prompt template). */
  rankingNote: string
  /** Month 1–12 when inferred from startDate, else null. */
  monthHint: number | null
  generatedFor: {
    startDate: string | null
    origin: string | null
  }
}
