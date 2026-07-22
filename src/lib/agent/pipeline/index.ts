/**
 * Sprint 115 — Unified AI Execution Pipeline barrel.
 */

export {
  EXECUTION_PIPELINE_FEATURE_ID,
  isExecutionPipelineEnabled,
} from './feature'

export {
  SPRINT115_EXECUTION_PIPELINE_VERSION,
  PIPELINE_STAGE_ORDER,
  createSkippedStageResult,
  createFailedStageResult,
  createCompletedStageResult,
  type PipelineStageId,
  type PipelineStageStatus,
  type PipelineMessage,
  type PipelineTripHints,
  type PipelineStageOverrides,
  type PipelineInput,
  type PipelineStageResult,
  type PipelineStageHandler,
} from './PipelineStages'

export {
  PipelineContext,
  createPipelineContext,
  type PipelineFeatureFlagSnapshot,
} from './PipelineContext'

export {
  PipelineLogger,
  createPipelineLogger,
  createSilentPipelineLogger,
  type PipelineLogEntry,
  type PipelineStructuredLogger,
} from './PipelineLogger'

export {
  collectPipelineMetrics,
  emptyPipelineMetrics,
  PipelineMetricsCollector,
  createPipelineMetricsCollector,
  type PipelineMetrics,
} from './PipelineMetrics'

export {
  buildDisabledPipelineResult,
  buildPipelineResult,
  PipelineResultBuilder,
  createPipelineResultBuilder,
  type PipelineResult,
  type PipelineFinalResponse,
} from './PipelineResult'

export {
  validatePipelineInput,
  PipelineValidator,
  createPipelineValidator,
  type PipelineValidation,
} from './PipelineValidator'

export {
  explainPipeline,
  PipelineExplainer,
  createPipelineExplainer,
} from './PipelineExplainer'

export {
  createDefaultStageAdapters,
  runStageSequence,
  ExecutionPipeline,
  createExecutionPipeline,
  type PipelineStageAdapters,
  type ExecutionPipelineOptions,
} from './ExecutionPipeline'

export {
  PipelineRunner,
  createPipelineRunner,
  runUnifiedExecutionPipeline,
  runExecutionPipeline,
  type PipelineRunnerOptions,
} from './PipelineRunner'
