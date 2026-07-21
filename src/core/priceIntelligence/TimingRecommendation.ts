/**
 * Sprint 81 — booking timing recommendation domain models.
 */

export const SPRINT81_PRICE_INTELLIGENCE_VERSION = '1.0.0-price-intelligence'

export type BookingTimingAction =
  | 'BOOK_NOW'
  | 'WAIT'
  | 'WATCH_PRICE'
  | 'PRICE_TOO_HIGH'
  | 'LIMITED_AVAILABILITY'
  | 'NO_CONFIDENT_RECOMMENDATION'

export type OpportunityKind =
  | 'exceptional_bargain'
  | 'price_spike'
  | 'likely_increase'
  | 'likely_decrease'
  | 'high_uncertainty'

export type DemandLevel = 'low' | 'medium' | 'high'
export type TripSeason = 'peak' | 'shoulder' | 'off'
export type PriceTrendDirection = 'rising' | 'falling' | 'stable' | 'volatile'

export interface PriceObservation {
  price: number
  currency: string
  observedAt: string
  source?: string
}

export interface PriceIntelligenceInput {
  currentPrice: number
  currency: string
  cheapestPrice?: number | null
  premiumPrice?: number | null
  historicalObservations?: PriceObservation[]
  budgetCap?: number | null
  /** ISO date (YYYY-MM-DD) or full ISO datetime. */
  departureDate?: string | null
  /** Analysis “as of” date; defaults to now. */
  bookingDate?: string | null
  seatsRemaining?: number | null
  roomsRemaining?: number | null
  demandIndicator?: DemandLevel | null
  tripSeason?: TripSeason | null
  isWeekendTravel?: boolean | null
  isHolidayPeriod?: boolean | null
  destination?: string | null
}

export interface PriceAnalysisSnapshot {
  currentPrice: number
  averageObservedPrice: number | null
  cheapestOption: number | null
  premiumOption: number | null
  priceVsAverageRatio: number | null
  priceVsBudgetRatio: number | null
  volatility: number
  trend: PriceTrendDirection
  daysToDeparture: number | null
  bookingWindowDays: number | null
  demand: DemandLevel
  season: TripSeason
  isWeekendTravel: boolean
  isHolidayPeriod: boolean
  observationCount: number
}

export interface TimingRecommendation {
  action: BookingTimingAction
  reason: string
  confidence: number
  signalsUsed: string[]
  positiveIndicators: string[]
  negativeIndicators: string[]
  explanation: string
  opportunities: OpportunityKind[]
  analysis: PriceAnalysisSnapshot
}

export function formatTimingExplanation(rec: {
  action: BookingTimingAction
  reason: string
  confidence: number
  positiveIndicators: string[]
  negativeIndicators: string[]
}): string {
  const conf = Math.round(rec.confidence)
  const positives = rec.positiveIndicators.slice(0, 3)
  if (positives.length > 0 && (rec.action === 'BOOK_NOW' || rec.action === 'LIMITED_AVAILABILITY')) {
    return `${rec.reason} ${positives.join(', ')}, and confidence is ${conf}%.`.replace(/\s+/g, ' ').trim()
  }
  if (rec.action === 'WAIT' && positives.length > 0) {
    return `${rec.reason} ${positives.join(', ')}, and confidence is ${conf}%.`.replace(/\s+/g, ' ').trim()
  }
  if (rec.action === 'WATCH_PRICE') {
    return `${rec.reason} Monitor for movement — confidence ${conf}%.`
  }
  if (rec.action === 'PRICE_TOO_HIGH') {
    return `${rec.reason} Confidence ${conf}%.`
  }
  if (rec.action === 'NO_CONFIDENT_RECOMMENDATION') {
    return `${rec.reason} Confidence ${conf}% — not enough signal for a firm call.`
  }
  return `${rec.reason} Confidence ${conf}%.`
}
