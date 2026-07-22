/**
 * Sprint 113 — AI Orchestrator barrel.
 */

export {
  SPRINT113_AI_ORCHESTRATOR_VERSION,
  type OrchestratorStageId,
  type OrchestratorStageStatus,
  type ProviderStatusKind,
  type OrchestratorMessage,
  type OrchestratorTripHints,
  type OrchestratorStageOverrides,
  type OrchestratorInput,
  type OrchestratorFinalResponse,
  type OrchestratorStageRecord,
  type ExecutionPlan,
  type ExecutionMetrics,
  type ExecutionContextSnapshot,
  type OrchestratorResult,
  type OrchestratorLogEntry,
  type OrchestratorStructuredLogger,
  createSilentOrchestratorLogger,
  emptyMetrics,
} from './types'

export {
  PIPELINE_ORCHESTRATOR_FEATURE_ID,
  isPipelineOrchestratorEnabled,
  isAgentPipelineOrchestratorEnabled,
} from './feature'

export {
  validateOrchestratorInput,
  OrchestratorValidator,
  createOrchestratorValidator,
  type OrchestratorValidation,
} from './OrchestratorValidator'

export {
  buildExecutionPlan,
  buildOrchestratorPlan,
  ExecutionPlanner,
  createExecutionPlanner,
} from './ExecutionPlanner'

export {
  ExecutionContext,
  createExecutionContext,
} from './ExecutionContext'

export {
  collectExecutionMetrics,
  ExecutionMetricsCollector,
  createExecutionMetricsCollector,
} from './ExecutionMetrics'

export {
  buildDisabledOrchestratorResult,
  buildOrchestratorResult,
  ExecutionResult,
  createExecutionResultHelpers,
} from './ExecutionResult'

export {
  createDefaultStageAdapters,
  runExecutionPipeline,
  ExecutionPipeline,
  createExecutionPipeline,
  type OrchestratorStageAdapters,
  type StageAdapterResult,
  type PipelineArtifacts,
  type PipelineRunResult,
} from './ExecutionPipeline'

export {
  AIOrchestrator,
  createAIOrchestrator,
  runAIOrchestrator,
  type AIOrchestratorOptions,
} from './AIOrchestrator'
