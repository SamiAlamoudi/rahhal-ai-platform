/**
 * Integration Sprint 9 — Budget & Pricing Intelligence contracts.
 * Financial value reasoning — distinct from Sprint 75 `ai.budget_intelligence`.
 */

export const INTEGRATION_BUDGET_PRICING_VERSION = '1.0.0-integration-budget-pricing'

export type BudgetTier = 'budget' | 'balanced' | 'premium' | 'luxury' | 'best_value'

export type BudgetPricingIntent =
  | 'set_budget'
  | 'stay_under'
  | 'find_cheaper'
  | 'luxury_worth_it'
  | 'optimize'
  | 'breakdown'
  | 'unknown'

export interface CurrencyAmount {
  amount: number
  currency: string
}

export interface BudgetEnvelope {
  total: CurrencyAmount
  perTraveler: CurrencyAmount
  perDay: CurrencyAmount
  emergencyReserve: CurrencyAmount
  /** Spendable after reserve. */
  usable: CurrencyAmount
  travelers: number
  nights: number
}

export interface CostBreakdown {
  currency: string
  flights: number
  hotels: number
  transportation: number
  meals: number
  activities: number
  insurance: number
  taxes: number
  estimatedTotal: number
  reserveHeld: number
  withinBudget: boolean
  overBy: number
  underBy: number
}

export interface BudgetTradeoff {
  code: string
  titleEn: string
  titleAr: string
  detailEn: string
  detailAr: string
  savingsAmount: number | null
  extraCostAmount: number | null
  timeSavedHours: number | null
  exceedsBudget: boolean
}

export interface OptimizedBudgetOption {
  tier: BudgetTier
  labelEn: string
  labelAr: string
  envelope: BudgetEnvelope
  breakdown: CostBreakdown
  score: number
  whyEn: string
  whyAr: string
}

export type FlexibleAlternativeKind =
  | 'different_airport'
  | 'different_dates'
  | 'different_hotel'
  | 'alternative_airline'
  | 'alternative_destination'

export interface FlexibleAlternative {
  kind: FlexibleAlternativeKind
  titleEn: string
  titleAr: string
  estimatedSavings: number
  currency: string
  detailEn: string
  detailAr: string
}

export interface CostMemorySnapshot {
  preferredBudget: number | null
  preferredCurrency: string | null
  luxuryPreference: boolean
  favoriteAirlines: string[]
  favoriteHotelClass: string | null
  lastTier: BudgetTier | null
}

export interface BudgetPricingResult {
  version: string
  enabled: boolean
  ok: boolean
  intent: BudgetPricingIntent
  envelope: BudgetEnvelope | null
  breakdown: CostBreakdown | null
  tradeoffs: BudgetTradeoff[]
  options: OptimizedBudgetOption[]
  primary: OptimizedBudgetOption | null
  flexible: FlexibleAlternative[]
  memory: CostMemorySnapshot
  consultantSummaryEn: string
  consultantSummaryAr: string
  latencyMs: number
  logs: string[]
}
