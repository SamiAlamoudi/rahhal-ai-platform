/**
 * Phase 6 Stage 7 — AI Tool Execution Engine barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.tool_engine` (default OFF).
 * No tool execution, LLM, APIs, Runtime, or production wiring.
 */

import { TOOL_ENGINE_ISOLATION as TE_ISOLATION } from './types'
import { TOOL_FUTURE_CAPABILITIES, TOOL_PIPELINE_STAGES } from './types'

export {
  BRAIN_TOOL_ENGINE_FEATURE_ID,
  isBrainToolEngineEnabled,
  listToolRegistry,
  listToolCapabilityRegistry,
  listToolFutureCapabilities,
  ToolRegistry,
  TOOL_REGISTRY,
  TOOL_CAPABILITY_REGISTRY,
} from './registry'

export type {
  ToolLocale,
  ToolStateId,
  ToolEventKind,
  ToolFutureCapabilityId,
  ToolPipelineStageId,
  ToolPermissionLevel,
  ToolExecutionEngineContract,
  ToolExecutionPipelineContract,
  ToolContract,
  ToolMetadataContract,
  ToolRegistryEntry,
  ToolCapabilityRegistryEntry,
  ToolRouterContract,
  ToolDispatcherContract,
  ToolResolverContract,
  ToolDiscoveryContract,
  ToolPermissionsContract,
  ToolPoliciesContract,
  ToolContextInjectionContract,
  ToolInputValidationContract,
  ToolOutputValidationContract,
  ToolResultNormalizationContract,
  ToolErrorModelContract,
  ToolRetryStrategyContract,
  ToolTimeoutStrategyContract,
  ToolCircuitBreakerContract,
  ToolQueueContract,
  ToolEventContract,
  ToolAnalyticsContract,
  ToolAuditEntry,
  ToolAuditTrailContract,
  ToolStateTransition,
  ToolStateMachineContract,
  ToolEngineBlueprint,
} from './types'

export {
  TOOL_ENGINE_ISOLATION,
  TOOL_PIPELINE_STAGES,
  TOOL_STATE_IDS,
  TOOL_FUTURE_CAPABILITIES,
} from './types'

export {
  buildToolExecutionEngine,
  buildToolExecutionPipeline,
  buildToolContracts,
  buildToolMetadata,
  buildToolRouter,
  buildToolDispatcher,
  buildToolResolver,
  buildToolDiscovery,
  buildToolPermissions,
  buildToolPolicies,
  buildToolContextInjection,
  buildToolInputValidation,
  buildToolOutputValidation,
  buildToolResultNormalization,
  buildToolErrorModel,
  buildToolRetryStrategy,
  buildToolTimeoutStrategy,
  buildToolCircuitBreaker,
  buildToolQueue,
  buildToolEvent,
  buildToolAnalytics,
  buildToolAuditTrail,
  buildToolStateMachine,
} from './pipelines'

export {
  ToolExecutionEngine,
  buildToolEngineBlueprint,
  tryBuildToolEngineBlueprint,
  assertToolEngineIsolation,
} from './engine'
export type { BuildToolBlueprintOptions } from './engine'

export const TOOL_ENGINE_ARCHITECTURE = {
  version: '6.7.0-tool-engine',
  featureId: 'brain.tool_engine' as const,
  architectureOnly: true,
  components: [
    'tool_execution_engine',
    'tool_registry',
    'tool_contracts',
    'tool_router',
    'tool_dispatcher',
    'tool_resolver',
    'tool_capability_registry',
    'tool_discovery',
    'tool_metadata',
    'tool_permissions',
    'tool_policies',
    'tool_context_injection',
    'tool_input_validation',
    'tool_output_validation',
    'tool_result_normalization',
    'tool_error_model',
    'tool_retry_strategy',
    'tool_timeout_strategy',
    'tool_circuit_breaker',
    'tool_queue',
    'tool_events',
    'tool_analytics',
    'tool_audit_trail',
    'tool_state_machine',
    'tool_execution_pipeline',
  ] as const,
  pipelineStages: TOOL_PIPELINE_STAGES,
  futureCapabilities: TOOL_FUTURE_CAPABILITIES,
  ...TE_ISOLATION,
} as const
