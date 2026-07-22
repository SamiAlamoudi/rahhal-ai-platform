/**
 * Sprint 99 — Unified Traveler Experience DTO (presentation assembly).
 * Consumes existing engine / concierge outputs only — no new intelligence.
 */

export const SPRINT99_ALPHA_ASSEMBLY_VERSION = '1.0.0-alpha-assembly'

export type ExperienceSectionId =
  | 'timeline'
  | 'concierge'
  | 'package'
  | 'flight'
  | 'hotel'
  | 'price'
  | 'confidence'
  | 'alternatives'
  | 'explanation'
  | 'summary'
  | 'next_action'

export type ExperiencePriorityLevel = 'critical' | 'high' | 'medium' | 'low'

export interface TravelerTimelineStage {
  id: string
  label: string
  status: 'pending' | 'running' | 'completed' | 'skipped'
  message: string
  progressPercent: number
}

export interface TravelerTimelineSection {
  id: 'timeline'
  priority: ExperiencePriorityLevel
  currentStageId: string | null
  stages: TravelerTimelineStage[]
  progressPercent: number
}

export interface TravelerConciergeSection {
  id: 'concierge'
  priority: ExperiencePriorityLevel
  explanation: string | null
  recommendedOption: string | null
  suggestionCount: number
}

export interface TravelerPackageSection {
  id: 'package'
  priority: ExperiencePriorityLevel
  packageId: string
  title: string
  totalPrice: number | null
  currency: string
  confidence: number | null
  explanation: string | null
}

export interface TravelerFlightSection {
  id: 'flight'
  priority: ExperiencePriorityLevel
  flightId: string
  airline: string | null
  origin: string | null
  destination: string | null
  price: number | null
  currency: string
  durationMinutes: number | null
  stops: number | null
}

export interface TravelerHotelSection {
  id: 'hotel'
  priority: ExperiencePriorityLevel
  hotelId: string
  name: string | null
  price: number | null
  currency: string
  stars: number | null
  rating: number | null
}

export interface TravelerPriceSection {
  id: 'price'
  priority: ExperiencePriorityLevel
  note: string
  confidence: number | null
  currency: string | null
}

export interface TravelerConfidenceSection {
  id: 'confidence'
  priority: ExperiencePriorityLevel
  score: number
  level: 'high' | 'medium' | 'low'
  label: string
  uncertaintyExplanation: string | null
}

export interface TravelerAlternativeItem {
  kind: string
  label: string
  estimatedCost: number | null
  currency: string
  explanation: string
}

export interface TravelerAlternativesSection {
  id: 'alternatives'
  priority: ExperiencePriorityLevel
  items: TravelerAlternativeItem[]
}

export interface TravelerExplanationSection {
  id: 'explanation'
  priority: ExperiencePriorityLevel
  whyDestination: string | null
  whyFlights: string | null
  whyHotel: string | null
  whyPackage: string | null
  whyTiming: string | null
  summary: string
}

export interface TravelerSummarySection {
  id: 'summary'
  priority: ExperiencePriorityLevel
  text: string
  recommendedOptionLabel: string | null
  keyReasons: string[]
}

export interface TravelerNextActionSection {
  id: 'next_action'
  priority: ExperiencePriorityLevel
  action: string
}

export type TravelerExperienceSection =
  | TravelerTimelineSection
  | TravelerConciergeSection
  | TravelerPackageSection
  | TravelerFlightSection
  | TravelerHotelSection
  | TravelerPriceSection
  | TravelerConfidenceSection
  | TravelerAlternativesSection
  | TravelerExplanationSection
  | TravelerSummarySection
  | TravelerNextActionSection

/** Unified traveler-facing experience — sections omitted when data unavailable. */
export interface AlphaExperienceDTO {
  version: string
  conversationId: string
  enabled: boolean
  sections: TravelerExperienceSection[]
  sectionIds: ExperienceSectionId[]
  finalRecommendation: string | null
  confidenceLevel: string | null
  confidenceScore: number | null
  nextAction: string | null
  durationMs: number
}

/** Raw inputs assembled from existing conversation / concierge / engine snapshots. */
export interface AlphaExperienceComposeInput {
  conversationId?: string
  destination?: string | null
  origin?: string | null
  currency?: string | null
  /** Concierge recommendation DTO (Sprint 96/97) — optional. */
  concierge?: {
    enabled?: boolean
    explanation?: string | null
    summaryText?: string | null
    recommendedOption?: string | null
    nextStep?: string | null
    confidence?: {
      score: number
      level: 'high' | 'medium' | 'low'
      label: string
      uncertaintyExplanation?: string | null
    } | null
    timeline?: {
      stages: Array<{
        id: string
        label: string
        status: string
        message: string
        progressPercent: number
      }>
      currentStageId?: string | null
      progressPercent?: number
    } | null
    alternatives?: Array<{
      kind: string
      label: string
      estimatedCost?: number | null
      currency?: string
      explanation: string
    }>
    suggestions?: Array<{ title?: string; message?: string }>
    whyDestination?: string | null
    whyFlights?: string | null
    whyHotel?: string | null
    whyPackage?: string | null
    whyTiming?: string | null
  } | null
  packageSelected?: {
    id: string
    title?: string | null
    totalPrice?: number | null
    currency?: string | null
    confidence?: number | null
    explanation?: string | null
  } | null
  flight?: {
    id: string
    airline?: string | null
    origin?: string | null
    destination?: string | null
    price?: number | null
    currency?: string | null
    durationMinutes?: number | null
    stops?: number | null
  } | null
  hotel?: {
    id: string
    name?: string | null
    price?: number | null
    currency?: string | null
    stars?: number | null
    rating?: number | null
  } | null
  priceOpportunity?: {
    note: string
    confidence?: number | null
    currency?: string | null
  } | null
  decisionExplanation?: string | null
  engineConfidence?: number | null
}
