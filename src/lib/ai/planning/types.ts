/**
 * Phase AB — AI planning enhancement types (additive; does not mutate TripPlan contracts).
 */

export interface MultiDestinationPlanInput {
  destinations: string[]
  durationDays: number
  locale?: 'ar' | 'en'
  interests?: string[]
}

export interface MultiDestinationSegment {
  order: number
  destination: string
  nights: number
  focus: string
}

export interface MultiDestinationOutline {
  destinations: string[]
  segments: MultiDestinationSegment[]
  totalNights: number
  confidence: number
}

export interface AlternativeItineraryVariant {
  id: string
  label: string
  style: 'balanced' | 'budget' | 'comfort' | 'adventure'
  summary: string
  confidence: number
  estimatedBudgetDeltaPct: number
  reasons: string[]
}

export interface ExplainableRecommendation {
  subjectId: string
  subjectKind: 'flight' | 'hotel' | 'itinerary' | 'activity'
  whySelected: string[]
  whyAlternativesRejected: string[]
  confidence: number
  preferenceWeightsApplied: boolean
}

export interface PlanningConfidence {
  overall: number
  destinationCoverage: number
  budgetFit: number
  preferenceFit: number
  scheduleFeasibility: number
}
