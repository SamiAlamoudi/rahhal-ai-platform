/**
 * Evolution Sprint 7 — Destination Intelligence Layer contracts.
 *
 * Consultant-grade destination understanding (not mere search labels).
 * Additive only. Does not modify any existing AI core, planTurn,
 * Production Authority, or Smart Clarification.
 * CPU-only · offline · no external APIs.
 */

export type DestinationLocale = 'ar' | 'en'

export type CrowdLevel = 'low' | 'moderate' | 'high' | 'peak' | 'unknown'
export type SafetyBand = 'high' | 'moderate' | 'caution' | 'unknown'
export type CostBand = 'budget' | 'moderate' | 'premium' | 'luxury' | 'unknown'
export type VisaBand = 'easy' | 'moderate' | 'complex' | 'unknown'
export type SeasonQuality = 'best' | 'good' | 'mixed' | 'poor' | 'worst'

export interface MonthlyClimateNote {
  month: number // 1–12
  label: string
  crowd: CrowdLevel
  seasonQuality: SeasonQuality
}

export interface DestinationKnowledgeRecord {
  id: string
  nameEn: string
  nameAr: string
  aliases: string[]
  region: string
  bestSeasons: number[]
  worstSeasons: number[]
  weatherPatterns: string[]
  crowdByMonth: CrowdLevel[]
  typicalTravelerProfiles: string[]
  familySuitability: number
  luxuryScore: number
  adventureScore: number
  foodScore: number
  shoppingScore: number
  walkingScore: number
  transportationQuality: number
  safetyIndicators: string[]
  safetyBand: SafetyBand
  costExpectations: CostBand
  dailyBudgetSar: { low: number; mid: number; high: number }
  recommendedStayDays: { min: number; ideal: number; max: number }
  topStrengths: string[]
  knownWeaknesses: string[]
  climateByMonth: string[]
  nightlifeScore: number
  photographyScore: number
  natureScore: number
  cityScore: number
  accessibilityScore: number
  localEventsNotes: string[]
  visaComplexity: VisaBand
  visaNotes: string[]
  evidence: string[]
  missingKnowledge: string[]
  confidence: number
}

export interface DestinationProfileView {
  id: string
  name: string
  nameAr: string
  region: string
  record: DestinationKnowledgeRecord
}

export interface DestinationDna {
  primaryCharacter: string
  secondaryTraits: string[]
  climateGene: string
  costGene: CostBand
  paceGene: string
  signature: string[]
}

export interface TravelerMatchInput {
  purpose?: string | null
  pace?: string | null
  riskTolerance?: string | null
  budgetStance?: string | null
  interests?: string[]
  partyHint?: string | null
  luxuryLean?: number
  adventureLean?: number
  familyLean?: number
  foodLean?: number
  natureLean?: number
  cityLean?: number
  monthHint?: number | null
}

export interface DestinationSnapshot {
  id: string
  locale: DestinationLocale
  timestamp: string
  name: string
  destinationDna: DestinationDna
  strengths: string[]
  weaknesses: string[]
  bestTravelerMatch: string[]
  whoShouldAvoid: string[]
  confidence: number
  evidence: string[]
  missingKnowledge: string[]
  scores: {
    family: number
    luxury: number
    adventure: number
    food: number
    shopping: number
    walking: number
    transportation: number
    nightlife: number
    photography: number
    nature: number
    city: number
    accessibility: number
    budgetFit: number
    seasonFit: number
    overall: number
  }
  seasonal: {
    bestSeasons: number[]
    worstSeasons: number[]
    monthNotes: MonthlyClimateNote[]
  }
  summary: string
}

export interface DestinationComparisonResult {
  leftId: string
  rightId: string
  winnerId: string | null
  reasons: string[]
  leftStrengths: string[]
  rightStrengths: string[]
  tradeoffs: string[]
  travelerMatch?: {
    leftScore: number
    rightScore: number
    preferredId: string | null
  }
}

export interface DestinationEngineInput {
  locale?: DestinationLocale
  destinationQuery: string
  traveler?: TravelerMatchInput
  compareWith?: string
  monthHint?: number | null
  now?: Date
  enabled?: boolean
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

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}
