/**
 * Evolution Sprint 6 — Recommendation Intelligence Layer contracts.
 *
 * Transforms plans into expert consultant recommendations.
 * Additive only. Does not modify Reasoning, Reflection, PlanningGraph,
 * Traveler Intelligence, Decision Engine, Planning Draft, Conversation Brain,
 * Smart Clarification, Production Authority, or planTurn.
 * CPU-only — no network / LLM. Never invents facts.
 */

export type RecommendationLocale = 'ar' | 'en'

export type RecommendationAction =
  | 'recommend'
  | 'compare'
  | 'collect_information'
  | 'challenge_assumption'
  | 'defer'

/**
 * Plan-shaped candidate input (duck-typed; may come from Planning Graph without coupling).
 * Only known fields are used — missing fields stay unknown, never invented.
 */
export interface RecommendationCandidate {
  id: string
  label: string
  locale?: RecommendationLocale
  intent?: string
  destinations?: string[]
  confidence?: number
  score?: number
  budget?: {
    amount?: number | null
    currency?: string | null
    stance?: string | null
  }
  dates?: {
    durationDays?: number | null
    monthHint?: number | null
    flexible?: boolean
    startDate?: string | null
    endDate?: string | null
  }
  constraints?: {
    hard?: string[]
    soft?: string[]
    flexibleDimensions?: string[]
  }
  travelerProfile?: {
    purpose?: string | null
    pace?: string | null
    budgetStance?: string | null
    riskTolerance?: string | null
    partySize?: number | null
    interests?: string[]
  }
  evidence?: string[]
  assumptions?: string[]
  risks?: string[]
  tradeoffs?: string[]
  missingData?: string[]
  whyExists?: string
  reasoningRef?: string | null
  reflectionRef?: string | null
  travelerModelRef?: string | null
}

export interface RecommendationEvidenceItem {
  id: string
  text: string
  weight: number
  source: string
  timestamp: string
  candidateId: string | null
  reasoningRef: string | null
  reflectionRef: string | null
}

export interface ImpactAssessment {
  budgetImpact: string[]
  comfortImpact: string[]
  timeImpact: string[]
  travelQualityImpact: string[]
}

export interface ScoredDimensions {
  valueScore: number
  riskScore: number
  benefitScore: number
  tradeoffScore: number
  opportunityCostScore: number
  compositeScore: number
}

/**
 * Full recommendation package — every required mission field.
 */
export interface RecommendationPackage {
  id: string
  locale: RecommendationLocale
  action: RecommendationAction
  timestamp: string
  primaryRecommendation: {
    candidateId: string | null
    label: string
    summary: string
  }
  whyThisOption: string[]
  whyNotAlternatives: string[]
  benefits: string[]
  risks: string[]
  tradeoffs: string[]
  opportunityCost: string[]
  budgetImpact: string[]
  comfortImpact: string[]
  timeImpact: string[]
  travelQualityImpact: string[]
  confidence: number
  evidence: RecommendationEvidenceItem[]
  missingInformation: string[]
  questionsToImproveConfidence: string[]
  assumptionsChallenged: string[]
  alternatives: Array<{
    candidateId: string
    label: string
    whyNotPrimary: string[]
    relativeScore: number
  }>
  scores: ScoredDimensions
  scoresByCandidate: Record<string, ScoredDimensions>
  reasoningRef: string | null
  reflectionRef: string | null
  travelerModelRef: string | null
  revisionOf: string | null
  revisionReason: string | null
}

export interface ExecutiveRecommendation {
  locale: RecommendationLocale
  headline: string
  oneLiner: string
  confidencePct: number
  action: RecommendationAction
  topRisk: string | null
  nextStep: string | null
}

export interface ShortRecommendation {
  locale: RecommendationLocale
  title: string
  why: string
  whyNot: string
  confidencePct: number
  missing: string[]
}

export interface DetailedRecommendation {
  locale: RecommendationLocale
  package: RecommendationPackage
  sections: Array<{ title: string; bullets: string[] }>
}

export interface ConsultantExplanation {
  locale: RecommendationLocale
  voice: string[]
  justification: string[]
  confidenceExplanation: string[]
  challenge: string[]
}

export interface RecommendationFormats {
  executive: ExecutiveRecommendation
  short: ShortRecommendation
  detailed: DetailedRecommendation
  consultant: ConsultantExplanation
}

export interface RecommendationEngineResult {
  package: RecommendationPackage
  formats: RecommendationFormats
  compared: Array<{
    leftId: string
    rightId: string
    winnerId: string | null
    reasons: string[]
  }>
}

export interface RecommendationEngineInput {
  locale?: RecommendationLocale
  candidates: RecommendationCandidate[]
  /** Soft traveler bias hints (never invent hard facts). */
  travelerHints?: {
    preferValueOverCheapest?: boolean
    preferComfort?: boolean
    preferLowFriction?: boolean
    favorDestinations?: string[]
    avoidThemes?: string[]
  }
  reasoningRef?: string | null
  reflectionRef?: string | null
  travelerModelRef?: string | null
  previous?: RecommendationPackage | null
  revisionReason?: string | null
  now?: Date
  enabled?: boolean
}

export function isoNow(now?: Date): string {
  return (now ?? new Date()).toISOString()
}

export function newId(prefix: string, now?: Date): string {
  const t = (now ?? new Date()).getTime().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${t}_${r}`
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}
