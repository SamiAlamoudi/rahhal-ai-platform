/**
 * Sprint 93 — Unified Travel Intelligence (core barrel).
 */

export {
  SPRINT93_UNIFIED_TRIP_VERSION,
  type TripTravelers,
  type TripFlight,
  type TripHotel,
  type TripActivity,
  type TripTransfer,
  type TripInsurance,
  type TripVisa,
  type TripPricingSummary,
  type TripTimelineEvent,
  type TripSummary,
  type TripAlternativeKind,
  type TripAlternative,
  type TripConfidence,
  type TripWarning,
  type Trip,
  type TripComposeRequest,
  type TripComposeResult,
} from './types'

export {
  normalizeFlightProviderResult,
  normalizeHotelProviderResult,
  normalizeActivityProviderResult,
  normalizeTransferProviderResult,
  normalizeInsuranceProviderResult,
  normalizeVisaProviderResult,
  segmentsFromPackageComponents,
} from './TripNormalizer'

export { calculateTripCosts } from './TripCostCalculator'
export { buildTripTimeline } from './TripTimelineBuilder'
export { buildTripSummary, recommendationFromSources } from './TripSummaryBuilder'
export { combineTripConfidence } from './TripConfidence'
export { buildTripAlternatives } from './TripAlternativeBuilder'
export { validateTrip, type TripValidationResult } from './TripValidator'
export {
  serializeTrip,
  deserializeTrip,
  serializeTripSummaryCard,
} from './TripSerializer'
export {
  TripComposer,
  createTripComposer,
  composeUnifiedTrip,
} from './TripComposer'
export {
  placeholderHotel,
  placeholderTransfer,
  placeholderActivity,
  placeholderInsurance,
  placeholderVisa,
} from './placeholders'
