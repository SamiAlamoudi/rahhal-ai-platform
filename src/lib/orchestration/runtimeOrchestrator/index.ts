/**
 * Phase 6 Stage 9 — AI Runtime Orchestrator barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.runtime_orchestrator` (default OFF).
 * No production runtime, APIs, SDKs, HTTP, AI calls, or tool execution.
 */

import { RUNTIME_ORCHESTRATOR_ISOLATION as RO_ISOLATION } from './types'
import {
  RUNTIME_ENGINE_REFS,
  RUNTIME_LIFECYCLE_ACTIONS,
  RUNTIME_PIPELINE_STAGES,
} from './types'

export {
  BRAIN_RUNTIME_ORCHESTRATOR_FEATURE_ID,
  isBrainRuntimeOrchestratorEnabled,
  listExecutionRegistry,
  listRuntimeEngineRefs,
  ExecutionRegistry,
  EXECUTION_REGISTRY,
} from './registry'

export type {
  RuntimeLocale,
  RuntimeLifecycleAction,
  RuntimeStateId,
  RuntimeEventKind,
  RuntimeEngineRefId,
  RuntimePipelineStageId,
  RuntimeOrchestratorContract,
  ExecutionPipelineContract,
  ExecutionContextContract,
  ExecutionLifecycleContract,
  ExecutionSessionContract,
  ExecutionCoordinatorContract,
  ExecutionSchedulerContract,
  ExecutionQueueContract,
  ExecutionRegistryEntry,
  ExecutionContract,
  ExecutionMiddlewareContract,
  ExecutionHooksContract,
  ExecutionGuardsContract,
  ExecutionRecoveryContract,
  ExecutionRetryStrategyContract,
  ExecutionTimeoutStrategyContract,
  ExecutionMetricsContract,
  ExecutionAnalyticsContract,
  ExecutionAuditEntry,
  ExecutionAuditTrailContract,
  ExecutionLoggingContract,
  ExecutionMonitoringContract,
  ExecutionTraceSpan,
  ExecutionTraceModelContract,
  ExecutionDependencyEdge,
  ExecutionDependencyGraphContract,
  ExecutionEventContract,
  ExecutionStateTransition,
  ExecutionStateMachineContract,
  RuntimeOrchestratorBlueprint,
} from './types'

export {
  RUNTIME_ORCHESTRATOR_ISOLATION,
  RUNTIME_ENGINE_REFS,
  RUNTIME_LIFECYCLE_ACTIONS,
  RUNTIME_PIPELINE_STAGES,
  RUNTIME_STATE_IDS,
  RUNTIME_ENGINE_FEATURE_HINTS,
} from './types'

export {
  buildRuntimeOrchestrator,
  buildExecutionPipeline,
  buildExecutionContext,
  buildExecutionLifecycle,
  buildExecutionSession,
  buildExecutionCoordinator,
  buildExecutionScheduler,
  buildExecutionQueue,
  buildExecutionContracts,
  buildExecutionMiddleware,
  buildExecutionHooks,
  buildExecutionGuards,
  buildExecutionRecovery,
  buildExecutionRetryStrategy,
  buildExecutionTimeoutStrategy,
  buildExecutionMetrics,
  buildExecutionAnalytics,
  buildExecutionAuditTrail,
  buildExecutionLogging,
  buildExecutionMonitoring,
  buildExecutionTraceModel,
  buildExecutionDependencyGraph,
  buildExecutionEvent,
  buildExecutionStateMachine,
} from './pipelines'

export {
  RuntimeOrchestrator,
  buildRuntimeOrchestratorBlueprint,
  tryBuildRuntimeOrchestratorBlueprint,
  assertRuntimeOrchestratorIsolation,
} from './engine'
export type { BuildRuntimeBlueprintOptions } from './engine'

export const RUNTIME_ORCHESTRATOR_ARCHITECTURE = {
  version: '6.9.0-runtime-orchestrator',
  featureId: 'brain.runtime_orchestrator' as const,
  architectureOnly: true,
  components: [
    'runtime_orchestrator',
    'execution_pipeline',
    'execution_context',
    'execution_lifecycle',
    'execution_session',
    'execution_coordinator',
    'execution_scheduler',
    'execution_queue',
    'execution_state_machine',
    'execution_events',
    'execution_registry',
    'execution_contracts',
    'execution_middleware',
    'execution_hooks',
    'execution_guards',
    'execution_recovery',
    'execution_retry_strategy',
    'execution_timeout_strategy',
    'execution_metrics',
    'execution_analytics',
    'execution_audit_trail',
    'execution_logging',
    'execution_monitoring',
    'execution_trace_model',
    'execution_dependency_graph',
  ] as const,
  pipelineStages: RUNTIME_PIPELINE_STAGES,
  engineRefs: RUNTIME_ENGINE_REFS,
  lifecycleActions: RUNTIME_LIFECYCLE_ACTIONS,
  ...RO_ISOLATION,
} as const
