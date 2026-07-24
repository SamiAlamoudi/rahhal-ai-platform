/**
 * Phase 2 Stage 3 — Unified Consultant Response types.
 * Aggregation contracts only. No intelligence algorithms.
 */

export type ConsultantResponseLocale = 'ar' | 'en'

export type ConsultantResponseFormatKind =
  | 'executive'
  | 'short'
  | 'detailed'
  | 'consultant'

/** Canonical body fields for the unified consultant response. */
export interface ConsultantResponseBody {
  executiveSummary: string[]
  travelerUnderstanding: string[]
  destinationUnderstanding: string[]
  recommendedStrategy: string[]
  primaryRecommendation: string[]
  alternativeRecommendation: string[]
  tradeoffs: string[]
  benefits: string[]
  risks: string[]
  opportunityCost: string[]
  confidenceScore: number
  evidenceSummary: string[]
  missingInformation: string[]
  clarificationQuestions: string[]
}

export interface ConsultantExecutiveFormat {
  kind: 'executive'
  locale: ConsultantResponseLocale
  headline: string
  oneLiner: string
  confidencePct: number
  nextStep: string | null
}

export interface ConsultantShortFormat {
  kind: 'short'
  locale: ConsultantResponseLocale
  title: string
  why: string
  whyNot: string
  confidencePct: number
  missing: string[]
}

export interface ConsultantDetailedFormat {
  kind: 'detailed'
  locale: ConsultantResponseLocale
  sections: Array<{ title: string; bullets: string[] }>
}

export interface ConsultantVoiceFormat {
  kind: 'consultant'
  locale: ConsultantResponseLocale
  voice: string[]
  justification: string[]
  assumptionsNoted: string[]
}

export interface ConsultantResponseFormats {
  executive: ConsultantExecutiveFormat
  short: ConsultantShortFormat
  detailed: ConsultantDetailedFormat
  consultant: ConsultantVoiceFormat
}

/** Full package attached to AgentProviderMeta.consultantResponse */
export interface ConsultantResponsePackage {
  enabled: true
  locale: ConsultantResponseLocale
  body: ConsultantResponseBody
  formats: ConsultantResponseFormats
  /** Stage ids that contributed (read-only attribution). */
  sources: string[]
  lowConfidence: boolean
  telemetry: {
    responseGenerationMs: number
    aggregationMs: number
    confidence: number
    questionCount: number
    success: boolean
  }
}

/** Minimal turn shape for read-only enrichment (shared by Stage 2/3). */
export interface ConsultantEnrichTurnLike {
  reply: string
  memory: {
    locale: ConsultantResponseLocale | string
    requirements: {
      destination?: string | null
      destinations?: string[]
      origin?: string | null
      budgetAmount?: number | null
      budgetCurrency?: string | null
      durationDays?: number | null
      travelers?: number | null
      interests?: string[]
      tripPurpose?: string | null
      travelerType?: string | null
    }
  }
  tripPlan: unknown
  meta: Record<string, unknown> & { kind?: string }
  toolBatch: unknown
}

export const DEFAULT_RESPONSE_MIN_CONFIDENCE = 0.35

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}
