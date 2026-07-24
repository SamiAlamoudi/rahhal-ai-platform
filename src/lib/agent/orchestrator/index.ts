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

/* ── Phase 2 Stage 1: Consultant Pipeline (additive; default OFF) ── */

export type {
  ConsultantPipelineLocale,
  ConsultantStageId,
  ConsultantStageStatus,
  TravelerSnapshotView,
  PlanningSnapshotView,
  StageIOContext,
  StageResult,
  ConsultantPipelineInput,
  UnifiedConsultantResponse,
  ConsultantPipelineResult,
} from './pipelineTypes'

export {
  CONSULTANT_STAGE_ORDER,
  DEFAULT_MIN_CONFIDENCE,
  clamp01 as clampConsultant01,
  uniqueStrings as uniqueConsultantStrings,
} from './pipelineTypes'

export {
  CONSULTANT_PIPELINE_FEATURE_ID,
  INTEGRATION_REGISTRY,
  getIntegrationRef,
  listIntegratedFeatureIds,
} from './integrationRegistry'

export {
  isConsultantPipelineEnabled,
  EXECUTION_STAGE_ORDER,
  nextStage,
  ConsultantStages,
} from './consultantStages'

export {
  createInitialContext,
  enrichContextFromStage,
  enrichTravelerSnapshot,
  enrichPlanningSnapshot,
  hasStageOutput,
  ConsultantContext,
} from './consultantContext'

export {
  createPipelineState,
  appendStageResult,
  markRunning,
  markStoppedForClarification,
  markCompleted,
  shouldStopForConfidence,
  ConsultantState,
  type PipelineRunStatus,
  type ConsultantPipelineState,
} from './consultantState'

export {
  executeConsultantStage,
  ConsultantExecution,
} from './consultantExecution'

export {
  buildUnifiedConsultantResponse,
  ConsultantOutputs,
} from './consultantOutputs'

export {
  runConsultantPipeline,
  tryRunConsultantPipeline,
  ConsultantPipeline,
} from './consultantPipeline'

export {
  enrichTurnWithConsultantPipeline,
  finalizeConsultantTurnEnrichment,
  ConsultantActivation,
  ConsultantFinalize,
  type ConsultantPipelineActivationSnapshot,
  type ConsultantActivationTurnLike,
  type ConsultantActivationOptions,
  type ConsultantFinalizeOptions,
} from './consultantActivation'

export {
  recordConsultantPipelineTelemetry,
  getConsultantPipelineTelemetry,
  resetConsultantPipelineTelemetry,
  ConsultantTelemetry,
  type ConsultantPipelineTelemetryEvent,
  type ConsultantPipelineTelemetrySnapshot,
} from './consultantTelemetry'

export {
  CONSULTANT_RESPONSE_FEATURE_ID,
  isConsultantResponseEnabled,
  buildConsultantResponsePackage,
  tryBuildConsultantResponsePackage,
  enrichTurnWithConsultantResponse,
  ConsultantResponse,
} from './consultantResponse'

export {
  aggregateConsultantResponse,
  ConsultantResponseAggregator,
} from './consultantResponseAggregator'

export {
  buildConsultantResponseFormats,
  ConsultantResponseFormatsBuilder,
} from './consultantResponseFormats'

export {
  recordConsultantResponseTelemetry,
  getConsultantResponseTelemetry,
  resetConsultantResponseTelemetry,
  ConsultantResponseTelemetry,
  type ConsultantResponseTelemetryEvent,
  type ConsultantResponseTelemetrySnapshot,
} from './consultantResponseTelemetry'

export type {
  ConsultantResponseLocale,
  ConsultantResponseFormatKind,
  ConsultantResponseBody,
  ConsultantExecutiveFormat,
  ConsultantShortFormat,
  ConsultantDetailedFormat,
  ConsultantVoiceFormat,
  ConsultantResponseFormats,
  ConsultantResponsePackage,
  ConsultantEnrichTurnLike,
} from './consultantResponseTypes'

/* ── Phase 2 Stage 4: Runtime Coordinator ── */
export {
  RUNTIME_COORDINATOR_FEATURE_ID,
  isRuntimeCoordinatorEnabled,
  runRuntimeCoordinator,
  tryRunRuntimeCoordinator,
  enrichTurnWithRuntimeCoordinator,
  RuntimeCoordinator,
  RUNTIME_STAGE_ORDER,
  resolveRuntimeExecutionOrder,
  dependentsOf,
  RuntimeCache,
  getSharedRuntimeCache,
  resetSharedRuntimeCache,
  getRuntimeCoordinatorTelemetry,
  resetRuntimeCoordinatorTelemetry,
} from './runtime'
export type {
  RuntimeStageId,
  RuntimeCoordinatorInput,
  RuntimeCoordinatorResult,
  RuntimeTelemetrySnapshot,
} from './runtime'
