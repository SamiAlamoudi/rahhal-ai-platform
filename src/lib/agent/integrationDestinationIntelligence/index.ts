/**
 * Integration Sprint 5 — Destination Intelligence barrel.
 * Feature-gated by `ai.integration_destination_intelligence` (default OFF).
 */

export { INTEGRATION_DESTINATION_INTELLIGENCE_VERSION } from './types'
export type {
  DestinationComparison,
  DestinationCostEstimate,
  DestinationCulture,
  DestinationIntelligenceResult,
  DestinationKind,
  DestinationKnowledge,
  DestinationMatchReason,
  DestinationRecommendation,
  DestinationSeasonality,
  DestinationTheme,
  LocalTransportOption,
  NormalizedWeather,
} from './types'

export {
  INTEGRATION_DESTINATION_INTELLIGENCE_FEATURE_ID,
  isIntegrationDestinationIntelligenceEnabled,
} from './feature'

export {
  DESTINATION_KNOWLEDGE,
  findKnowledgeByName,
  getDestinationKnowledge,
  listDestinationKnowledge,
  themesFromRequirements,
} from './knowledge'

export {
  MockWeatherProvider,
  createMockWeatherProvider,
  type WeatherProvider,
} from './weather'

export {
  MockLocalTransportProvider,
  createMockLocalTransportProvider,
  type LocalTransportProvider,
} from './transport'

export { estimateDestinationCost } from './cost'

export {
  buildRecommendation,
  recommendDestinations,
  scoreDestination,
} from './matching'

export {
  compareDestinations,
  detectComparisonQuery,
  isOpenEndedDestinationAsk,
} from './compare'

export { buildDestinationConsultantSummary } from './consultant'

export {
  runDestinationIntelligence,
  type DestinationIntelligenceDeps,
  type RunDestinationIntelligenceInput,
} from './engine'

export {
  enrichWithIntegrationDestinationIntelligence,
  shouldRunDestinationIntelligence,
  toDestinationIntelligenceMeta,
} from './enrich'
