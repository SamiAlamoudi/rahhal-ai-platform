/**
 * Sprint 110 — AI Trip Builder barrel.
 */

export {
  SPRINT110_TRIP_BUILDER_VERSION,
  type TripRankKind,
  type TripBuilderPreferences,
  type TripBuilderProviderSignal,
  type TripBuilderInput,
  type TripCostBreakdown,
  type TripCandidate,
  type TripRankedGroup,
  type TripBuilderError,
  type TripPackageForComposer,
  type TripBuilderResult,
  type TripBuilderLogEntry,
  type TripBuilderStructuredLogger,
  createSilentTripBuilderLogger,
} from './types'

export {
  TRIP_BUILDER_FEATURE_ID,
  isTripBuilderEnabled,
} from './feature'

export {
  validateTripBuilderInput,
  TripBuilderValidator,
  createTripBuilderValidator,
  type TripBuilderValidation,
} from './TripBuilderValidator'

export {
  assessTripCompatibility,
  TripCompatibility,
  createTripCompatibility,
  type TripCompatibilityInput,
  type TripCompatibilityResult,
} from './TripCompatibility'

export {
  calculateTripCost,
  TripCostCalculator,
  createTripCostCalculator,
  type TripCostInput,
} from './TripCostCalculator'

export {
  rankTrips,
  TripRanking,
  createTripRanking,
} from './TripRanking'

export {
  explainTrip,
  explainTripCandidate,
  TripExplainer,
  createTripExplainer,
  type TripExplainInput,
} from './TripExplainer'

export {
  estimateTravelQuality,
  estimateTripConfidence,
  computeTripScore,
  prioritizeOffersForDecisionEngine,
  flightToComposerFacts,
  toTripPackageForComposer,
  buildResponseComposerPackages,
  toResponseComposerInput,
  buildTripMetadata,
  TripMetadata,
  createTripMetadata,
  type TripBuilderResultMeta,
} from './TripMetadata'

export {
  composeTripCandidates,
  TripBuilderComposer,
  createTripBuilderComposer,
  type TripComposeContext,
} from './TripBuilderComposer'

export {
  TripBuilder,
  createTripBuilder,
  buildTrips,
  type TripBuilderOptions,
} from './TripBuilder'

export {
  TripBuilderRunner,
  createTripBuilderRunner,
  runTripBuilder,
  type TripBuilderRunnerOptions,
} from './TripBuilderRunner'
