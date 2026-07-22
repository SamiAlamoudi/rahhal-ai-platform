/**
 * Sprint 106 — AI Response Composer barrel.
 */

export {
  SPRINT106_RESPONSE_COMPOSER_VERSION,
  type ResponseRecommendationKind,
  type ResponseInsightKind,
  type ResponseWarningKind,
  type ResponseComposerFlightFacts,
  type ResponseComposerTripContext,
  type ResponseComposerInput,
  type ResponseRecommendation,
  type ResponseAlternativeGroup,
  type ResponseInsight,
  type ResponseWarning,
  type ResponseConfidenceBreakdown,
  type ResponseSummarySection,
  type ResponseComposerResult,
  type ResponseComposerLogEntry,
} from './types'

export {
  RESPONSE_COMPOSER_FEATURE_ID,
  isResponseComposerEnabled,
} from './feature'

export {
  ResponseComposerMapper,
  createResponseComposerMapper,
  mapLooseOfferToFlightFacts,
  mapDecisionCandidateToFlightFacts,
  normalizeComposerFlights,
  isValidComposerFlight,
} from './ResponseComposerMapper'

export {
  RecommendationReasoner,
  createRecommendationReasoner,
  reasonAboutRecommendation,
  type ReasonerContext,
} from './RecommendationReasoner'

export {
  AlternativeGenerator,
  createAlternativeGenerator,
  generateAlternatives,
  type AlternativeGeneratorOptions,
} from './AlternativeGenerator'

export {
  ConfidenceExplainer,
  createConfidenceExplainer,
  explainConfidence,
} from './ConfidenceExplainer'

export {
  TravelInsights,
  createTravelInsights,
  buildTravelInsights,
  buildResponseWarnings,
} from './TravelInsights'

export {
  ResponseSummary,
  createResponseSummary,
  buildResponseSummary,
} from './ResponseSummary'

export {
  ResponseComposer,
  createResponseComposer,
  composeAiResponse,
  type ResponseComposerOptions,
} from './ResponseComposer'

export {
  ResponseComposerRunner,
  createResponseComposerRunner,
  runResponseComposer,
  type ResponseComposerRunnerOptions,
} from './ResponseComposerRunner'
