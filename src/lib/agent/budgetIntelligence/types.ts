/**
 * Sprint 75 — Budget Intelligence contracts (additive).
 */

export type BudgetIntent =
  | 'under_cap'
  | 'range'
  | 'cheapest'
  | 'best_value'
  | 'luxury'
  | 'premium'
  | 'economy'
  | 'business_if_fits'
  | 'unknown'

export type BudgetCategory =
  | 'flights'
  | 'hotels'
  | 'transportation'
  | 'activities'

export interface BudgetAllocation {
  flights: number
  hotels: number
  transportation: number
  /** Future placeholder — reserved share, not spent by engines yet. */
  activities: number
  currency: string
  total: number
}

export interface BudgetScoreBreakdown {
  priceFit: number
  value: number
  tripQuality: number
  savings: number
  travelTime: number
  /** Weighted 0–100 overall. */
  budgetScore: number
}

export interface BudgetDiagnostics {
  budgetDetected: boolean
  currency: string | null
  amount: number | null
  minAmount: number | null
  maxAmount: number | null
  intent: BudgetIntent
  style: 'luxury' | 'midrange' | 'budget' | null
  flexible: boolean
  allocatedBudget: BudgetAllocation | null
  remainingBudget: number | null
  budgetScore: number | null
  overflow: boolean
  underflow: boolean
  missingBudget: boolean
}

export interface RankedBudgetCandidate {
  id: string
  kind: 'flight' | 'hotel' | 'package'
  title: string
  price: number
  currency: string
  score: BudgetScoreBreakdown
  reasons: string[]
  payload: Record<string, unknown>
}

export interface BudgetIntelligenceResult {
  version: string
  diagnostics: BudgetDiagnostics
  allocation: BudgetAllocation | null
  rankedFlights: RankedBudgetCandidate[]
  rankedHotels: RankedBudgetCandidate[]
  rankedPackages: RankedBudgetCandidate[]
  recommendationFacts: string[]
  durationMs: number
}

export const SPRINT75_BUDGET_INTELLIGENCE_VERSION = '1.0.0-budget'
