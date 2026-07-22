/**
 * Sprint 91 — Production Alpha Experience contracts.
 * Presentation / orchestration only — no engine redesign.
 */

export const SPRINT91_ALPHA_EXPERIENCE_VERSION = '1.0.0-alpha-experience'

/** Product-facing thinking timeline stages. */
export type AlphaTimelineStageId =
  | 'analyzing_request'
  | 'understanding_intent'
  | 'constitution_check'
  | 'search_planning'
  | 'searching_flights'
  | 'searching_hotels'
  | 'comparing_options'
  | 'building_package'
  | 'optimizing_itinerary'
  | 'decision'
  | 'generating_alternatives'
  | 'preparing_recommendation'
  | 'completed'
  | 'recovering'

export type AlphaTimelineStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'recovered'

export interface AlphaTimelineStage {
  id: AlphaTimelineStageId
  label: string
  status: AlphaTimelineStatus
  startedAt: string | null
  completedAt: string | null
  durationMs: number
  /** 0–100 cumulative progress after this stage settles. */
  progressPercent: number
  message: string | null
  recoverable: boolean
  errorMessage: string | null
}

export interface AlphaProgressTimeline {
  stages: AlphaTimelineStage[]
  currentStageId: AlphaTimelineStageId | null
  progressPercent: number
  startedAt: string
  completedAt: string | null
  durationMs: number
  hasRecoverableFailure: boolean
}

export type AlphaScenarioKind =
  | 'best_value'
  | 'cheapest'
  | 'luxury'
  | 'family'
  | 'business'
  | 'fastest'
  | 'adventure'

export interface AlphaConfidenceBreakdown {
  overall: number
  flight: number
  hotel: number
  package: number
  decision: number
  refinement: number
  reasoningSummary: string
}

export interface AlphaExplanation {
  whyFlight: string
  whyHotel: string
  whyPackage: string
  tradeoffs: string[]
  budgetImpact: string
  timeImpact: string
  qualityImpact: string
  summary: string
}

export interface AlphaTripSummary {
  destination: string | null
  origin: string | null
  startDate: string | null
  endDate: string | null
  durationDays: number | null
  travelers: number | null
  travelerType: string | null
  currency: string
}

export interface AlphaFlightPresentation {
  id: string
  airline: string | null
  origin: string | null
  destination: string | null
  price: number | null
  currency: string
  durationMinutes: number | null
  stops: number | null
  cabin: string | null
}

export interface AlphaHotelPresentation {
  id: string
  name: string | null
  destination: string | null
  price: number | null
  currency: string
  stars: number | null
  rating: number | null
}

export interface AlphaTransportPresentation {
  id: string
  title: string
  price: number | null
  currency: string
}

export interface AlphaActivityPresentation {
  id: string
  title: string
  price: number | null
  currency: string
}

export interface AlphaAlternativeScenario {
  kind: AlphaScenarioKind
  label: string
  estimatedCost: number | null
  currency: string
  confidence: number
  explanation: string
  packageId: string | null
  candidateId: string | null
}

export interface AlphaRecommendation {
  tripSummary: AlphaTripSummary
  flights: AlphaFlightPresentation[]
  hotels: AlphaHotelPresentation[]
  transportation: AlphaTransportPresentation[]
  activities: AlphaActivityPresentation[]
  estimatedCost: number | null
  currency: string
  confidence: AlphaConfidenceBreakdown
  explanation: AlphaExplanation
  warnings: string[]
  recommendations: string[]
  alternatives: AlphaAlternativeScenario[]
  recoveryMessages: string[]
  packageTitle: string | null
  decisionExplanation: string | null
}

export type AlphaExperienceEventName =
  | 'conversation.started'
  | 'intent.extracted'
  | 'constitution.validated'
  | 'search.planned'
  | 'search.completed'
  | 'decision.completed'
  | 'package.completed'
  | 'refinement.completed'
  | 'recommendation.generated'
  | 'conversation.completed'
  | 'recovery.triggered'

export interface AlphaExperienceEvent {
  name: AlphaExperienceEventName
  at: string
  durationMs?: number
  detail?: Record<string, unknown>
}

export interface AlphaOrchestrationRequirements {
  destination?: string | null
  destinations?: string[]
  origin?: string | null
  startDate?: string | null
  endDate?: string | null
  durationDays?: number | null
  travelers?: number | null
  travelerType?: string | null
  budgetAmount?: number | null
  budgetCurrency?: string | null
  interests?: string[]
  mission?: string | null
}

export interface AlphaOrchestrationInput {
  conversationId?: string
  userText: string
  requirements?: AlphaOrchestrationRequirements
  intent?: string | null
  /** Optional pre-supplied offer pools (skips live provider search when both non-empty). */
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  providerRegistry?: import('../providers').ProviderRegistry | null
  budgetCap?: number | null
  hasChildren?: boolean
  signal?: AbortSignal
}

export interface AlphaOrchestrationResult {
  version: string
  conversationId: string
  timeline: AlphaProgressTimeline
  recommendation: AlphaRecommendation
  events: AlphaExperienceEvent[]
  searchPlanCount: number
  packageCount: number
  alternativeCount: number
  constitutionOk: boolean
  recovered: boolean
  durationMs: number
}
