export type {
  BookingIntelligenceResult,
  BookingIntelligenceSnapshot,
  BookingOffer,
  BookingProvider,
  BookingProviderDomain,
  BookingProviderRegistry,
  BookingReadinessResult,
  BookingSearchQuery,
  BookingTravelerPreferences,
  CostCombination,
  FusedOffer,
  MoneyAmount,
  RankedOffer,
  RecommendationConfidence,
  RecommendationExplanation,
} from './types'

export { BOOKING_INTELLIGENCE_FEATURE_ID, isBookingIntelligenceEnabled } from './feature'
export {
  bookingProviderDomains,
  createBookingProviderRegistry,
} from './providerRegistry'
export {
  createDefaultSimulatedBookingProviders,
  createSimulatedActivityProviders,
  createSimulatedCarRentalProviders,
  createSimulatedFlightProviders,
  createSimulatedHotelProviders,
  createSimulatedInsuranceProviders,
  createSimulatedTransferProviders,
  createSimulatedVisaProviders,
} from './simulatedAdapters'
export {
  convertMoney,
  nightsBetween,
  normalizeCurrencyCode,
  normalizeIsoDate,
  normalizeOfferCurrency,
  offerFingerprint,
} from './normalize'
export { fuseOffers } from './fusion'
export { rankOffersV2 } from './rankingV2'
export {
  emptyBookingPreferences,
  getBookingPreferences,
  learnBookingPreferences,
  recordBookingSelection,
  resetBookingPreferences,
  saveBookingPreferences,
} from './travelerPreferences'
export { optimizeBookingCombinations } from './costOptimizer'
export { assessBookingReadiness } from './bookingReadiness'
export { buildRecommendationConfidence } from './confidence'
export { explainRecommendations, explanationFacts } from './explanations'
export {
  getDefaultBookingProviderRegistry,
  resetDefaultBookingProviderRegistry,
  runBookingIntelligence,
} from './orchestrator'
export { enrichWithBookingIntelligence } from './enrich'
