/**
 * Phase 2 Stage 4 — Runtime Coordinator barrel.
 */

export type {
  RuntimeLocale,
  RuntimeStageId,
  RuntimeStageStatus,
  RuntimeKnownSlots,
  RuntimeCoordinatorInput,
  RuntimeStageRecord,
  RuntimeCoordinatorResult,
  RuntimeTelemetrySnapshot,
} from './runtimeTypes'

export {
  RUNTIME_STAGE_ORDER,
  DEFAULT_STAGE_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
} from './runtimeTypes'

export {
  RUNTIME_COORDINATOR_FEATURE_ID,
  isRuntimeCoordinatorEnabled,
} from './runtimeFeature'

export {
  RUNTIME_DEPENDENCIES,
  resolveRuntimeExecutionOrder,
  dependentsOf,
  RuntimeDependencies,
} from './runtimeDependencies'

export {
  RuntimeCache,
  getSharedRuntimeCache,
  resetSharedRuntimeCache,
} from './runtimeCache'

export {
  createRuntimeSharedContext,
  attachStageOutput,
  RuntimeContext,
} from './runtimeContext'

export {
  recordRuntimeCoordinatorTelemetry,
  getRuntimeCoordinatorTelemetry,
  resetRuntimeCoordinatorTelemetry,
  RuntimeTelemetry,
} from './runtimeTelemetry'

export {
  runRuntimeCoordinator,
  tryRunRuntimeCoordinator,
  enrichTurnWithRuntimeCoordinator,
  RuntimeCoordinator,
} from './runtimeCoordinator'
