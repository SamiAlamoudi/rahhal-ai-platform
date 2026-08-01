/**
 * Sprint 85 — Tool Execution Engine public API.
 * Feature flag: `ai.brain.v1` (OFF by default). Mock execution only.
 */

export {
  TOOL_EXECUTION_ENGINE_VERSION,
  type ExecutableToolType,
  type ExecutionPolicyKind,
  type ToolDecision,
  type ToolExecutionStatus,
  type CancellationToken,
  type ExecutionTelemetry,
  type ExecutionTelemetryEvent,
  type UnifiedToolResult,
  type UnifiedResultItem,
  type MergedExecutionResults,
  type ExecutionContextSnapshot,
  type ToolExecutionRequest,
  type ToolExecutionResponse,
  type ToolExecutorOptions,
} from './types'

export { createCancellationToken } from './CancellationToken'
export { ExecutionContext, createExecutionContext } from './ExecutionContext'
export { ExecutionSimulator, createExecutionSimulator } from './ExecutionSimulator'
export { ExecutionSafety, createExecutionSafety, type SafetyBlock } from './ExecutionSafety'
export { DependencyResolver, createDependencyResolver } from './DependencyResolver'
export { ResultMerger, createResultMerger } from './ResultMerger'
export {
  ExecutionTelemetryCollector,
  createExecutionTelemetryCollector,
} from './ExecutionTelemetry'
export { ToolExecutor, createToolExecutor } from './ToolExecutor'
export {
  ToolExecutionEngine,
  createToolExecutionEngine,
  runToolExecution,
  buildDefaultTripDecisions,
  type ToolExecutionEngineDeps,
} from './ToolExecutionEngine'
