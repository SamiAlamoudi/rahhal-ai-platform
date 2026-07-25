/**
 * Integration Sprint 4 — AI Trip Orchestrator barrel.
 * Feature-gated by `ai.integration_trip_orchestrator` (default OFF).
 */

export { INTEGRATION_TRIP_ORCHESTRATOR_VERSION } from './types'
export type {
  OrchestratorBudgetSplit,
  OrchestratorConflict,
  OrchestratorConflictCode,
  OrchestratorExecutionPlan,
  OrchestratorItinerary,
  OrchestratorItineraryDay,
  OrchestratorRecommendation,
  OrchestratorStep,
  OrchestratorStepId,
  OrchestratorStepStatus,
  TripOrchestratorResult,
} from './types'

export {
  INTEGRATION_TRIP_ORCHESTRATOR_FEATURE_ID,
  isIntegrationTripOrchestratorEnabled,
} from './feature'

export { buildOrchestratorBudget } from './budget'
export { detectOrchestratorConflicts, missingOrchestratorFields } from './conflicts'
export { buildOrchestratorItinerary } from './itinerary'
export {
  detectTripScenario,
  seedOrchestratorRequirements,
  learnOrchestratorPreferences,
} from './memory'
export { buildTripConsultantSummary } from './consultantSummary'
export { runTripOrchestrator, type TripOrchestratorDeps } from './orchestrator'
export { enrichWithIntegrationTripOrchestrator } from './enrich'
