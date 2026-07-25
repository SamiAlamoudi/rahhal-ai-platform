/**
 * Execution Registry + feature gate.
 * Flag `brain.runtime_orchestrator` default OFF.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { ExecutionRegistryEntry, RuntimeEngineRefId } from './types'
import {
  RUNTIME_ENGINE_FEATURE_HINTS,
  RUNTIME_ENGINE_REFS,
} from './types'

export const BRAIN_RUNTIME_ORCHESTRATOR_FEATURE_ID =
  'brain.runtime_orchestrator' as const

export function isBrainRuntimeOrchestratorEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_RUNTIME_ORCHESTRATOR_FEATURE_ID)
}

export const EXECUTION_REGISTRY: readonly ExecutionRegistryEntry[] =
  RUNTIME_ENGINE_REFS.map((engineRef) => ({
    id: `ereg-${engineRef}`,
    engineRef,
    featureIdHint: RUNTIME_ENGINE_FEATURE_HINTS[engineRef],
    enabledHint: false as const,
  }))

export function listExecutionRegistry(): ExecutionRegistryEntry[] {
  return EXECUTION_REGISTRY.map((entry) => ({ ...entry }))
}

export function listRuntimeEngineRefs(): readonly RuntimeEngineRefId[] {
  return RUNTIME_ENGINE_REFS
}

export const ExecutionRegistry = {
  featureId: BRAIN_RUNTIME_ORCHESTRATOR_FEATURE_ID,
  isEnabled: isBrainRuntimeOrchestratorEnabled,
  list: listExecutionRegistry,
  engineRefs: listRuntimeEngineRefs,
}
