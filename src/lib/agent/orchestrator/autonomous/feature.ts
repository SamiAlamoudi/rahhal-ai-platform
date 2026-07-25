/**
 * Phase 6 — Autonomous Agent Orchestrator feature gate.
 * Flag: `ai.autonomous_agent_orchestrator` (default OFF).
 * Distinct from frozen Sprint 113 `ai.orchestrator`.
 */

import { getFeatureRegistry } from '../../../ai/featureFlags'

export const AUTONOMOUS_AGENT_ORCHESTRATOR_FEATURE_ID =
  'ai.autonomous_agent_orchestrator' as const

export function isAutonomousAgentOrchestratorEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(AUTONOMOUS_AGENT_ORCHESTRATOR_FEATURE_ID)
}
