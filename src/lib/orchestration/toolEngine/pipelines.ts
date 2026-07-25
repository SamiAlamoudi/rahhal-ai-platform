/**
 * Tool pipeline & component contracts — pure builders, no execution.
 */

import type {
  ToolAnalyticsContract,
  ToolAuditTrailContract,
  ToolCircuitBreakerContract,
  ToolContextInjectionContract,
  ToolContract,
  ToolDiscoveryContract,
  ToolDispatcherContract,
  ToolErrorModelContract,
  ToolEventContract,
  ToolExecutionEngineContract,
  ToolExecutionPipelineContract,
  ToolInputValidationContract,
  ToolMetadataContract,
  ToolOutputValidationContract,
  ToolPermissionsContract,
  ToolPoliciesContract,
  ToolQueueContract,
  ToolResultNormalizationContract,
  ToolResolverContract,
  ToolRetryStrategyContract,
  ToolRouterContract,
  ToolStateMachineContract,
  ToolTimeoutStrategyContract,
} from './types'
import {
  TOOL_FUTURE_CAPABILITIES,
  TOOL_PIPELINE_STAGES,
  TOOL_STATE_IDS,
} from './types'

const ISO = '2026-07-25T00:00:00.000Z'

export function buildToolExecutionEngine(): ToolExecutionEngineContract {
  return {
    kind: 'tool_execution_engine',
    version: '6.7.0-tool-engine',
    execution: 'none',
  }
}

export function buildToolExecutionPipeline(): ToolExecutionPipelineContract {
  return {
    kind: 'tool_execution_pipeline',
    stages: TOOL_PIPELINE_STAGES,
    execution: 'none',
  }
}

export function buildToolContracts(): ToolContract[] {
  return TOOL_FUTURE_CAPABILITIES.map((capabilityId) => ({
    kind: 'tool_contract' as const,
    toolId: `tool-${capabilityId}`,
    capabilityId,
    inputSchemaHint: `${capabilityId}.input`,
    outputSchemaHint: `${capabilityId}.output`,
    execution: 'none' as const,
  }))
}

export function buildToolMetadata(): ToolMetadataContract[] {
  return TOOL_FUTURE_CAPABILITIES.map((capabilityId) => ({
    kind: 'tool_metadata' as const,
    toolId: `tool-${capabilityId}`,
    label: capabilityId,
    versionHint: '0.0.0-architecture',
    tags: ['future', 'placeholder'],
  }))
}

export function buildToolRouter(): ToolRouterContract {
  return {
    kind: 'tool_router',
    routeHints: TOOL_FUTURE_CAPABILITIES.map((capabilityId) => ({
      capabilityId,
      toolId: `tool-${capabilityId}`,
    })),
    execution: 'none',
  }
}

export function buildToolDispatcher(): ToolDispatcherContract {
  return {
    kind: 'tool_dispatcher',
    dispatchModeHint: 'async_placeholder',
    execution: 'none',
  }
}

export function buildToolResolver(): ToolResolverContract {
  return {
    kind: 'tool_resolver',
    resolvedToolId: null,
    unresolvedHints: [],
    execution: 'none',
  }
}

export function buildToolDiscovery(): ToolDiscoveryContract {
  return {
    kind: 'tool_discovery',
    discoveredToolIds: TOOL_FUTURE_CAPABILITIES.map(
      (capabilityId) => `tool-${capabilityId}`,
    ),
    execution: 'none',
  }
}

export function buildToolPermissions(): ToolPermissionsContract[] {
  return TOOL_FUTURE_CAPABILITIES.map((capabilityId) => ({
    kind: 'tool_permissions' as const,
    toolId: `tool-${capabilityId}`,
    level: 'none' as const,
    roles: [],
    execution: 'none' as const,
  }))
}

export function buildToolPolicies(): ToolPoliciesContract {
  return {
    kind: 'tool_policies',
    policyIds: ['deny_by_default', 'architecture_only'],
    rules: ['no_live_dispatch', 'no_external_apis'],
    execution: 'none',
  }
}

export function buildToolContextInjection(
  sessionId: string,
): ToolContextInjectionContract {
  return {
    kind: 'tool_context_injection',
    sessionId,
    injectedKeys: [],
    execution: 'none',
  }
}

export function buildToolInputValidation(): ToolInputValidationContract {
  return {
    kind: 'tool_input_validation',
    valid: true,
    issues: [],
    execution: 'none',
  }
}

export function buildToolOutputValidation(): ToolOutputValidationContract {
  return {
    kind: 'tool_output_validation',
    valid: true,
    issues: [],
    execution: 'none',
  }
}

export function buildToolResultNormalization(): ToolResultNormalizationContract {
  return {
    kind: 'tool_result_normalization',
    normalizedShapeHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildToolErrorModel(): ToolErrorModelContract {
  return {
    kind: 'tool_error_model',
    codes: ['TOOL_NOT_IMPLEMENTED', 'TOOL_DENIED', 'TOOL_TIMEOUT_HINT'],
    retryableHints: ['TOOL_TIMEOUT_HINT'],
    execution: 'none',
  }
}

export function buildToolRetryStrategy(): ToolRetryStrategyContract {
  return {
    kind: 'tool_retry_strategy',
    maxAttemptsHint: 0,
    backoffHint: 'none',
    execution: 'none',
  }
}

export function buildToolTimeoutStrategy(): ToolTimeoutStrategyContract {
  return {
    kind: 'tool_timeout_strategy',
    timeoutMsHint: 0,
    execution: 'none',
  }
}

export function buildToolCircuitBreaker(): ToolCircuitBreakerContract {
  return {
    kind: 'tool_circuit_breaker',
    stateHint: 'closed',
    failureThresholdHint: 0,
    execution: 'none',
  }
}

export function buildToolQueue(): ToolQueueContract {
  return {
    kind: 'tool_queue',
    items: [],
    execution: 'none',
  }
}

export function buildToolEvent(
  sessionId: string,
  eventKind: ToolEventContract['eventKind'],
  payloadSummary: string,
): ToolEventContract {
  return {
    kind: 'tool_event',
    eventId: `tevt-${eventKind}`,
    eventKind,
    sessionId,
    atIso: ISO,
    payloadSummary,
  }
}

export function buildToolAnalytics(sessionId: string): ToolAnalyticsContract {
  return {
    kind: 'tool_analytics',
    sessionId,
    capabilityCount: TOOL_FUTURE_CAPABILITIES.length,
    stageCount: TOOL_PIPELINE_STAGES.length,
    exported: false,
  }
}

export function buildToolAuditTrail(): ToolAuditTrailContract {
  return {
    kind: 'tool_audit_trail',
    entries: [
      {
        id: 'taudit-open',
        atIso: ISO,
        action: 'session_started',
        detail: 'architecture blueprint',
      },
    ],
    persisted: false,
  }
}

export function buildToolStateMachine(): ToolStateMachineContract {
  return {
    kind: 'tool_state_machine',
    current: 'idle',
    allowed: TOOL_STATE_IDS,
    lastTransition: null,
    execution: 'none',
  }
}
