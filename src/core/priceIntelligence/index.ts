/**
 * Sprint 81 — AI Price Intelligence & Booking Timing (core barrel).
 */

export {
  SPRINT81_PRICE_INTELLIGENCE_VERSION,
  formatTimingExplanation,
  type BookingTimingAction,
  type OpportunityKind,
  type DemandLevel,
  type TripSeason,
  type PriceTrendDirection,
  type PriceObservation,
  type PriceIntelligenceInput,
  type PriceAnalysisSnapshot,
  type TimingRecommendation,
} from './TimingRecommendation'

export { analyzePriceTrend, computeVolatility, computeSlope, type PriceTrendResult } from './PriceTrend'
export { analyzePrices, isHolidayDate } from './PriceAnalyzer'
export {
  calculateTimingConfidence,
  confidenceFromAnalysis,
  type ConfidenceFactors,
} from './ConfidenceCalculator'
export { detectOpportunities } from './OpportunityDetector'
export {
  BookingTimingEngine,
  createBookingTimingEngine,
  runBookingTiming,
  type BookingTimingResult,
} from './BookingTimingEngine'
export {
  emitPriceEvent,
  onPriceEvent,
  resetPriceEventListeners,
  type PriceEvent,
  type PriceEventName,
} from './events'
