/**
 * Sprint 27 — AI Trip Orchestrator public surface.
 */

export type {
  OrchestratorDomain,
  OrchestratorStage,
  OrchestratorLogLevel,
  OrchestratorLogEntry,
  OrchestratorDomainStep,
  OrchestratorExecutionPlan,
  OrchestratorMetrics,
  OrchestratorAggregatedResponse,
  AITripOrchestratorTurnResult,
  AITripOrchestratorOptions,
  AITripOrchestratorRunInput,
} from './types'

export {
  AITripOrchestrator,
  getOrCreateAITripOrchestrator,
  resetAITripOrchestrator,
  clearOrchestratorCache,
  resetOrchestratorMetrics,
} from './aiTripOrchestrator'
export type { AITripOrchestratorHandle } from './aiTripOrchestrator'

export {
  extractTravelIntentFromConversation,
  domainsForIntent,
} from './intent'

export {
  buildOrchestratorExecutionPlan,
  resolveOrchestratorDomains,
} from './executionPlanBuilder'

export { createOrchestratorLogger } from './logging'
export {
  createOrchestratorMetricsCollector,
  getRecentOrchestratorMetrics,
  recordOrchestratorMetrics,
} from './metrics'

export {
  buildOrchestratorCacheKey,
  getOrchestratorCached,
  setOrchestratorCached,
  orchestratorCacheSize,
} from './cache'

export { isBrainTripOrchestratorEnabled } from './feature'
export { isBrainContextMemoryEnabled } from '../memory/feature'
