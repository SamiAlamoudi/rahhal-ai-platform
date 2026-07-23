/**
 * Planning Draft — internal trip intelligence (not a booking, not a final itinerary).
 * Deterministic estimates for Conversation Brain reasoning only.
 */

export type PlanningConfidence = 'low' | 'medium' | 'high'

export type CityBudgetFit = 'comfortable' | 'balanced' | 'tight' | 'stretch'

export interface PlanningDraftBreakdown {
  flights: number
  hotels: number
  food: number
  transportation: number
  activities: number
  currency: string
  /** Sum of category estimates (may differ slightly from traveler budget). */
  estimatedTotal: number
}

export interface PlanningDraftCityOption {
  name: string
  /** Relative hotel/cost pressure vs sibling cities. */
  relativeHotelCost: 'lower' | 'typical' | 'higher'
  fit: CityBudgetFit
  why: string
  estimatedTotal: number
  hotelNightly: number
  /** 0–1 local confidence for this city row. */
  confidence: number
}

export interface PlanningDraft {
  kind: 'planning_draft'
  destination: string
  cities: PlanningDraftCityOption[]
  /** Ranked city names (best fit first). */
  rankedCities: string[]
  recommendedDurationDays: number
  assumedTravelers: number
  budgetAmount: number | null
  budgetCurrency: string
  budgetFlexible: boolean
  breakdown: PlanningDraftBreakdown
  dailySpendEstimate: number
  confidence: PlanningConfidence
  /** Numeric 0–1 companion to the label. */
  confidenceScore: number
  missingAssumptions: string[]
  tradeoffs: string[]
  /** One-line consultant insight derived from ranking (not a prompt template). */
  rankingNote: string
  /** Month 1–12 when inferred from startDate, else null. */
  monthHint: number | null
  /** ISO date of draft generation (deterministic hashing aid). */
  generatedFor: {
    startDate: string | null
    origin: string | null
  }
}
