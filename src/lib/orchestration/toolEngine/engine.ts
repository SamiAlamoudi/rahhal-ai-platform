/**
 * Tool Execution Engine facade — builds architecture blueprints only.
 * Never dispatches, calls APIs, or executes tools.
 */

import {
  listToolCapabilityRegistry,
  listToolRegistry,
} from './registry'
import { isBrainToolEngineEnabled } from './registry'
import {
  buildToolAnalytics,
  buildToolAuditTrail,
  buildToolCircuitBreaker,
  buildToolContextInjection,
  buildToolContracts,
  buildToolDiscovery,
  buildToolDispatcher,
  buildToolErrorModel,
  buildToolEvent,
  buildToolExecutionEngine,
  buildToolExecutionPipeline,
  buildToolInputValidation,
  buildToolMetadata,
  buildToolOutputValidation,
  buildToolPermissions,
  buildToolPolicies,
  buildToolQueue,
  buildToolResultNormalization,
  buildToolResolver,
  buildToolRetryStrategy,
  buildToolRouter,
  buildToolStateMachine,
  buildToolTimeoutStrategy,
} from './pipelines'
import type { ToolEngineBlueprint, ToolLocale } from './types'
import { TOOL_ENGINE_ISOLATION, TOOL_FUTURE_CAPABILITIES } from './types'

export interface BuildToolBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: ToolLocale
}

export function buildToolEngineBlueprint(
  options: BuildToolBlueprintOptions = {},
): ToolEngineBlueprint {
  const sessionId = options.sessionId ?? 'tool-session-architecture'

  return {
    version: '6.7.0-tool-engine',
    featureId: 'brain.tool_engine',
    architectureOnly: true,
    engine: buildToolExecutionEngine(),
    pipeline: buildToolExecutionPipeline(),
    registry: listToolRegistry(),
    capabilityRegistry: listToolCapabilityRegistry(),
    toolContracts: buildToolContracts(),
    metadata: buildToolMetadata(),
    router: buildToolRouter(),
    dispatcher: buildToolDispatcher(),
    resolver: buildToolResolver(),
    discovery: buildToolDiscovery(),
    permissions: buildToolPermissions(),
    policies: buildToolPolicies(),
    contextInjection: buildToolContextInjection(sessionId),
    inputValidation: buildToolInputValidation(),
    outputValidation: buildToolOutputValidation(),
    resultNormalization: buildToolResultNormalization(),
    errorModel: buildToolErrorModel(),
    retryStrategy: buildToolRetryStrategy(),
    timeoutStrategy: buildToolTimeoutStrategy(),
    circuitBreaker: buildToolCircuitBreaker(),
    queue: buildToolQueue(),
    events: [
      buildToolEvent(sessionId, 'session_started', 'architecture blueprint'),
      buildToolEvent(sessionId, 'tool_discovered', 'capability catalog'),
    ],
    analytics: buildToolAnalytics(sessionId),
    auditTrail: buildToolAuditTrail(),
    stateMachine: buildToolStateMachine(),
    futureCapabilities: TOOL_FUTURE_CAPABILITIES,
  }
}

export function tryBuildToolEngineBlueprint(
  options: BuildToolBlueprintOptions = {},
): ToolEngineBlueprint | null {
  if (!isBrainToolEngineEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildToolEngineBlueprint(options)
}

export function assertToolEngineIsolation(): typeof TOOL_ENGINE_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
  capabilityCount: number
} {
  return {
    ...TOOL_ENGINE_ISOLATION,
    architectureOnly: true,
    registrySize: listToolRegistry().length,
    capabilityCount: listToolCapabilityRegistry().length,
  }
}

export const ToolExecutionEngine = {
  buildBlueprint: buildToolEngineBlueprint,
  tryBuildBlueprint: tryBuildToolEngineBlueprint,
  assertIsolation: assertToolEngineIsolation,
}
