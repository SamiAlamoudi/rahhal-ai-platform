/**
 * Evolution Sprint 1 — Consultant Reasoning Layer contracts.
 *
 * Additive only. Does not replace Sprint 45 travelReasoningEngine,
 * Decision Engine, Planning Draft, Conversation Brain, or Smart Clarification.
 * No network / booking / flight / hotel calls.
 */

export type ConsultantLocale = 'ar' | 'en'

export type TravelerIntentKind =
  | 'discover'
  | 'plan'
  | 'compare'
  | 'budget'
  | 'refine'
  | 'book_ready'
  | 'small_talk'
  | 'unclear'

export type TripPurposeHint =
  | 'leisure'
  | 'honeymoon'
  | 'family'
  | 'business'
  | 'adventure'
  | 'recovery'
  | 'cultural'
  | 'unknown'

export type BudgetStance = 'strict' | 'flexible' | 'value_seeking' | 'comfort_first' | 'unknown'

export type RiskTolerance = 'low' | 'medium' | 'high' | 'unknown'

export type PacePreference = 'relaxed' | 'balanced' | 'packed' | 'unknown'

/**
 * Uniform slice returned by every consultant reasoner.
 * Every recommendation path must populate these fields.
 */
export interface ReasoningSlice {
  /** 0–1 confidence in this analysis. */
  confidence: number
  /** Why this conclusion was reached (consultant notes). */
  reasoning: string[]
  /** Explicit trade-offs surfaced to the traveler. */
  tradeoffs: string[]
  /** Assumptions made when information was incomplete. */
  assumptions: string[]
  /** What is still needed to raise confidence. */
  missingInformation: string[]
  /** 0–100 recommendation / fit score for this slice. */
  recommendationScore: number
}

export interface ConsultantReasoningInput {
  locale?: ConsultantLocale
  userText: string
  /** Prior known slots (optional — never invent). */
  known?: {
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
  }
}

export interface TravelerIntentResult extends ReasoningSlice {
  intent: TravelerIntentKind
  purposeHint: TripPurposeHint
  urgency: 'low' | 'medium' | 'high'
}

export interface TravelerProfileResult extends ReasoningSlice {
  profile: {
    purpose: TripPurposeHint
    pace: PacePreference
    budgetStance: BudgetStance
    riskTolerance: RiskTolerance
    partySize: number | null
    interests: string[]
    styleNotes: string[]
  }
}

export interface ConstraintAnalyzerResult extends ReasoningSlice {
  constraints: {
    hard: string[]
    soft: string[]
    flexibleDimensions: string[]
  }
}

export interface DestinationReasonerResult extends ReasoningSlice {
  /** Why a destination direction is / isn't suitable (no live lookup). */
  destinationFit: {
    statedDestination: string | null
    openEnded: boolean
    suitabilityNotes: string[]
    whyNotNotes: string[]
    alternativesToConsider: string[]
  }
}

export interface BudgetReasonerResult extends ReasoningSlice {
  budget: {
    amount: number | null
    currency: string | null
    stance: BudgetStance
    valueOverCheapest: boolean
    stretchNotes: string[]
  }
}

export interface RiskReasonerResult extends ReasoningSlice {
  risks: {
    tolerance: RiskTolerance
    identified: string[]
    mitigations: string[]
  }
}

export interface ValueReasonerResult extends ReasoningSlice {
  value: {
    /** Expected traveler value drivers (not price-only). */
    drivers: string[]
    /** What “cheap” would sacrifice. */
    cheapnessCost: string[]
    expectedValueSummary: string
  }
}

export interface RecommendationReasonerResult extends ReasoningSlice {
  recommendation: {
    primaryAction: 'clarify' | 'recommend_direction' | 'compare_options' | 'proceed_planning' | 'defer'
    why: string[]
    whyNot: string[]
    alternative: string[]
    tradeoffs: string[]
    risk: string[]
    expectedValue: string[]
  }
}

export interface ExplanationResult extends ReasoningSlice {
  explanation: {
    locale: ConsultantLocale
    headline: string
    body: string[]
    nextStep: string | null
  }
}

export interface ConsultantReasoningPipelineResult {
  locale: ConsultantLocale
  intent: TravelerIntentResult
  profile: TravelerProfileResult
  constraints: ConstraintAnalyzerResult
  destination: DestinationReasonerResult
  budget: BudgetReasonerResult
  risk: RiskReasonerResult
  value: ValueReasonerResult
  recommendation: RecommendationReasonerResult
  explanation: ExplanationResult
  /** Pipeline-level rollup. */
  overall: ReasoningSlice
}

export function emptySlice(partial?: Partial<ReasoningSlice>): ReasoningSlice {
  return {
    confidence: partial?.confidence ?? 0,
    reasoning: partial?.reasoning ?? [],
    tradeoffs: partial?.tradeoffs ?? [],
    assumptions: partial?.assumptions ?? [],
    missingInformation: partial?.missingInformation ?? [],
    recommendationScore: partial?.recommendationScore ?? 0,
  }
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}
