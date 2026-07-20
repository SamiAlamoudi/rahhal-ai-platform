/**
 * Sprint 45 — Autonomous Travel Reasoning types.
 * Deterministic destination discovery + feasibility reasoning (no LLM).
 */

import type { AgentLocale, TripRequirements } from '../types'

export type ClimateBand = 'cool' | 'cold' | 'mild' | 'warm' | 'hot' | 'dry' | 'rainy' | 'flexible'

export type VisaEase = 'visa_free' | 'visa_on_arrival' | 'evisa' | 'embassy' | 'unknown'

export interface VisaGuidance {
  ease: VisaEase
  summary: string
  processingDays: string | null
  documents: string[]
  feeNote: string | null
}

export interface DestinationClimateProfile {
  /** Destination display name (EN canonical). */
  id: string
  nameAr: string
  nameEn: string
  region: string
  /** Typical climate by calendar month (1–12). */
  climateByMonth: ClimateBand[]
  /** Rough all-in trip cost per adult per day in SAR (flights+hotel+local). */
  dailyBudgetSar: { low: number; mid: number; high: number }
  visaFromSaudi: VisaEase
  bestFor: string[]
  risks: string[]
  /** Distance proxy from Riyadh (hours flight). */
  flightHoursFromRiyadh: number
}

export interface DestinationCandidate {
  id: string
  name: string
  nameAr: string
  score: number
  confidence: number
  whySelected: string[]
  whyRejected?: string[]
  pros: string[]
  cons: string[]
  estimatedTripCostSar: number | null
  budgetFit: 'under' | 'fit' | 'tight' | 'over' | 'unknown'
  climateMatch: ClimateBand | null
  visa: VisaEase
  /** Sprint 49 — consultant visa briefing */
  visaGuidance: VisaGuidance | null
  /** Sprint 49 — safety / logistics advisories */
  advisoryNotes: string[]
  bestTimingNote: string | null
  riskNotes: string[]
}

export interface TravelReasoningResult {
  mode: 'open_ended' | 'named' | 'refine'
  locale: AgentLocale
  primary: DestinationCandidate | null
  alternatives: DestinationCandidate[]
  rejected: DestinationCandidate[]
  overallConfidence: number
  summary: string
  followUpFields: Array<keyof TripRequirements>
  inferredMonth: number | null
  inferredClimate: ClimateBand | null
  /** Snapshot for agent meta / replay. */
  rationale: string[]
}

export interface TravelReasoningInput {
  locale: AgentLocale
  requirements: TripRequirements
  userText?: string
  /** Max candidates to return as primary+alternatives. */
  maxResults?: number
  now?: Date
}

export interface TravelReasoningSnapshot {
  mode: TravelReasoningResult['mode']
  overallConfidence: number
  primaryId: string | null
  candidateIds: string[]
  summary: string
  rationale: string[]
  followUpFields: string[]
  inferredMonth: number | null
  inferredClimate: string | null
}
