/**
 * Evolution Sprint 8 — Travel Strategy Intelligence contracts.
 *
 * Optimizes HOW to travel (timing, budget, comfort, route) — does NOT choose destinations.
 * Additive only. Does not modify frozen AI cores or planTurn.
 * CPU-only · offline · no network.
 */

export type StrategyLocale = 'ar' | 'en'

export type StrategyKind =
  | 'primary'
  | 'alternative'
  | 'budget'
  | 'comfort'
  | 'luxury'
  | 'fastest'
  | 'highest_value'
  | 'lowest_risk'
  | 'best_time'

export interface StrategyScores {
  budget: number
  comfort: number
  time: number
  convenience: number
  experience: number
  weather: number
  crowds: number
  transportation: number
  flexibility: number
  overallValue: number
  confidence: number
}

export interface StrategyEvidenceItem {
  id: string
  text: string
  weight: number
  source: string
  timestamp: string
}

/**
 * Duck-typed context — may be filled from Destination / Recommendation / Traveler
 * layers by callers without this module importing those packages.
 */
export interface TravelStrategyContext {
  locale?: StrategyLocale
  /** Opaque destination label already chosen upstream — not selected here. */
  destinationLabel?: string | null
  monthHint?: number | null
  budgetAmount?: number | null
  budgetCurrency?: string | null
  budgetStance?: string | null
  durationDays?: number | null
  purpose?: string | null
  pace?: string | null
  riskTolerance?: string | null
  partySize?: number | null
  /** Qualitative destination priors supplied by caller (optional). */
  destinationPriors?: {
    bestSeasons?: number[]
    worstSeasons?: number[]
    costBand?: string | null
    safetyBand?: string | null
    familySuitability?: number | null
    luxuryScore?: number | null
    adventureScore?: number | null
    transportationQuality?: number | null
    walkingScore?: number | null
    crowdByMonth?: string[]
    climateByMonth?: string[]
    visaComplexity?: string | null
    recommendedStayDays?: { min: number; ideal: number; max: number } | null
    strengths?: string[]
    weaknesses?: string[]
  }
  /** Soft traveler biases (optional). */
  travelerHints?: {
    preferComfort?: boolean
    preferValueOverCheapest?: boolean
    preferLowFriction?: boolean
    luxuryLean?: number
    familyLean?: number
  }
  /** Known constraints — never invent missing ones. */
  knownConstraints?: string[]
  missingInformation?: string[]
  evidence?: string[]
  assumptions?: string[]
  now?: Date
  enabled?: boolean
}

export interface TravelStrategyOption {
  id: string
  kind: StrategyKind
  title: string
  summary: string
  why: string[]
  whyNot: string[]
  tradeoffs: string[]
  risks: string[]
  opportunityCost: string[]
  expectedValue: string[]
  confidence: number
  evidence: StrategyEvidenceItem[]
  missingInformation: string[]
  suggestedClarification: string[]
  scores: StrategyScores
  /** Strategy levers — not destination picks. */
  levers: {
    goNowOrLater: 'now' | 'later' | 'either' | 'unknown'
    budgetAction: 'keep' | 'increase' | 'decrease' | 'reallocate' | 'unknown'
    splitItinerary: boolean | null
    adjustFlights: boolean | null
    prioritizeComfort: boolean | null
    stayDurationDays: number | null
    timingNote: string | null
  }
}

export interface TravelStrategyResult {
  locale: StrategyLocale
  timestamp: string
  /** Destination is context only — never chosen by this layer. */
  destinationContext: string | null
  primary: TravelStrategyOption
  alternatives: TravelStrategyOption[]
  byKind: Partial<Record<StrategyKind, TravelStrategyOption>>
  overallConfidence: number
  missingInformation: string[]
  suggestedClarification: string[]
  action: 'recommend_strategy' | 'compare_strategies' | 'collect_information'
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function isoNow(now?: Date): string {
  return (now ?? new Date()).toISOString()
}

export function newId(prefix: string, now?: Date): string {
  const t = (now ?? new Date()).getTime().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${t}_${r}`
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

export function emptyScores(partial?: Partial<StrategyScores>): StrategyScores {
  return {
    budget: partial?.budget ?? 50,
    comfort: partial?.comfort ?? 50,
    time: partial?.time ?? 50,
    convenience: partial?.convenience ?? 50,
    experience: partial?.experience ?? 50,
    weather: partial?.weather ?? 50,
    crowds: partial?.crowds ?? 50,
    transportation: partial?.transportation ?? 50,
    flexibility: partial?.flexibility ?? 50,
    overallValue: partial?.overallValue ?? 50,
    confidence: partial?.confidence ?? 0.5,
  }
}
