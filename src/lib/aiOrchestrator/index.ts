/**
 * Sprint 43 — Rahhal AI Orchestrator public surface.
 */

export type {
  OrchestratorToolId,
  PlannerStage,
  OrchestratorIntent,
  ToolParallelGroup,
  PlannerDecision,
  RankedRecommendation,
  ToolExecutionResult,
  OrchestratorObservability,
  OrchestratorMemorySnapshot,
  OrchestratorRunInput,
  OrchestratorRunResult,
} from './types'

export { AI_ORCHESTRATOR_FEATURE_ID, isAiOrchestratorEnabled } from './feature'

export {
  routeUserIntent,
  shouldUseOrchestratorForRoute,
  type IntentRouteResult,
} from './intentRouter'

export { buildPlannerDecision, flattenTools } from './planner'

export {
  createMemoryBridge,
  emptySnapshot,
  type MemoryBridgeHandle,
} from './memoryBridge'

export { executeToolWaves, assertParallelWave, type ToolRunner } from './parallelExecutor'

export { rankRecommendations } from './resultRanker'

export { buildOrchestratorResponse } from './responseBuilder'

export {
  createOrchestratorObservability,
  type OrchestratorLogSink,
} from './observability'

export {
  createToolAdapters,
  type ToolAdapterDeps,
  type ToolAdapterContext,
  type ToolAdaptersHandle,
} from './toolAdapters'

export {
  RahhalAiOrchestrator,
  createEmptyOrchestratorMemory,
  type RahhalAiOrchestratorOptions,
  type RahhalAiOrchestratorHandle,
} from './RahhalAiOrchestrator'
