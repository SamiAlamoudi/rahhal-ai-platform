/**
 * Sprint 120 — Production UI ↔ AI platform integration barrel.
 */

export {
  UI_PRODUCTION_INTEGRATION_FEATURE_ID,
  SPRINT120_PRODUCTION_INTEGRATION_VERSION,
  isUiProductionIntegrationEnabled,
} from './feature'

export {
  loadProductionHomeData,
  type ProductionHomeData,
} from './homeData'

export {
  extractTripHintsFromText,
  buildPipelineInputFromMessage,
} from './tripHints'

export {
  runProductionConversationTurn,
  type ProductionTurnViewModel,
} from './conversationTurn'

export {
  buildEditSnapshotFromPipeline,
  runProductionEditTurn,
} from './editTurn'

export {
  mapFlightsFromPipeline,
  mapHotelsFromPipeline,
  mapPackagesFromPipeline,
  mapRecommendationsFromPipeline,
  mapWarningsFromPipeline,
  mapConfidenceFromPipeline,
  mapItineraryDays,
  mapItineraryEngineDays,
  mapStreamingProgress,
  mapEditComparison,
  type FlightCardModel,
  type HotelCardModel,
  type PackageCardModel,
  type RecommendationCardModel,
  type WarningCardModel,
  type ConfidenceCardModel,
  type SavingsCardModel,
  type TimelineDayModel,
  type PipelineProgressModel,
} from './mappers'
