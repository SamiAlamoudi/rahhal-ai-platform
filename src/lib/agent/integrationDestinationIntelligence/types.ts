/**
 * Integration Sprint 5 — Destination Intelligence contracts.
 * Advisor layer: recommend / compare / culture / cost — not booking.
 */

export const INTEGRATION_DESTINATION_INTELLIGENCE_VERSION =
  '1.0.0-integration-destination-intelligence'

export type DestinationKind = 'city' | 'country' | 'region' | 'neighborhood'

export type DestinationTheme =
  | 'family'
  | 'business'
  | 'luxury'
  | 'beach'
  | 'adventure'
  | 'culture'
  | 'shopping'
  | 'nature'
  | 'food'
  | 'romance'
  | 'city'

export interface DestinationSeasonality {
  bestMonths: number[]
  avoidMonths: number[]
  noteEn: string
  noteAr: string
}

export interface DestinationCulture {
  language: string
  currency: string
  dressCodeEn: string
  dressCodeAr: string
  safetyEn: string
  safetyAr: string
  etiquetteEn: string
  etiquetteAr: string
  businessCustomsEn: string
  businessCustomsAr: string
  weekendDays: string
  publicHolidaysNoteEn: string
  publicHolidaysNoteAr: string
}

export interface DestinationCostEstimate {
  currency: string
  mealsPerDay: number
  transportPerDay: number
  activitiesPerDay: number
  dailyTotal: number
  tripTotal: number | null
  nights: number
  style: 'budget' | 'midrange' | 'luxury'
  explanationEn: string
  explanationAr: string
}

/** Normalized weather model — provider interface ready; mock by default. */
export interface NormalizedWeather {
  destinationId: string
  asOf: string
  source: 'mock' | 'live'
  summaryEn: string
  summaryAr: string
  tempHighC: number | null
  tempLowC: number | null
  condition: string
  rainProbability: number | null
  readinessEn: string
  readinessAr: string
}

export interface LocalTransportOption {
  mode: 'airport_transfer' | 'metro' | 'taxi' | 'rideshare' | 'walking'
  labelEn: string
  labelAr: string
  typicalCost: number | null
  currency: string
  notesEn: string
  notesAr: string
}

export interface DestinationKnowledge {
  id: string
  kind: DestinationKind
  nameEn: string
  nameAr: string
  country: string
  region: string
  neighborhoods: string[]
  themes: DestinationTheme[]
  seasonality: DestinationSeasonality
  culture: DestinationCulture
  prosEn: string[]
  prosAr: string[]
  consEn: string[]
  consAr: string[]
  hiddenTipsEn: string[]
  hiddenTipsAr: string[]
  touristTrapAvoidEn: string[]
  touristTrapAvoidAr: string[]
  dailyBudgetSar: { low: number; mid: number; high: number }
  flightHoursFromRiyadh: number
}

export interface DestinationMatchReason {
  code: string
  labelEn: string
  labelAr: string
  weight: number
}

export interface DestinationRecommendation {
  knowledge: DestinationKnowledge
  score: number
  reasons: DestinationMatchReason[]
  whyEn: string
  whyAr: string
  bestMonthsNoteEn: string
  bestMonthsNoteAr: string
  weather: NormalizedWeather
  transport: LocalTransportOption[]
  cost: DestinationCostEstimate
}

export interface DestinationComparison {
  left: DestinationRecommendation
  right: DestinationRecommendation
  differencesEn: string[]
  differencesAr: string[]
  verdictEn: string
  verdictAr: string
}

export interface DestinationIntelligenceResult {
  version: string
  enabled: boolean
  ok: boolean
  mode: 'recommend' | 'compare' | 'advise'
  queryThemes: DestinationTheme[]
  primary: DestinationRecommendation | null
  alternatives: DestinationRecommendation[]
  comparison: DestinationComparison | null
  consultantSummaryAr: string
  consultantSummaryEn: string
  latencyMs: number
  logs: string[]
}
