/**
 * Runtime Orchestrator facade — builds architecture blueprints only.
 * Never starts a production runtime, calls AI, or executes tools.
 */

import { listExecutionRegistry } from './registry'
import { isBrainRuntimeOrchestratorEnabled } from './registry'
import {
  buildExecutionAnalytics,
  buildExecutionAuditTrail,
  buildExecutionContext,
  buildExecutionContracts,
  buildExecutionCoordinator,
  buildExecutionDependencyGraph,
  buildExecutionEvent,
  buildExecutionGuards,
  buildExecutionHooks,
  buildExecutionLifecycle,
  buildExecutionLogging,
  buildExecutionMetrics,
  buildExecutionMiddleware,
  buildExecutionMonitoring,
  buildExecutionPipeline,
  buildExecutionQueue,
  buildExecutionRecovery,
  buildExecutionRetryStrategy,
  buildExecutionScheduler,
  buildExecutionSession,
  buildExecutionStateMachine,
  buildExecutionTimeoutStrategy,
  buildExecutionTraceModel,
  buildRuntimeOrchestrator,
} from './pipelines'
import type {
  RuntimeLocale,
  RuntimeOrchestratorBlueprint,
} from './types'
import {
  RUNTIME_ENGINE_REFS,
  RUNTIME_LIFECYCLE_ACTIONS,
  RUNTIME_ORCHESTRATOR_ISOLATION,
} from './types'

export interface BuildRuntimeBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: RuntimeLocale
}

export function buildRuntimeOrchestratorBlueprint(
  options: BuildRuntimeBlueprintOptions = {},
): RuntimeOrchestratorBlueprint {
  const sessionId = options.sessionId ?? 'runtime-session-architecture'
  const locale = options.locale ?? 'ar'

  return {
    version: '6.9.0-runtime-orchestrator',
    featureId: 'brain.runtime_orchestrator',
    architectureOnly: true,
    orchestrator: buildRuntimeOrchestrator(),
    pipeline: buildExecutionPipeline(),
    context: buildExecutionContext(sessionId, locale),
    lifecycle: buildExecutionLifecycle(),
    session: buildExecutionSession(sessionId),
    coordinator: buildExecutionCoordinator(),
    scheduler: buildExecutionScheduler(),
    queue: buildExecutionQueue(),
    stateMachine: buildExecutionStateMachine(),
    events: [
      buildExecutionEvent(sessionId, 'session_started', 'architecture blueprint'),
      buildExecutionEvent(
        sessionId,
        'engine_coordinated',
        'dependency graph declared',
      ),
    ],
    registry: listExecutionRegistry(),
    contracts: buildExecutionContracts(),
    middleware: buildExecutionMiddleware(),
    hooks: buildExecutionHooks(),
    guards: buildExecutionGuards(),
    recovery: buildExecutionRecovery(),
    retryStrategy: buildExecutionRetryStrategy(),
    timeoutStrategy: buildExecutionTimeoutStrategy(),
    metrics: buildExecutionMetrics(),
    analytics: buildExecutionAnalytics(sessionId),
    auditTrail: buildExecutionAuditTrail(),
    logging: buildExecutionLogging(),
    monitoring: buildExecutionMonitoring(),
    traceModel: buildExecutionTraceModel(),
    dependencyGraph: buildExecutionDependencyGraph(),
    engineRefs: RUNTIME_ENGINE_REFS,
    lifecycleActions: RUNTIME_LIFECYCLE_ACTIONS,
  }
}

export function tryBuildRuntimeOrchestratorBlueprint(
  options: BuildRuntimeBlueprintOptions = {},
): RuntimeOrchestratorBlueprint | null {
  if (!isBrainRuntimeOrchestratorEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildRuntimeOrchestratorBlueprint(options)
}

export function assertRuntimeOrchestratorIsolation(): typeof RUNTIME_ORCHESTRATOR_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
  engineCount: number
} {
  return {
    ...RUNTIME_ORCHESTRATOR_ISOLATION,
    architectureOnly: true,
    registrySize: listExecutionRegistry().length,
    engineCount: RUNTIME_ENGINE_REFS.length,
  }
}

export const RuntimeOrchestrator = {
  buildBlueprint: buildRuntimeOrchestratorBlueprint,
  tryBuildBlueprint: tryBuildRuntimeOrchestratorBlueprint,
  assertIsolation: assertRuntimeOrchestratorIsolation,
}
