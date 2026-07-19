/**
 * Sprint 27 — execution metrics for AITripOrchestrator.
 */

import type { TravelIntent } from '../types'
import type {
  OrchestratorDomain,
  OrchestratorMetrics,
  OrchestratorStage,
} from './types'

export type OrchestratorMetricsCollector = {
  markStageStart: (stage: OrchestratorStage) => void
  markStageEnd: (stage: OrchestratorStage) => void
  setIntent: (intent: TravelIntent | null) => void
  setDomainsRequested: (domains: OrchestratorDomain[]) => void
  setDomainsCompleted: (domains: OrchestratorDomain[]) => void
  addProviderCalls: (n: number) => void
  addRetry: () => void
  addTimeout: () => void
  setCacheHit: (hit: boolean) => void
  setError: (error: string | null) => void
  setSuccess: (success: boolean, partial?: boolean) => void
  snapshot: () => OrchestratorMetrics
}

export function createOrchestratorMetricsCollector(
  conversationId: string,
): OrchestratorMetricsCollector {
  const startedAt = Date.now()
  const stageStarted = new Map<OrchestratorStage, number>()
  const stageDurationsMs: Partial<Record<OrchestratorStage, number>> = {}
  let intent: TravelIntent | null = null
  let domainsRequested: OrchestratorDomain[] = []
  let domainsCompleted: OrchestratorDomain[] = []
  let providerCalls = 0
  let retries = 0
  let timeouts = 0
  let cacheHit = false
  let success = false
  let partialSuccess = false
  let error: string | null = null

  return {
    markStageStart(stage) {
      stageStarted.set(stage, Date.now())
    },
    markStageEnd(stage) {
      const start = stageStarted.get(stage)
      if (start == null) return
      stageDurationsMs[stage] = Date.now() - start
      stageStarted.delete(stage)
    },
    setIntent(next) {
      intent = next
    },
    setDomainsRequested(domains) {
      domainsRequested = [...domains]
    },
    setDomainsCompleted(domains) {
      domainsCompleted = [...domains]
    },
    addProviderCalls(n) {
      providerCalls += Math.max(0, n)
    },
    addRetry() {
      retries += 1
    },
    addTimeout() {
      timeouts += 1
    },
    setCacheHit(hit) {
      cacheHit = hit
    },
    setError(err) {
      error = err
    },
    setSuccess(ok, partial = false) {
      success = ok
      partialSuccess = partial
    },
    snapshot() {
      return {
        conversationId,
        durationMs: Date.now() - startedAt,
        stageDurationsMs: { ...stageDurationsMs },
        intent,
        domainsRequested: [...domainsRequested],
        domainsCompleted: [...domainsCompleted],
        providerCalls,
        retries,
        timeouts,
        cacheHit,
        success,
        partialSuccess,
        error,
      }
    },
  }
}

/** In-memory rollup for tests / debug panels. */
const recentMetrics: OrchestratorMetrics[] = []
const MAX_RECENT = 50

export function recordOrchestratorMetrics(metrics: OrchestratorMetrics): void {
  recentMetrics.unshift(metrics)
  if (recentMetrics.length > MAX_RECENT) recentMetrics.length = MAX_RECENT
}

export function getRecentOrchestratorMetrics(): OrchestratorMetrics[] {
  return [...recentMetrics]
}

export function resetOrchestratorMetrics(): void {
  recentMetrics.length = 0
}
