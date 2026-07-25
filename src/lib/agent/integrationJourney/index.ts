/**
 * Integration Sprint 12 — End-to-End Journey Integration barrel.
 * Feature-gated by `ai.integration_journey` (default OFF). Coordinator only.
 */

export {
  INTEGRATION_JOURNEY_VERSION,
  JOURNEY_STAGE_ORDER,
} from './types'
export type {
  JourneyConversationTrace,
  JourneyDecisionTrace,
  JourneyExecutionTrace,
  JourneyHandoffContext,
  JourneyMemorySnapshot,
  JourneyObservability,
  JourneyResult,
  JourneyScenario,
  JourneySharedDecision,
  JourneyStageId,
  JourneyStageStatus,
  JourneyStageTrace,
} from './types'

export {
  INTEGRATION_JOURNEY_FEATURE_ID,
  isIntegrationJourneyEnabled,
} from './feature'

export {
  buildHandoffContext,
  collectKnownSlots,
  inferJourneyStage,
  toJourneyScenario,
} from './handoff'

export {
  readJourneyMemory,
  writeJourneyMemory,
  resetJourneyMemoryForTests,
} from './memory'

export { scoreSharedJourneyDecision } from './scoring'
export {
  STAGE_BINDINGS,
  buildStageTraces,
  softActivateStage,
} from './stages'
export { buildJourneySummary } from './consultant'

export {
  JourneyEngine,
  createJourneyEngine,
  runIntegrationJourney,
  type JourneyDeps,
  type RunIntegrationJourneyInput,
} from './engine'

export {
  enrichWithIntegrationJourney,
  shouldRunIntegrationJourney,
  toJourneyMeta,
} from './enrich'
