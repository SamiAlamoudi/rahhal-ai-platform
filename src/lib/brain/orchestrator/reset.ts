/**
 * Orchestrator reset helpers — leaf module (no integration imports).
 */

import { clearOrchestratorCache } from './cache'
import { resetOrchestratorMetrics } from './metrics'
import { clearOrchestratorHandles } from './sessionRegistry'

export function resetAITripOrchestrator(): void {
  clearOrchestratorHandles()
  clearOrchestratorCache()
  resetOrchestratorMetrics()
}

export { clearOrchestratorCache, resetOrchestratorMetrics }
